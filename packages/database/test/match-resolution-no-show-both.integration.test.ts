import { Competition, CompetitionRuleSet, DrawConfiguration } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaCompetitionLockService,
  PrismaCompetitionRepository,
  PrismaCompetitionRuleSetRepository,
  PrismaDrawConfigurationRepository,
  PrismaMatchResultService,
  PrismaNextRoundService,
  PrismaOfficialDrawService,
} from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const competitionRepository = new PrismaCompetitionRepository(client);
const ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
const drawRepository = new PrismaDrawConfigurationRepository(client);
const lockService = new PrismaCompetitionLockService(client);
const drawService = new PrismaOfficialDrawService(client);
const resultService = new PrismaMatchResultService(client);
const nextRoundService = new PrismaNextRoundService(client);
const occurredAt = new Date('2026-08-24T12:00:00.000Z');

const ids = {
  actor: '14000000-0000-4000-8000-000000000001',
  confirmer: '14000000-0000-4000-8000-000000000002',
  competition: '24000000-0000-4000-8000-000000000001',
  edition: '34000000-0000-4000-8000-000000000001',
  event: '44000000-0000-4000-8000-000000000001',
  sport: '54000000-0000-4000-8000-000000000001',
  modality: '64000000-0000-4000-8000-000000000001',
  institutions: [
    '74000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000002',
    '74000000-0000-4000-8000-000000000003',
    '74000000-0000-4000-8000-000000000004',
  ],
  participants: [
    '84000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000002',
    '84000000-0000-4000-8000-000000000003',
    '84000000-0000-4000-8000-000000000004',
  ],
  ruleSet: '94000000-0000-4000-8000-000000000001',
  configuration: 'a4000000-0000-4000-8000-000000000001',
  execution: 'b4000000-0000-4000-8000-000000000001',
  results: [
    'c4000000-0000-4000-8000-000000000001',
    'c4000000-0000-4000-8000-000000000002',
  ],
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seed(): Promise<void> {
  await client.user.createMany({ data: [
    {
      displayName: 'Administrador Uno',
      emailNormalized: 'double-no-show-admin@example.test',
      id: ids.actor,
      passwordHash: 'hash',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      displayName: 'Administrador Dos',
      emailNormalized: 'double-no-show-confirmer@example.test',
      id: ids.confirmer,
      passwordHash: 'hash',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  ] });
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
  await client.event.create({ data: { code: 'DOUBLE_NO_SHOW_EVENT', id: ids.event, name: 'Universitarios' } });
  await client.sport.create({ data: { code: 'DOUBLE_NO_SHOW_FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'DOUBLE_NO_SHOW_MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({
    data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
  });
  await client.institution.createMany({
    data: ids.institutions.map((id, index) => ({
      code: `DOUBLE-NO-SHOW-${String(index + 1)}`,
      createdById: ids.actor,
      eventId: ids.event,
      id,
      name: `Universidad ${String(index + 1)}`,
      normalizedName: `universidad ${String(index + 1)}`,
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
      displayName: `Universidad ${String(index + 1)}`,
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
    metrics: [
      'PLAYED',
      'WINS',
      'LOSSES',
      'TABLE_POINTS',
      'SCORE_FOR',
      'SCORE_AGAINST',
      'SCORE_DIFFERENCE',
    ],
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
      displayName: `Universidad ${String(index + 1)}`,
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

integration('match resolution double no-show persistence', () => {
  beforeEach(async () => {
    await clean();
    await seed();
  });

  afterAll(async () => {
    await clean();
    await client.$disconnect();
  });

  it('excludes both absent participants and refuses to create a one-participant next round', async () => {
    await drawService.execute({
      actorId: ids.actor,
      configurationId: ids.configuration,
      executionId: ids.execution,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
    });
    await drawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.execution,
      expectedRevision: 1,
      occurredAt,
    });

    const matches = await client.logicalMatch.findMany({
      orderBy: { ordinal: 'asc' },
      where: { executionId: ids.execution },
    });
    expect(matches).toHaveLength(2);

    const firstMatch = matches[0];
    const secondMatch = matches[1];
    if (firstMatch === undefined || secondMatch === undefined) {
      throw new Error('Expected two knockout matches.');
    }

    await resultService.record({
      actorId: ids.actor,
      detail: { profile: 'ADMINISTRATIVE', outcome: 'NO_SHOW_BOTH' },
      matchId: firstMatch.id,
      occurredAt: new Date(occurredAt.getTime() + 60_000),
      resultId: ids.results[0],
    });
    await resultService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 90_000),
      resultId: ids.results[0],
    });

    await resultService.record({
      actorId: ids.actor,
      detail: { profile: 'ADMINISTRATIVE', outcome: 'NO_SHOW_B' },
      matchId: secondMatch.id,
      occurredAt: new Date(occurredAt.getTime() + 120_000),
      resultId: ids.results[1],
    });
    await resultService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 150_000),
      resultId: ids.results[1],
    });

    const doubleNoShow = await client.matchResult.findUniqueOrThrow({
      where: { id: ids.results[0] },
    });
    expect(doubleNoShow.detailJson).toMatchObject({
      profile: 'ADMINISTRATIVE',
      outcome: 'NO_SHOW_BOTH',
    });
    expect(doubleNoShow.resolvedJson).toMatchObject({
      administrativeOutcome: 'NO_SHOW_BOTH',
      sportingMetricsCounted: false,
      tablePointsA: 0,
      tablePointsB: 0,
      winnerParticipantId: null,
    });
    expect(await client.logicalMatch.findUniqueOrThrow({ where: { id: firstMatch.id } })).toMatchObject({
      status: 'RESULT_CONFIRMED',
      winnerParticipantId: null,
    });

    await expect(nextRoundService.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: 'd4000000-0000-4000-8000-000000000001',
      expectedCompetitionRevision: 7,
      occurredAt: new Date(occurredAt.getTime() + 180_000),
    })).rejects.toMatchObject({ code: 'DRAW_CONFIGURATION_INCOMPATIBLE' });

    expect(await client.drawConfiguration.count({
      where: {
        competitionId: ids.competition,
        formatCode: 'KNOCKOUT',
        roundNumber: 2,
      },
    })).toBe(0);
    expect(await client.competition.findUniqueOrThrow({ where: { id: ids.competition } })).toMatchObject({
      revision: 7,
      status: 'LOCKED',
    });
  });
});
