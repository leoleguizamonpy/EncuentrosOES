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
import {
  RESULTS_STORE,
  type RecordResultInput,
  type ResultsStore,
  type ResultsWorkspace,
} from '../src/results/results-store.js';
import { FakeIdentityStore } from './fake-identity-store.js';

const config: ApiConfig = {
  apiPort: 3001,
  databaseUrl: 'postgresql://unused:unused@localhost:5432/unused',
  production: false,
  sessionAbsoluteMinutes: 60,
  sessionIdleMinutes: 15,
  webOrigin: 'http://localhost:3000',
};
const competitionId = '20000000-0000-4000-8000-000000000001';
const matchId = '40000000-0000-4000-8000-000000000001';
const workspace: ResultsWorkspace = {
  competitionId,
  competitionStatus: 'LOCKED',
  groups: [],
  matches: [{
    group: null,
    id: matchId,
    ordinal: 1,
    participantA: { displayName: 'Colegio A', id: '50000000-0000-4000-8000-000000000001' },
    participantB: { displayName: 'Colegio B', id: '50000000-0000-4000-8000-000000000002' },
    result: null,
    roundNumber: 1,
    status: 'PENDING_RESULT',
    winnerParticipantId: null,
  }],
  resultProfile: 'SCORE_BASED',
};

class CapturingResultsStore implements ResultsStore {
  public readonly recorded: RecordResultInput[] = [];

  public record(input: RecordResultInput): Promise<ResultsWorkspace> {
    this.recorded.push(input);
    return Promise.resolve(workspace);
  }

  public confirm(): Promise<ResultsWorkspace> {
    return Promise.resolve(workspace);
  }

  public annul(): Promise<ResultsWorkspace> {
    return Promise.resolve(workspace);
  }

  public confirmQualification(): Promise<ResultsWorkspace> {
    return Promise.resolve(workspace);
  }

  public workspace(): Promise<ResultsWorkspace> {
    return Promise.resolve(workspace);
  }
}

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function authenticatedHeaders(store: CapturingResultsStore): Promise<Record<string, string>> {
  const account: AccountRecord = {
    credentialVersion: 1,
    displayName: 'Administrador OES',
    emailNormalized: 'match-resolution-admin@oes.test',
    failedLoginCount: 0,
    id: '10000000-0000-4000-8000-000000000001',
    loginBlockedUntil: null,
    passwordHash: await hashPassword('frase-segura-de-prueba'),
    role: 'ADMIN',
    status: 'ACTIVE',
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_CONFIG).useValue(config)
    .overrideProvider(IDENTITY_STORE).useValue(new FakeIdentityStore(account))
    .overrideProvider(RESULTS_STORE).useValue(store)
    .compile();
  app = module.createNestApplication();
  configureApp(app, config);
  await app.init();

  const login = await request(app.getHttpServer() as Server)
    .post('/api/v1/auth/login')
    .set('Origin', config.webOrigin)
    .send({ email: account.emailNormalized, password: 'frase-segura-de-prueba' })
    .expect(200);
  const cookies: unknown = login.headers['set-cookie'];
  const body: unknown = login.body;
  if (
    !Array.isArray(cookies) ||
    typeof cookies[0] !== 'string' ||
    typeof body !== 'object' ||
    body === null ||
    !('csrfToken' in body) ||
    typeof body.csrfToken !== 'string'
  ) {
    throw new Error('Expected protected session');
  }
  return {
    Cookie: cookies[0].split(';')[0] ?? '',
    Origin: config.webOrigin,
    'X-CSRF-Token': body.csrfToken,
  };
}

describe('results match-resolution HTTP boundary', () => {
  it('preserves a tied knockout score and penalty shootout as separate input layers', async () => {
    const store = new CapturingResultsStore();
    const headers = await authenticatedHeaders(store);

    await request(app?.getHttpServer() as Server)
      .post(`/api/v1/matches/${matchId}/results`)
      .set({ ...headers, 'Idempotency-Key': 'match-resolution-penalties-0001' })
      .send({
        profile: 'SCORE_BASED',
        scoreA: 2,
        scoreB: 2,
        tieBreak: { method: 'PENALTIES', scoreA: 5, scoreB: 4 },
      })
      .expect(200);

    expect(store.recorded[0]).toMatchObject({
      detail: {
        profile: 'SCORE_BASED',
        scoreA: 2,
        scoreB: 2,
        tieBreak: { method: 'PENALTIES', scoreA: 5, scoreB: 4 },
      },
      idempotencyKey: 'match-resolution-penalties-0001',
      matchId,
    });
  });

  it('preserves NO_SHOW_BOTH as an administrative outcome without a fake score', async () => {
    const store = new CapturingResultsStore();
    const headers = await authenticatedHeaders(store);

    await request(app?.getHttpServer() as Server)
      .post(`/api/v1/matches/${matchId}/results`)
      .set({ ...headers, 'Idempotency-Key': 'match-resolution-no-show-both-0001' })
      .send({ profile: 'ADMINISTRATIVE', outcome: 'NO_SHOW_BOTH' })
      .expect(200);

    expect(store.recorded[0]).toMatchObject({
      detail: { profile: 'ADMINISTRATIVE', outcome: 'NO_SHOW_BOTH' },
      idempotencyKey: 'match-resolution-no-show-both-0001',
      matchId,
    });
    expect(store.recorded[0]?.detail).not.toHaveProperty('scoreA');
    expect(store.recorded[0]?.detail).not.toHaveProperty('scoreB');
  });
});
