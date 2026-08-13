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
  databaseUrl: 'postgresql://unused:unused@localhost:5432/unused',
  production: false,
  sessionAbsoluteMinutes: 60,
  sessionIdleMinutes: 15,
  webOrigin: 'http://localhost:3000',
};

describe('authentication HTTP boundary', () => {
  let app: INestApplication | undefined;
  let store: FakeIdentityStore;

  beforeEach(async () => {
    const account: AccountRecord = {
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
    store = new FakeIdentityStore(account);
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

  it('keeps health public and protects account data', async () => {
    await request(server(app))
      .get('/api/v1/health')
      .expect(200)
      .expect({ service: 'oes-api', status: 'ok', version: '0.1.0' });
    const protectedResponse = await request(server(app))
      .get('/api/v1/auth/me')
      .expect(401);
    expect(protectedResponse.headers['content-type']).toContain('application/problem+json');
    expect(protectedResponse.body).toMatchObject({
      detail: 'Authentication is required.',
      instance: '/api/v1/auth/me',
      status: 401,
    });
  });

  it('requires the configured origin for login', async () => {
    const response = await request(server(app))
      .post('/api/v1/auth/login')
      .send({ email: 'admin@oes.test', password: 'frase-segura-de-prueba' })
      .expect(403);
    expect(response.body).toMatchObject({
      detail: 'Request origin is not allowed.',
      status: 403,
    });
    expect(store.sessions.size).toBe(0);
  });

  it('creates, uses and revokes a cookie session with CSRF protection', async () => {
    const login = await request(server(app))
      .post('/api/v1/auth/login')
      .set('Origin', config.webOrigin)
      .send({ email: 'admin@oes.test', password: 'frase-segura-de-prueba' })
      .expect(200);
    const setCookie: unknown = login.headers['set-cookie'];
    if (!Array.isArray(setCookie) || setCookie.length !== 2 || typeof setCookie[0] !== 'string') {
      throw new Error('Expected session and CSRF cookies');
    }
    const sessionCookie = setCookie[0].split(';')[0];
    if (sessionCookie === undefined) throw new Error('Expected a session cookie value');
    expect(sessionCookie).toMatch(/^oes_session=/);
    expect(setCookie[1]).toContain('oes_csrf=');
    expect(setCookie[1]).not.toContain('HttpOnly');
    expect(login.body).toMatchObject({
      actor: { id: accountId(store), role: 'ADMIN' },
    });

    await request(server(app))
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie)
      .expect(200)
      .expect({ displayName: 'Administrador OES', id: 'user-1', role: 'ADMIN' });

    await request(server(app))
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookie)
      .set('Origin', config.webOrigin)
      .expect(403);

    await request(server(app))
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookie)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', csrfToken(login.body))
      .expect(204);

    await request(server(app))
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie)
      .expect(401);
  });
});

function accountId(store: FakeIdentityStore): string {
  if (store.account === null) throw new Error('Expected fake account');
  return store.account.id;
}

function server(app: INestApplication | undefined): Server {
  if (app === undefined) throw new Error('Expected initialized application');
  return app.getHttpServer() as Server;
}

function csrfToken(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('csrfToken' in body)) {
    throw new Error('Expected CSRF token');
  }
  const value = body.csrfToken;
  if (typeof value !== 'string') throw new Error('Expected CSRF token');
  return value;
}
