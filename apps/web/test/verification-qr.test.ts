import { describe, expect, it } from 'vitest';

import { VERIFICATION_QR_SIZE, verificationQrMatrix, verificationQrPath } from '../lib/verification-qr';

describe('verificationQr', () => {
  it('generates a deterministic version 5 matrix with finder geometry', () => {
    const value = 'https://oes.test/draws/publication-123';
    const first = verificationQrMatrix(value);
    const second = verificationQrMatrix(value);

    expect(first).toEqual(second);
    expect(first).toHaveLength(VERIFICATION_QR_SIZE);
    expect(first[0]).toHaveLength(VERIFICATION_QR_SIZE);
    expect(first[0]?.[0]).toBe(true);
    expect(first[1]?.[1]).toBe(false);
    expect(first[3]?.[3]).toBe(true);
    expect(verificationQrPath(value)).toContain('M0 0h1v1h-1z');
  });

  it('rejects payloads that exceed the fixed local QR capacity', () => {
    expect(() => verificationQrMatrix(`https://oes.test/${'a'.repeat(120)}`)).toThrow(/exceeds/);
  });
});
