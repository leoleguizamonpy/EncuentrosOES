import {
  randomBytes,
  scrypt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const keyLength = 64;
const version = '1';
const options = Object.freeze({ N: 16_384, p: 1, r: 8 });
const parameters = 'N=16384,r=8,p=1';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error !== null) reject(error);
      else resolve(key);
    });
  });
}

function encode(salt: Buffer, key: Buffer): string {
  return `scrypt$${version}$${parameters}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export const DUMMY_PASSWORD_HASH = encode(
  Buffer.alloc(16, 7),
  scryptSync('invalid-password', Buffer.alloc(16, 7), keyLength, options),
);

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Password must contain between 12 and 256 characters.');
  }
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return encode(salt, key);
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 5 || parts[0] !== 'scrypt' || parts[1] !== version) return false;
  const [, , parameters, saltPart, keyPart] = parts;
  if (parameters !== 'N=16384,r=8,p=1' || saltPart === undefined || keyPart === undefined) {
    return false;
  }
  try {
    const salt = Buffer.from(saltPart, 'base64url');
    const expected = Buffer.from(keyPart, 'base64url');
    if (salt.length !== 16 || expected.length !== keyLength) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
