import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import {
  COMPETITION_STORE,
  type AddStoredParticipantInput,
  type CompetitionCatalog,
  type CompetitionDetail,
  type CompetitionStore,
  type CompetitionSummary,
  type ConfigureStoredFormatInput,
  type CreateStoredCompetitionInput,
} from '../src/competitions/competition-store.js';
import { API_CONFIG, type ApiConfig } from '../src/config.js';
import { IDENTITY_STORE, type AccountRecord, type AccountRole } from '../src/identity/identity-store.js';
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

const ids = {
  edition: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
  modality: '60000000-0000-4000-8000-000000000001',
  sport: '80000000-0000-4000-8000-000000000001',
};

const edition = { id: ids.edition, name: 'OES 2026', year: 2026 };
const combination = {
    event: { code: 'COLEGIALES', id: ids.event, name: 'Colegiales' },
    modality: { code: 'MALE', id: ids.modality, name: 'Masculina' },
    sport: { code: 'FUTSAL', id: ids.sport, name: 'Futsal' },
};
const catalog: CompetitionCatalog = {
  combinations: [combination],
  editions: [edition],
};
const institution = { code: 'CN1', id: '70000000-0000-4000-8000-000000000001', name: 'Colegio Nacional', selected: false };

function detail(revision = 1): CompetitionDetail {
  return {
    createdAt: '2026-08-13T18:00:00.000Z',
    edition,
    event: combination.event,
    formatCode: null,
    groupCount: null,
    id: '20000000-0000-4000-8000-000000000001',
    institutions: [institution],
    modality: combination.modality,
    participantCount: 0,
    participants: [],
    revision,
    sport: combination.sport,
    status: 'DRAFT',
    validGroupCounts: [],
  };
}

class FakeCompetitionStore implements CompetitionStore {
  public readonly created: CreateStoredCompetitionInput[] = [];
  public readonly participantInputs: AddStoredParticipantInput[] = [];
  public readonly formatInputs: ConfigureStoredFormatInput[] = [];

  public catalog(): Promise<CompetitionCatalog> { return Promise.resolve(catalog); }
  public list(): Promise<readonly CompetitionSummary[]> { return Promise.resolve([]); }
  public detail(): Promise<CompetitionDetail> { return Promise.resolve(detail()); }
  public addParticipant(input: AddStoredParticipantInput): Promise<CompetitionDetail> {
    this.participantInputs.push(input);
    return Promise.resolve({ ...detail(2), institutions: [{ ...institution, selected: true }], participantCount: 1, participants: [{ displayName: institution.name, enabledAt: '2026-08-13T18:01:00.000Z', id: '71000000-0000-4000-8000-000000000001', institutionId: institution.id, status: 'ENABLED' }] });
  }
  public configureFormat(input: ConfigureStoredFormatInput): Promise<CompetitionDetail> {
    this.formatInputs.push(input);
    return Promise.resolve({ ...detail(2), formatCode: input.formatCode, groupCount: input.groupCount });
  }
  public create(input: CreateStoredCompetitionInput): Promise<CompetitionSummary> {
    this.created.push(input);
    return Promise.resolve({
      createdAt: '2026-08-13T18:00:00.000Z',
      edition,
      event: combination.event,
      formatCode: null,
      groupCount: null,
      id: '20000000-0000-4000-8000-000000000001',
      modality: combination.modality,
      participantCount: 0,
      revision: 1,
      sport: combination.sport,
      status: 'DRAFT',
    });
  }
}

interface RunningApplication {
  readonly app: INestApplication;
  readonly store: FakeCompetitionStore;
}

const applications: INestApplication[] = [];

async function start(role: AccountRole): Promise<RunningApplication> {
  const account: AccountRecord = {
    credentialVersion: 1,
    displayName: 'Autoridad OES',
    emailNormalized: 'autoridad@oes.test',
    failedLoginCount: 0,
    id: '10000000-0000-4000-8000-000000000001',
    loginBlockedUntil: null,
    passwordHash: await hashPassword('frase-segura-de-prueba'),
    role,
    status: 'ACTIVE',
  };
  const identityStore = new FakeIdentityStore(account);
  const competitionStore = new FakeCompetitionStore();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_CONFIG).useValue(config)
    .overrideProvider(IDENTITY_STORE).useValue(identityStore)
    .overrideProvider(COMPETITION_STORE).useValue(competitionStore)
    .compile();
  const app = module.createNestApplication();
  configureApp(app, config);
  await app.init();
  applications.push(app);
  return { app, store: competitionStore };
}

