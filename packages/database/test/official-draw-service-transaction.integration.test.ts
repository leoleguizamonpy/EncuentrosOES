import { Competition, CompetitionRuleSet, DrawConfiguration } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaCompetitionLockService,
  PrismaCompetitionRepository,
  PrismaCompetitionRuleSetRepository,
  PrismaDrawConfigurationRepository,
  PrismaOfficialDrawService,
} from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const competitionRepository = new PrismaCompetitionRepository(client);
const ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
const drawRepository = new PrismaDrawConfigurationRepository(client);
const lockService = new PrismaCompetitionLockService(client);
const service = new PrismaOfficialDrawService(client);
const occurredAt = new Date('2026-08-21T21:00:00.000Z');

const ids = {
  actor: '17000000-0000-4000-8000-000000000001',
  confirmer: '17000000-0000-4000-8000-000000000002',
  superadmin: '17000000-0000-4000-8000-000000000003',
  competition: '27000000-0000-4000-8000-000000000001',
  edition: '37000000-0000-4000-8000-000000000001',
  event: '47000000-0000-4000-8000-000000000001',
  sport: '57000000-0000-4000-8000-000000000001',
  modality: '67000000-0000-4000-8000-000000000001',
  institutions: [
    '77000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000002',
    '77000000-0000-4000-8000-000000000003',
    '77000000-0000-4000-8000-000000000004',
  ],
  participants: [
    '87000000-0000-4000-8000-000000000001',
    '87000000-0000-4000-8000-000000000002',
    '87000000-0000-4000-8000-000000000003',
    '87000000-0000-4000-8000-000000000004',
  ],
  ruleSet: '97000000-0000-4000-8000-000000000001',
  configuration: 'a7000000-0000-4000-8000-000000000001',
  rollbackExecution: 'b7000000-0000-4000-8000-000000000001',
  committedExecution: 'b7000000-0000-4000-8000-000000000002',
  selfConfirmedExecution: 'b7000000-0000-4000-8000-000000000003',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seed(): Promise<void> {
  await client.user.createMany({
    data: [
      {
        displayName: 'Administrador Sorteo',
        emailNormalized: 'official-draw-admin@example.test',
        id: ids.actor,
        passwordHash: 'hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        displayName: 'Confirmador Sorteo',
        emailNormalized: 'official-draw-confirm@example.test',
        id: ids.confirmer,
        passwordHash: 'hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        displayName: 'Superadministrador Sorteo',
        emailNormalized: 'official-draw-superadmin@example.test',
        id: ids.superadmin,
        passwordHash: 'hash',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      },
    ],
  });
  await client.edition.create({
    data: {
      createdById: ids.actor,
      id: ids.edition,
      name: 'OES 2026',
      status: 'OPEN',
      updatedById: ids.actor,
      year: 2026,
    },
  });
  await client.event.create({ data: { code: 'OFFICIAL_DRAW_EVENT', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'OFFICIAL_DRAW_FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'OFFICIAL_DRAW_MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({
    data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
  });
  await client.institution.createMany({
    data: ids.institutions.map((id, index) => ({
      code: `OFFICIAL-DRAW-${String(index + 1)}`,
      createdById: ids.actor,
      eventId: ids.event,
      id,
      name: `Colegio ${String(index + 1)}`,
      normalizedName: `colegio ${String(index + 1)}`,
      updatedById: ids.actor,
    })),
  });

  const competition = Competition.create({
    actorId: ids.actor,
    id: ids.competition,
    key: {
      editionId: ids.edition,
      eventId: ids.event,
      modalityId: ids.modality,
      sportId: ids.sport,
    },
    occurredAt,
  });
  for (const [index, participantId] of ids.participants.entries()) {
    const institutionId = ids.institutions[index];
    if (institutionId === undefined) throw new Error('Missing institution fixture.');
    competition.addParticipant({
      actorId: ids.actor,
      displayName: `Colegio ${String(index + 1)}`,
      eventId: ids.event,
      expectedRevision: index + 1,
      id: participantId,
      institutionId,
      occurredAt,
    });
  }
  competition.open({ actorId: ids.actor, expectedRevision: 5, occurredAt });
  await competitionRepository.insert(competition);

  const rules = CompetitionRuleSet.create({
    actorId: ids.actor,
    competitionId: ids.competition,
    id: ids.ruleSet,
    knockoutResolutionCode: 'HIGHER_SCORE',
    metrics: ['PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE'],
    occurredAt,
    outcomes: [
      { code: 'WIN', description: 'Victoria', tablePoints: 3 },
      { code: 'LOSS', description: 'Derrota', tablePoints: 0 },
    ],
    profileConfig: { allowDraws: false, profile: 'SCORE_BASED' },
    resultProfile: 'SCORE_BASED',
    revisionNumber: 1,
    schemaVersion: 1,
    tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'],
  });
  rules.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await ruleSetRepository.insert(rules);

  const configuration = DrawConfiguration.create({
    actorId: ids.actor,
    competitionId: ids.competition,
    formatCode: 'KNOCKOUT',
    groupCount: null,
    id: ids.configuration,
    occurredAt,
    participants: ids.participants.map((id, index) => ({
      byeCount: 0,
      displayName: `Colegio ${String(index + 1)}`,
      id,
    })),
    roundNumber: 1,
    ruleSetId: ids.ruleSet,
  });
  configuration.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await drawRepository.insert(configuration);
  await lockService.lock({
    actorId: ids.actor,
    competitionId: ids.competition,
    drawConfigurationId: ids.configuration,
    expectedRevision: 6,
    occurredAt,
    ruleSetId: ids.ruleSet,
  });
}

integration('PrismaOfficialDrawService transaction-aware', () => {
  beforeEach(async () => {
    await clean();
    await seed();
  });

  afterAll(async () => {
    await clean();
    await client.$disconnect();
  });

  it('rolls back an execution performed inside an outer transaction', async () => {
    await expect(client.$transaction(async (transaction) => {
      const draw = await service.executeInTransaction(transaction, {
        actorId: ids.actor,
        configurationId: ids.configuration,
        executionId: ids.rollbackExecution,
        occurredAt,
        seed: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
      });
      expect(draw.toSnapshot()).toMatchObject({
        id: ids.rollbackExecution,
        revision: 1,
        status: 'PENDING_CONFIRMATION',
      });
      expect(await service.findByIdInTransaction(transaction, ids.rollbackExecution)).not.toBeNull();
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect(await service.findById(ids.rollbackExecution)).toBeNull();
  });

  it('executes, confirms and materializes inside one outer transaction', async () => {
    await client.$transaction(async (transaction) => {
      await service.executeInTransaction(transaction, {
        actorId: ids.actor,
        configurationId: ids.configuration,
        executionId: ids.committedExecution,
        occurredAt,
        seed: Uint8Array.from({ length: 32 }, (_, index) => index + 33),
      });
      const confirmed = await service.confirmInTransaction(transaction, {
        actorId: ids.confirmer,
        executionId: ids.committedExecution,
        expectedRevision: 1,
        occurredAt,
      });
      expect(confirmed.toSnapshot()).toMatchObject({
        confirmedBy: ids.confirmer,
        id: ids.committedExecution,
        revision: 2,
        status: 'CONFIRMED',
      });
      expect(await transaction.logicalMatch.count({ where: { executionId: ids.committedExecution } })).toBe(2);
    });

    expect((await service.findById(ids.committedExecution))?.toSnapshot()).toMatchObject({
      revision: 2,
      status: 'CONFIRMED',
    });
    expect(await client.logicalMatch.count({ where: { executionId: ids.committedExecution } })).toBe(2);
  });

  it('lets an active SUPERADMIN execute and explicitly confirm the same official draw', async () => {
    await service.execute({
      actorId: ids.superadmin,
      configurationId: ids.configuration,
      executionId: ids.selfConfirmedExecution,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index + 65),
    });

    const confirmed = await service.confirm({
      actorId: ids.superadmin,
      executionId: ids.selfConfirmedExecution,
      expectedRevision: 1,
      occurredAt,
    });

    expect(confirmed.toSnapshot()).toMatchObject({
      confirmedBy: ids.superadmin,
      executedBy: ids.superadmin,
      id: ids.selfConfirmedExecution,
      revision: 2,
      status: 'CONFIRMED',
    });
    expect(await client.logicalMatch.count({ where: { executionId: ids.selfConfirmedExecution } })).toBe(2);
  });
});
