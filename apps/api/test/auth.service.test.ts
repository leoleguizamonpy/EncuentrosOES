import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ApiConfig } from '../src/config.js';
import { AuthService } from '../src/identity/auth.service.js';
import type { AccountRecord } from '../src/identity/identity-store.js';
import { hashPassword } from '../src/identity/password.js';
import { FakeIdentityStore } from './fake-identity-store.js';

const config: ApiConfig = {
  apiPort: 3001,
  databaseUrl: 'postgresql://unused',
  production: false,
  sessionAbsoluteMinutes: 60,
  sessionIdleMinutes: 15,
  webOrigin: 'http://localhost:3000',
};
const occurredAt = new Date('2026-08-12T16:00:00.000Z');
let account: AccountRecord;

beforeEach(async () => {
  account = {
    credentialVersion: 1,
    displayName: 'Administrador OES',
    emailNormalized: 'admin@oes.test',
    failedLoginCount: 0,
    id: 'user-1',
    loginBlockedUntil: null,
    passwordHash: await hashPassword('frase-segura-de-prueba'),
    role: 'ADMIN',
    status: 'ACTIVE',
  };
});

describe('AuthService', () => {
  it('creates an opaque persisted session for valid credentials', async () => {
    const store = new FakeIdentityStore(account);
    const result = await new AuthService(store, config).login(
      ' ADMIN@OES.TEST ',
      'frase-segura-de-prueba',
      occurredAt,
    );
    expect(result.actor).toMatchObject({ id: 'user-1', role: 'ADMIN' });
    expect(result.sessionToken).toHaveLength(43);
    expect(result.csrfToken).toHaveLength(43);
    expect(store.sessions.size).toBe(1);
  });

  it('returns the same generic failure for missing, wrong, blocked and inactive accounts', async () => {
    await expect(new AuthService(new FakeIdentityStore(null), config).login(
      'missing@oes.test', 'wrong', occurredAt,
    )).rejects.toBeInstanceOf(UnauthorizedException);
    const wrongStore = new FakeIdentityStore(account);
    await expect(new AuthService(wrongStore, config).login(
      account.emailNormalized, 'wrong', occurredAt,
    )).rejects.toBeInstanceOf(UnauthorizedException);
    expect(wrongStore.failedLogins).toBe(1);
    const blocked = new FakeIdentityStore({
      ...account,
      loginBlockedUntil: new Date(occurredAt.getTime() + 60_000),
    });
    await expect(new AuthService(blocked, config).login(
      account.emailNormalized, 'frase-segura-de-prueba', occurredAt,
    )).rejects.toBeInstanceOf(UnauthorizedException);
    const inactive = new FakeIdentityStore({ ...account, status: 'DISABLED' });
    await expect(new AuthService(inactive, config).login(
      account.emailNormalized, 'frase-segura-de-prueba', occurredAt,
    )).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authenticates, verifies CSRF and revokes a session', async () => {
    const store = new FakeIdentityStore(account);
    const service = new AuthService(store, config);
    const login = await service.login(account.emailNormalized, 'frase-segura-de-prueba', occurredAt);
    const authenticated = await service.authenticate(
      login.sessionToken,
      new Date(occurredAt.getTime() + 60_000),
    );
    expect(authenticated.actor.id).toBe(account.id);
    expect(service.verifyCsrf(authenticated.session, login.csrfToken)).toBe(true);
    expect(service.verifyCsrf(authenticated.session, 'wrong')).toBe(false);
    await service.logout(authenticated.session.id, occurredAt);
    await expect(service.authenticate(login.sessionToken, occurredAt)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired, idle and credential-invalidated sessions', async () => {
    const cases: readonly Partial<{
      credentialVersion: number;
      expiresAt: Date;
      idleExpiresAt: Date;
    }>[] = [
      { expiresAt: occurredAt },
      { idleExpiresAt: occurredAt },
      { credentialVersion: 2 },
    ];
    for (const patch of cases) {
      const store = new FakeIdentityStore(account);
      const service = new AuthService(store, config);
      const login = await service.login(account.emailNormalized, 'frase-segura-de-prueba', occurredAt);
      const session = [...store.sessions.values()][0];
      if (session === undefined) throw new Error('Expected fake session');
      store.sessions.set(session.id, { ...session, ...patch });
      await expect(service.authenticate(login.sessionToken, occurredAt)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
});
