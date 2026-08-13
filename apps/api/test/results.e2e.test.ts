import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { API_CONFIG, type ApiConfig } from '../src/config.js';
import { IDENTITY_STORE, type AccountRecord } from '../src/identity/identity-store.js';
import { hashPassword } from '../src/identity/password.js';
import { RESULTS_STORE, type ResultsStore, type ResultsWorkspace } from '../src/results/results-store.js';
import { FakeIdentityStore } from './fake-identity-store.js';

const config: ApiConfig = { apiPort: 3001, databaseUrl: 'postgresql://unused:unused@localhost:5432/unused', production: false, sessionAbsoluteMinutes: 60, sessionIdleMinutes: 15, webOrigin: 'http://localhost:3000' };
const competitionId = '20000000-0000-4000-8000-000000000001';
const expected: ResultsWorkspace = {
  competitionId,
  competitionStatus: 'LOCKED',
  groups: [{ complete: false, id: '30000000-0000-4000-8000-000000000001', label: 'A', ordinal: 1, standings: [] }],
  matches: [{ group: { id: '30000000-0000-4000-8000-000000000001', label: 'A' }, id: '40000000-0000-4000-8000-000000000001', ordinal: 1, participantA: { displayName: 'Colegio A', id: '50000000-0000-4000-8000-000000000001' }, participantB: { displayName: 'Colegio B', id: '50000000-0000-4000-8000-000000000002' }, result: null, roundNumber: 0, status: 'PENDING_RESULT', winnerParticipantId: null }],
  resultProfile: 'SCORE_BASED',
};

class FakeResultsStore implements ResultsStore {
  public workspace(id: string): Promise<ResultsWorkspace> {
    expect(id).toBe(competitionId);
    return Promise.resolve(expected);
  }
}

let app: INestApplication | undefined;

afterEach(async () => { await app?.close(); app = undefined; });

describe('results HTTP boundary', () => {
  it('restores generated matches and standings for an authorized operator', async () => {
    const account: AccountRecord = { credentialVersion: 1, displayName: 'Operador OES', emailNormalized: 'operador@oes.test', failedLoginCount: 0, id: '10000000-0000-4000-8000-000000000001', loginBlockedUntil: null, passwordHash: await hashPassword('frase-segura-de-prueba'), role: 'OPERATOR', status: 'ACTIVE' };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_CONFIG).useValue(config)
      .overrideProvider(IDENTITY_STORE).useValue(new FakeIdentityStore(account))
      .overrideProvider(RESULTS_STORE).useValue(new FakeResultsStore())
      .compile();
    app = module.createNestApplication();
    configureApp(app, config);
    await app.init();
    const login = await request(app.getHttpServer() as Server).post('/api/v1/auth/login').set('Origin', config.webOrigin).send({ email: account.emailNormalized, password: 'frase-segura-de-prueba' }).expect(200);
    const cookies: unknown = login.headers['set-cookie'];
    if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('Expected session cookie');
    await request(app.getHttpServer() as Server).get(`/api/v1/competitions/${competitionId}/results-workspace`).set('Cookie', cookies[0].split(';')[0] ?? '').expect(200).expect(expected);
    const invalid = await request(app.getHttpServer() as Server).get('/api/v1/competitions/not-a-uuid/results-workspace').set('Cookie', cookies[0].split(';')[0] ?? '').expect(400);
    expect(invalid.body).toMatchObject({ detail: 'Competition identifier is invalid.' });
  });
});
