import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { API_CONFIG, type ApiConfig } from '../src/config.js';
import { IDENTITY_STORE, type AccountRecord } from '../src/identity/identity-store.js';
import { hashPassword } from '../src/identity/password.js';
import { FakeIdentityStore } from './fake-identity-store.js';

const config: ApiConfig = {
  apiPort: 3001,
  databaseUrl: 'postgresql://unused:unused@db.internal:5432/unused',
  production: true,
  sessionAbsoluteMinutes: 60,
  sessionIdleMinutes: 15,
  webOrigin: 'https://www.oesparaguay.com',
};

const account: Omit<AccountRecord, 'passwordHash'> = {
  credentialVersion: 1,
  displayName: 'Administrador OES',
  emailNormalized: 'admin@oes.test',
  failedLoginCount: 0,
  id: 'user-1',
  loginBlockedUntil: null,
  role: 'ADMIN',
  status: 'ACTIVE',
};

describe('production HTTP security boundary', () => {
  let app: INestApplication | undefined;
  let store: FakeIdentityStore;

  beforeEach(async () => {
    store = new FakeIdentityStore({
      ...account,
      passwordHash: await hashPassword('frase-segura-de-prueba'),
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_CONFIG)
      .useValue(config)
      .overrideProvider(IDENTITY_STORE)
      .useValue(store)
      .compile();
    app = module.createNestApplication();
    configureApp(app, config);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('emits exact credentialed CORS, HSTS and secure cookies for the configured HTTPS origin', async () => {
    const response = await request(server(app))
      .post('/api/v1/auth/login')
      .set('Origin', config.webOrigin)
      .send({ email: account.emailNormalized, password: 'frase-segura-de-prueba' })
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(config.webOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('same-origin');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");

    const cookies: unknown = response.headers['set-cookie'];
    if (!Array.isArray(cookies) || cookies.length !== 2) throw new Error('Expected session and CSRF cookies');
    const session = cookies.find((value): value is string => typeof value === 'string' && value.startsWith('oes_session='));
    const csrf = cookies.find((value): value is string => typeof value === 'string' && value.startsWith('oes_csrf='));
    if (session === undefined || csrf === undefined) throw new Error('Expected named production cookies');

    expect(session).toContain('HttpOnly');
    expect(session).toContain('Secure');
    expect(session).toContain('SameSite=Lax');
    expect(session).toContain('Path=/api/v1');
    expect(csrf).not.toContain('HttpOnly');
    expect(csrf).toContain('Secure');
    expect(csrf).toContain('SameSite=Lax');
    expect(csrf).toContain('Path=/');
  });

  it('rejects a state-changing request from any origin other than the configured production origin', async () => {
    const response = await request(server(app))
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: account.emailNormalized, password: 'frase-segura-de-prueba' })
      .expect(403);

    expect(response.body).toMatchObject({
      detail: 'Request origin is not allowed.',
      status: 403,
    });
    expect(store.sessions.size).toBe(0);
  });

  it('does not emit HSTS in non-production mode', async () => {
    const developmentConfig: ApiConfig = {
      ...config,
      production: false,
      webOrigin: 'http://localhost:3000',
    };
    await app?.close();

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_CONFIG)
      .useValue(developmentConfig)
      .overrideProvider(IDENTITY_STORE)
      .useValue(store)
      .compile();
    app = module.createNestApplication();
    configureApp(app, developmentConfig);
    await app.init();

    const response = await request(server(app))
      .get('/api/v1/health')
      .expect(200);
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });
});

function server(app: INestApplication | undefined): Server {
  if (app === undefined) throw new Error('Expected initialized application');
  return app.getHttpServer() as Server;
}