async function authenticate(app: INestApplication): Promise<{ csrf: string; session: string }> {
  const response = await request(server(app))
    .post('/api/v1/auth/login')
    .set('Origin', config.webOrigin)
    .send({ email: 'autoridad@oes.test', password: 'frase-segura-de-prueba' })
    .expect(200);
  const cookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('Expected cookies');
  const body: unknown = response.body;
  if (typeof body !== 'object' || body === null || !('csrfToken' in body)) throw new Error('Expected response body');
  const csrf: unknown = body.csrfToken;
  if (typeof csrf !== 'string') throw new Error('Expected CSRF token');
  const session = cookies[0].split(';')[0];
  if (session === undefined) throw new Error('Expected session cookie');
  return { csrf, session };
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe('competitions HTTP boundary', () => {
  it('lists the authorized catalog and persisted competitions', async () => {
    const { app } = await start('OPERATOR');
    const auth = await authenticate(app);
    await request(server(app)).get('/api/v1/competitions/catalog').set('Cookie', auth.session).expect(200).expect(catalog);
    await request(server(app)).get('/api/v1/competitions').set('Cookie', auth.session).expect(200).expect([]);
  });

  it('creates a competition with CSRF, role and idempotency evidence', async () => {
    const { app, store } = await start('ADMIN');
    const auth = await authenticate(app);
    const selection = { editionId: ids.edition, eventId: ids.event, modalityId: ids.modality, sportId: ids.sport };
    await request(server(app))
      .post('/api/v1/competitions')
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .send(selection)
      .expect(400);
    await request(server(app))
      .post('/api/v1/competitions')
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'competition-create-0001')
      .send(selection)
      .expect(201)
      .expect((response) => expect(response.body).toMatchObject({ status: 'DRAFT', revision: 1 }));
    expect(store.created).toHaveLength(1);
    expect(store.created[0]).toMatchObject({ actorRole: 'ADMIN', idempotencyKey: 'competition-create-0001' });
  });

  it('keeps operators read-only', async () => {
    const { app, store } = await start('OPERATOR');
    const auth = await authenticate(app);
    await request(server(app))
      .post('/api/v1/competitions')
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'competition-create-0002')
      .send({ editionId: ids.edition, eventId: ids.event, modalityId: ids.modality, sportId: ids.sport })
      .expect(403);
    expect(store.created).toHaveLength(0);
  });

  it('loads setup details and lets administrators add a participant', async () => {
    const { app, store } = await start('ADMIN');
    const auth = await authenticate(app);
    await request(server(app))
      .get('/api/v1/competitions/20000000-0000-4000-8000-000000000001')
      .set('Cookie', auth.session)
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ revision: 1, institutions: [institution] }));
    await request(server(app))
      .post('/api/v1/competitions/20000000-0000-4000-8000-000000000001/participants')
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'participant-add-0001')
      .send({ expectedRevision: 1, institutionId: institution.id })
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ participantCount: 1, revision: 2 }));
    expect(store.participantInputs[0]).toMatchObject({ actorRole: 'ADMIN', expectedRevision: 1, institutionId: institution.id });
  });

  it('configures the selected format and keeps operators from mutating setup', async () => {
    const admin = await start('SUPERADMIN');
    const adminAuth = await authenticate(admin.app);
    await request(server(admin.app))
      .patch('/api/v1/competitions/20000000-0000-4000-8000-000000000001/format')
      .set('Cookie', adminAuth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', adminAuth.csrf)
      .set('Idempotency-Key', 'format-configure-0001')
      .send({ expectedRevision: 1, formatCode: 'KNOCKOUT', groupCount: null })
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ formatCode: 'KNOCKOUT', groupCount: null }));
    expect(admin.store.formatInputs[0]).toMatchObject({ actorRole: 'SUPERADMIN', formatCode: 'KNOCKOUT' });

    const operator = await start('OPERATOR');
    const operatorAuth = await authenticate(operator.app);
    await request(server(operator.app))
      .patch('/api/v1/competitions/20000000-0000-4000-8000-000000000001/format')
      .set('Cookie', operatorAuth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', operatorAuth.csrf)
      .set('Idempotency-Key', 'format-configure-0002')
      .send({ expectedRevision: 1, formatCode: 'KNOCKOUT', groupCount: null })
      .expect(403);
    expect(operator.store.formatInputs).toHaveLength(0);
  });
});

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}
