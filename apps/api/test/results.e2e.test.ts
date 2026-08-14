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
import { RESULTS_STORE, type ConfirmResultInput, type RecordResultInput, type ResultsStore, type ResultsWorkspace } from '../src/results/results-store.js';
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
  public readonly confirmed: ConfirmResultInput[] = [];
  public readonly recorded: RecordResultInput[] = [];
  public confirm(input: ConfirmResultInput): Promise<ResultsWorkspace> { this.confirmed.push(input); return Promise.resolve(expected); }
  public record(input: RecordResultInput): Promise<ResultsWorkspace> { this.recorded.push(input); return Promise.resolve(expected); }
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

  it('records and confirms a result through protected idempotent commands', async () => {
    const account: AccountRecord = { credentialVersion: 1, displayName: 'Administrador OES', emailNormalized: 'admin@oes.test', failedLoginCount: 0, id: '10000000-0000-4000-8000-000000000001', loginBlockedUntil: null, passwordHash: await hashPassword('frase-segura-de-prueba'), role: 'ADMIN', status: 'ACTIVE' };
    const store = new FakeResultsStore();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_CONFIG).useValue(config)
      .overrideProvider(IDENTITY_STORE).useValue(new FakeIdentityStore(account))
      .overrideProvider(RESULTS_STORE).useValue(store)
      .compile();
    app = module.createNestApplication();
    configureApp(app, config);
    await app.init();
    const login = await request(app.getHttpServer() as Server).post('/api/v1/auth/login').set('Origin', config.webOrigin).send({ email: account.emailNormalized, password: 'frase-segura-de-prueba' }).expect(200);
    const cookies: unknown = login.headers['set-cookie'];
    const body: unknown = login.body;
    if (!Array.isArray(cookies) || typeof cookies[0] !== 'string' || typeof cookies[1] !== 'string' || typeof body !== 'object' || body === null || !('csrfToken' in body) || typeof body.csrfToken !== 'string') throw new Error('Expected protected session');
    const headers = { Cookie: cookies[0].split(';')[0] ?? '', 'Idempotency-Key': 'result-command-0001', Origin: config.webOrigin, 'X-CSRF-Token': body.csrfToken };
    const matchId = expected.matches[0]?.id;
    if (matchId === undefined) throw new Error('Expected match');
    await request(app.getHttpServer() as Server).post(`/api/v1/matches/${matchId}/results`).set(headers).send({ profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 }).expect(200);
    expect(store.recorded[0]).toMatchObject({ actorId: account.id, detail: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 }, idempotencyKey: 'result-command-0001', matchId });
    const resultId = '60000000-0000-4000-8000-000000000001';
    await request(app.getHttpServer() as Server).post(`/api/v1/results/${resultId}/confirm`).set({ ...headers, 'Idempotency-Key': 'result-command-0002' }).send({ expectedRevision: 1 }).expect(200);
    expect(store.confirmed[0]).toMatchObject({ actorId: account.id, expectedRevision: 1, idempotencyKey: 'result-command-0002', resultId });
  });
});
