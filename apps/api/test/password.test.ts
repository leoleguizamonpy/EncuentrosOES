import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/identity/password.js';

describe('password hashing', () => {
  it('hashes and verifies a valid password without storing it', async () => {
    const password = 'frase-segura-de-prueba';
    const encoded = await hashPassword(password);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('otra-contraseña', encoded)).resolves.toBe(false);
  });

  it('uses a unique salt for each credential', async () => {
    const [first, second] = await Promise.all([
      hashPassword('frase-segura-de-prueba'),
      hashPassword('frase-segura-de-prueba'),
    ]);
    expect(first).not.toBe(second);
  });

  it('rejects weak provisioning inputs and malformed hashes', async () => {
    await expect(hashPassword('corta')).rejects.toThrow();
    await expect(verifyPassword('anything', 'invalid')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'scrypt$1$bad$bad$bad')).resolves.toBe(false);
  });
});
