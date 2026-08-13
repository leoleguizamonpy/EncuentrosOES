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
  type FreezeStoredRuleSetInput,
  type SaveStoredRuleSetInput,
} from '../src/competitions/competition-store.js';
import { API_CONFIG, type ApiConfig } from '../src/config.js';
import {
  DRAW_STORE,
  type AnnulDrawInput,
  type ConfirmDrawInput,
  type DrawStore,
  type DrawWorkspace,
  type ExecuteDrawInput,
  type PrepareDrawInput,
} from '../src/draws/draw-store.js';
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
    ruleSet: null,
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
  public readonly ruleInputs: SaveStoredRuleSetInput[] = [];
  public readonly freezeInputs: FreezeStoredRuleSetInput[] = [];

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
  public saveRuleSet(input: SaveStoredRuleSetInput): Promise<CompetitionDetail> {
    this.ruleInputs.push(input);
    return Promise.resolve({
      ...detail(),
      ruleSet: { ...input, canonicalHash: null, frozenAt: null, id: '22000000-0000-4000-8000-000000000001', revision: 1, status: 'DRAFT' },
    });
  }
  public freezeRuleSet(input: FreezeStoredRuleSetInput): Promise<CompetitionDetail> {
    this.freezeInputs.push(input);
    return Promise.resolve({
      ...detail(),
      ruleSet: {
        allowDraws: true,
        canonicalHash: 'a'.repeat(64),
        drawPoints: 1,
        frozenAt: '2026-08-13T18:02:00.000Z',
        id: '22000000-0000-4000-8000-000000000001',
        lossPoints: 0,
        resultProfile: 'SCORE_BASED',
        revision: 2,
        status: 'FROZEN',
        tieBreakCriteria: ['TABLE_POINTS', 'WINS'],
        winPoints: 3,
      },
    });
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

function drawWorkspace(state: 'CONFIRMED' | 'EMPTY' | 'PENDING' | 'PREPARED'): DrawWorkspace {
  const configuration = state === 'EMPTY' ? null : {
    canonicalHash: 'a'.repeat(64), formatCode: 'GROUP_STAGE' as const, groupCount: 1,
    id: 'a0000000-0000-4000-8000-000000000001', participantCount: 3, revision: 2,
    roundNumber: 0, status: 'FROZEN' as const,
  };
  const execution = state === 'PENDING' || state === 'CONFIRMED' ? {
    confirmedAt: state === 'CONFIRMED' ? '2026-08-13T18:03:00.000Z' : null,
    confirmedBy: state === 'CONFIRMED' ? { displayName: 'Segunda autoridad', id: '10000000-0000-4000-8000-000000000002' } : null,
    evidenceHash: 'b'.repeat(64), executedAt: '2026-08-13T18:02:00.000Z',
    executedBy: { displayName: 'Autoridad OES', id: '10000000-0000-4000-8000-000000000001' },
    id: 'b0000000-0000-4000-8000-000000000001', matchCount: state === 'CONFIRMED' ? 3 : 0,
    result: { formatCode: 'GROUP_STAGE' as const, groups: [{ label: 'A', members: [], ordinal: 1 }] },
    revision: state === 'CONFIRMED' ? 2 : 1, seedCommitment: 'c'.repeat(64),
    seedHex: state === 'CONFIRMED' ? 'd'.repeat(64) : null, status: state === 'CONFIRMED' ? 'CONFIRMED' as const : 'PENDING_CONFIRMATION' as const,
  } : null;
  return { competitionId: detail().id, competitionRevision: state === 'EMPTY' ? 1 : 3, competitionStatus: state === 'EMPTY' ? 'DRAFT' : 'LOCKED', configuration, execution };
}

class FakeDrawStore implements DrawStore {
  public readonly annulled: AnnulDrawInput[] = [];
  public readonly prepared: PrepareDrawInput[] = [];
  public readonly executed: ExecuteDrawInput[] = [];
  public readonly confirmed: ConfirmDrawInput[] = [];
  public workspace(): Promise<DrawWorkspace> { return Promise.resolve(drawWorkspace('EMPTY')); }
  public prepare(input: PrepareDrawInput): Promise<DrawWorkspace> { this.prepared.push(input); return Promise.resolve(drawWorkspace('PREPARED')); }
  public execute(input: ExecuteDrawInput): Promise<DrawWorkspace> { this.executed.push(input); return Promise.resolve(drawWorkspace('PENDING')); }
  public confirm(input: ConfirmDrawInput): Promise<DrawWorkspace> { this.confirmed.push(input); return Promise.resolve(drawWorkspace('CONFIRMED')); }
  public annul(input: AnnulDrawInput): Promise<DrawWorkspace> { this.annulled.push(input); return Promise.resolve(drawWorkspace('PREPARED')); }
}

interface RunningApplication {
  readonly app: INestApplication;
  readonly drawStore: FakeDrawStore;
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
  const drawStore = new FakeDrawStore();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_CONFIG).useValue(config)
    .overrideProvider(IDENTITY_STORE).useValue(identityStore)
    .overrideProvider(COMPETITION_STORE).useValue(competitionStore)
    .overrideProvider(DRAW_STORE).useValue(drawStore)
    .compile();
  const app = module.createNestApplication();
  configureApp(app, config);
  await app.init();
  applications.push(app);
  return { app, drawStore, store: competitionStore };
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

  it('saves and freezes an ordered scoring template with authority evidence', async () => {
    const { app, store } = await start('ADMIN');
    const auth = await authenticate(app);
    const path = '/api/v1/competitions/20000000-0000-4000-8000-000000000001/rules';
    await request(server(app))
      .patch(path)
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'rule-set-save-0001')
      .send({ allowDraws: true, drawPoints: 1, expectedRevision: null, lossPoints: 0, resultProfile: 'SCORE_BASED', tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'], winPoints: 3 })
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ ruleSet: { revision: 1, status: 'DRAFT' } }));
    expect(store.ruleInputs[0]).toMatchObject({ actorRole: 'ADMIN', expectedRevision: null, winPoints: 3 });

    await request(server(app))
      .post(`${path}/freeze`)
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'rule-set-freeze-0001')
      .send({ expectedRevision: 1 })
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ ruleSet: { revision: 2, status: 'FROZEN' } }));
    expect(store.freezeInputs[0]).toMatchObject({ actorRole: 'ADMIN', expectedRevision: 1 });
  });

  it('keeps operators from changing scoring rules', async () => {
    const { app, store } = await start('OPERATOR');
    const auth = await authenticate(app);
    await request(server(app))
      .patch('/api/v1/competitions/20000000-0000-4000-8000-000000000001/rules')
      .set('Cookie', auth.session)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'rule-set-save-0002')
      .send({ allowDraws: false, drawPoints: null, expectedRevision: null, lossPoints: 0, resultProfile: 'SCORE_BASED', tieBreakCriteria: ['TABLE_POINTS'], winPoints: 3 })
      .expect(403);
    expect(store.ruleInputs).toHaveLength(0);
  });

  it('prepares, executes and confirms the persisted official draw through revisioned boundaries', async () => {
    const { app, drawStore } = await start('ADMIN');
    const auth = await authenticate(app);
    const common = (key: string) => ({ Cookie: auth.session, Origin: config.webOrigin, 'X-CSRF-Token': auth.csrf, 'Idempotency-Key': key });
    await request(server(app)).post(`/api/v1/competitions/${detail().id}/draw-workspace/prepare`)
      .set(common('draw-prepare-0001')).send({ expectedRevision: 1 }).expect(200)
      .expect((response) => expect(response.body).toMatchObject({ competitionStatus: 'LOCKED', configuration: { status: 'FROZEN' } }));
    await request(server(app)).post('/api/v1/draw-configurations/a0000000-0000-4000-8000-000000000001/execute')
      .set(common('draw-execute-0001')).send({ expectedRevision: 2 }).expect(200)
      .expect((response) => expect(response.body).toMatchObject({ execution: { status: 'PENDING_CONFIRMATION' } }));
    await request(server(app)).post('/api/v1/official-draws/b0000000-0000-4000-8000-000000000001/confirm')
      .set(common('draw-confirm-0001')).send({ expectedRevision: 1 }).expect(200)
      .expect((response) => expect(response.body).toMatchObject({ execution: { matchCount: 3, status: 'CONFIRMED' } }));
    expect(drawStore.prepared[0]).toMatchObject({ actorRole: 'ADMIN', expectedRevision: 1 });
    expect(drawStore.executed[0]).toMatchObject({ expectedRevision: 2 });
    expect(drawStore.confirmed[0]).toMatchObject({ expectedRevision: 1 });
  });

  it('only lets a superadministrator annul a confirmed draw with a reason', async () => {
    const superadmin = await start('SUPERADMIN');
    const auth = await authenticate(superadmin.app);
    const path = '/api/v1/official-draws/b0000000-0000-4000-8000-000000000001/annul';
    const headers = { Cookie: auth.session, Origin: config.webOrigin, 'X-CSRF-Token': auth.csrf, 'Idempotency-Key': 'draw-annul-0000001' };
    await request(server(superadmin.app)).post(path).set(headers)
      .send({ expectedRevision: 2, reason: 'La nómina oficial contenía un participante incorrecto.' })
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ execution: null }));
    expect(superadmin.drawStore.annulled[0]).toMatchObject({
      actorRole: 'SUPERADMIN', expectedRevision: 2,
      reason: 'La nómina oficial contenía un participante incorrecto.',
    });

    const admin = await start('ADMIN');
    const adminAuth = await authenticate(admin.app);
    await request(server(admin.app)).post(path)
      .set({ Cookie: adminAuth.session, Origin: config.webOrigin, 'X-CSRF-Token': adminAuth.csrf, 'Idempotency-Key': 'draw-annul-0000002' })
      .send({ expectedRevision: 2, reason: 'Intento de anulación sin autoridad suficiente.' })
      .expect(403);
    expect(admin.drawStore.annulled).toHaveLength(0);
  });
});

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}
