const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const ERROR_CODEWORDS = 26;
const MAX_BYTE_LENGTH = 106;

type Matrix = boolean[][];

function gfMultiply(left: number, right: number): number {
  let a = left;
  let b = right;
  let result = 0;
  while (b > 0) {
    if ((b & 1) !== 0) result ^= a;
    a = (a << 1) ^ ((a & 0x80) !== 0 ? 0x11d : 0);
    b >>>= 1;
  }
  return result;
}

function reedSolomonGenerator(degree: number): number[] {
  let polynomial = [1];
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    const next = Array<number>(polynomial.length + 1).fill(0);
    for (let coefficient = 0; coefficient < polynomial.length; coefficient += 1) {
      next[coefficient] ^= polynomial[coefficient] ?? 0;
      next[coefficient + 1] ^= gfMultiply(polynomial[coefficient] ?? 0, root);
    }
    polynomial = next;
    root = gfMultiply(root, 2);
  }
  return polynomial;
}

function reedSolomonRemainder(data: readonly number[], degree: number): number[] {
  const generator = reedSolomonGenerator(degree);
  const remainder = Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (remainder[0] ?? 0);
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < degree; index += 1) {
      remainder[index] = (remainder[index] ?? 0) ^ gfMultiply(generator[index + 1] ?? 0, factor);
    }
  }
  return remainder;
}

function appendBits(target: number[], value: number, length: number): void {
  for (let index = length - 1; index >= 0; index -= 1) target.push((value >>> index) & 1);
}

function dataCodewords(value: string): number[] {
  const bytes = [...new TextEncoder().encode(value)];
  if (bytes.length > MAX_BYTE_LENGTH) throw new Error(`Verification URL exceeds ${String(MAX_BYTE_LENGTH)} UTF-8 bytes.`);

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);

  const capacity = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const result: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let offset = 0; offset < 8; offset += 1) byte = (byte << 1) | (bits[index + offset] ?? 0);
    result.push(byte);
  }

  for (let pad = 0; result.length < DATA_CODEWORDS; pad += 1) result.push(pad % 2 === 0 ? 0xec : 0x11);
  return result;
}

function emptyMatrix(): { matrix: Matrix; functionModules: Matrix } {
  return {
    matrix: Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false)),
    functionModules: Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false)),
  };
}

function setFunction(matrix: Matrix, functionModules: Matrix, x: number, y: number, value: boolean): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  matrix[y]![x] = value;
  functionModules[y]![x] = true;
}

function drawFinder(matrix: Matrix, functionModules: Matrix, centerX: number, centerY: number): void {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunction(matrix, functionModules, centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignment(matrix: Matrix, functionModules: Matrix, centerX: number, centerY: number): void {
  if (functionModules[centerY]![centerX]) return;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(matrix, functionModules, centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function formatBits(mask: number): number {
  const data = (0b01 << 3) | mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
}

function drawFormat(matrix: Matrix, functionModules: Matrix, mask: number): void {
  const bits = formatBits(mask);
  const bit = (index: number): boolean => ((bits >>> index) & 1) !== 0;

  for (let index = 0; index <= 5; index += 1) setFunction(matrix, functionModules, 8, index, bit(index));
  setFunction(matrix, functionModules, 8, 7, bit(6));
  setFunction(matrix, functionModules, 8, 8, bit(7));
  setFunction(matrix, functionModules, 7, 8, bit(8));
  for (let index = 9; index <= 14; index += 1) setFunction(matrix, functionModules, 14 - index, 8, bit(index));

  for (let index = 0; index <= 7; index += 1) setFunction(matrix, functionModules, SIZE - 1 - index, 8, bit(index));
  for (let index = 8; index <= 14; index += 1) setFunction(matrix, functionModules, 8, SIZE - 15 + index, bit(index));
  setFunction(matrix, functionModules, 8, SIZE - 8, true);
}

function drawFunctionPatterns(matrix: Matrix, functionModules: Matrix): void {
  drawFinder(matrix, functionModules, 3, 3);
  drawFinder(matrix, functionModules, SIZE - 4, 3);
  drawFinder(matrix, functionModules, 3, SIZE - 4);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setFunction(matrix, functionModules, 6, index, index % 2 === 0);
    setFunction(matrix, functionModules, index, 6, index % 2 === 0);
  }

  drawAlignment(matrix, functionModules, 30, 30);
  drawFormat(matrix, functionModules, 0);
}

function masked(mask: number, x: number, y: number): boolean {
  if (mask === 0) return (x + y) % 2 === 0;
  return false;
}

function drawCodewords(matrix: Matrix, functionModules: Matrix, codewords: readonly number[], mask: number): void {
  const bits: number[] = [];
  for (const byte of codewords) appendBits(bits, byte, 8);
  let bitIndex = 0;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    const upward = ((right + 1) & 2) === 0;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functionModules[y]![x]) continue;
        const raw = (bits[bitIndex] ?? 0) !== 0;
        matrix[y]![x] = raw !== masked(mask, x, y);
        bitIndex += 1;
      }
    }
  }
}

export function verificationQrMatrix(value: string): readonly (readonly boolean[])[] {
  const data = dataCodewords(value);
  const errorCorrection = reedSolomonRemainder(data, ERROR_CODEWORDS);
  const { matrix, functionModules } = emptyMatrix();
  drawFunctionPatterns(matrix, functionModules);
  drawCodewords(matrix, functionModules, [...data, ...errorCorrection], 0);
  return matrix;
}

export function verificationQrPath(value: string): string {
  const matrix = verificationQrMatrix(value);
  const commands: string[] = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < (matrix[y]?.length ?? 0); x += 1) {
      if (matrix[y]?.[x]) commands.push(`M${String(x)} ${String(y)}h1v1h-1z`);
    }
  }
  return commands.join('');
}

export const VERIFICATION_QR_SIZE = SIZE;
