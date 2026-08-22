import { Competition, CompetitionRuleSet, DrawConfiguration } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaCompetitionRepository,
  PrismaCompetitionRuleSetRepository,
  PrismaDrawConfigurationRepository,
} from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const competitionRepository = new PrismaCompetitionRepository(client);
const ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
const repository = new PrismaDrawConfigurationRepository(client);
const occurredAt = new Date('2026-08-21T20:00:00.000Z');

const ids = {
  actor: '16000000-0000-4000-8000-000000000001',
  competition: '26000000-0000-4000-8000-000000000001',
  edition: '36000000-0000-4000-8000-000000000001',
  event: '46000000-0000-4000-8000-000000000001',
  sport: '56000000-0000-4000-8000-000000000001',
  modality: '66000000-0000-4000-8000-000000000001',
  institutions: [
    '76000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000002',
    '76000000-0000-4000-8000-000000000003',
    '76000000-0000-4000-8000-000000000004',
  ],
  participants: [
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000003',
    '86000000-0000-4000-8000-000000000004',
  ],
  ruleSet: '96000000-0000-4000-8000-000000000001',
  rollbackConfiguration: 'a6000000-0000-4000-8000-000000000001',
  committedConfiguration: 'a6000000-0000-4000-8000-000000000002',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seed(): Promise<void> {
  await client.user.create({
    data: {
      displayName: 'Administrador Sorteos',
      emailNormalized: 'draw-transaction@example.test',
      id: ids.actor,
      passwordHash: 'hash',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
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
  await client.event.create({ data: { code: 'DRAW_TX_EVENT', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'DRAW_TX_FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'DRAW_TX_MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({
    data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
  });
  await client.institution.createMany({
    data: ids.institutions.map((id, index) => ({
      code: `DRAW-TX-${String(index + 1)}`,
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
}

function configuration(id: string): DrawConfiguration {
  return DrawConfiguration.create({
    actorId: ids.actor,
    competitionId: ids.competition,
    formatCode: 'KNOCKOUT',
    groupCount: null,
    id,
    occurredAt,
    participants: ids.participants.map((participantId, index) => ({
      byeCount: index === 0 ? 1 : 0,
      displayName: `Colegio ${String(index + 1)}`,
      id: participantId,
    })),
    roundNumber: 1,
    ruleSetId: ids.ruleSet,
  });
}

integration('PrismaDrawConfigurationRepository transaction-aware', () => {
  beforeEach(async () => {
    await clean();
    await seed();
  });

  afterAll(async () => {
    await clean();
    await client.$disconnect();
  });

  it('rolls back an insert performed inside an outer transaction', async () => {
    await expect(client.$transaction(async (transaction) => {
      const aggregate = configuration(ids.rollbackConfiguration);
      await repository.insertInTransaction(transaction, aggregate);
      const inside = await repository.findByIdInTransaction(transaction, ids.rollbackConfiguration);
      expect(inside?.toSnapshot()).toMatchObject({
        id: ids.rollbackConfiguration,
        participantCount: 4,
        revision: 1,
        status: 'DRAFT',
      });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect(await repository.findById(ids.rollbackConfiguration)).toBeNull();
  });

  it('reads, freezes and saves inside the same outer transaction', async () => {
    await client.$transaction(async (transaction) => {
      const aggregate = configuration(ids.committedConfiguration);
      await repository.insertInTransaction(transaction, aggregate);
      const persisted = await repository.findByIdInTransaction(transaction, ids.committedConfiguration);
      if (persisted === null) throw new Error('Expected draw configuration inside transaction.');

      persisted.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
      await repository.saveInTransaction(transaction, persisted, 1);

      const saved = await repository.findByIdInTransaction(transaction, ids.committedConfiguration);
      expect(saved?.toSnapshot()).toMatchObject({
        id: ids.committedConfiguration,
        participantCount: 4,
        participants: [
          { byeCount: 1, displayName: 'Colegio 1', id: ids.participants[0] },
          { byeCount: 0, displayName: 'Colegio 2', id: ids.participants[1] },
          { byeCount: 0, displayName: 'Colegio 3', id: ids.participants[2] },
          { byeCount: 0, displayName: 'Colegio 4', id: ids.participants[3] },
        ],
        revision: 2,
        status: 'FROZEN',
      });
    });

    expect((await repository.findById(ids.committedConfiguration))?.toSnapshot()).toMatchObject({
      revision: 2,
      status: 'FROZEN',
    });
  });
});
