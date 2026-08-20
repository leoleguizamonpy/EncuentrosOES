import { Competition, CompetitionRuleSet, DrawConfiguration } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaChampionFinalizationService,
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
const championService = new PrismaChampionFinalizationService(client);
const occurredAt = new Date('2026-08-19T19:00:00.000Z');

const ids = {
  actor: '13000000-0000-4000-8000-000000000001',
  confirmer: '13000000-0000-4000-8000-000000000002',
  competition: '23000000-0000-4000-8000-000000000001',
  edition: '33000000-0000-4000-8000-000000000001',
  event: '43000000-0000-4000-8000-000000000001',
  sport: '53000000-0000-4000-8000-000000000001',
  modality: '63000000-0000-4000-8000-000000000001',
  institutions: [
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000002',
    '73000000-0000-4000-8000-000000000003',
    '73000000-0000-4000-8000-000000000004',
  ],
  participants: [
    '83000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000003',
    '83000000-0000-4000-8000-000000000004',
  ],
  ruleSet: '93000000-0000-4000-8000-000000000001',
  roundOneConfiguration: 'a3000000-0000-4000-8000-000000000001',
  roundOneExecution: 'b3000000-0000-4000-8000-000000000001',
  finalExecution: 'b3000000-0000-4000-8000-000000000002',
  semifinalResults: [
    'c3000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
  ],
  finalResult: 'c3000000-0000-4000-8000-000000000003',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seed(): Promise<void> {
  await client.user.createMany({ data: [
    { displayName: 'Administrador Uno', emailNormalized: 'direct-admin@example.test', id: ids.actor, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
    { displayName: 'Administrador Dos', emailNormalized: 'direct-confirmer@example.test', id: ids.confirmer, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
  ] });
  await client.edition.create({ data: { createdById: ids.actor, id: ids.edition, name: 'OES 2026', status: 'OPEN', updatedById: ids.actor, year: 2026 } });
  await client.event.create({ data: { code: 'DIRECT_EVENT', id: ids.event, name: 'Universitarios' } });
  await client.sport.create({ data: { code: 'DIRECT_FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'DIRECT_MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({ data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport } });
  await client.institution.createMany({ data: ids.institutions.map((id, index) => ({
    code: `DIRECT-${String(index + 1)}`,
    createdById: ids.actor,
    eventId: ids.event,
    id,
    name: `Universidad ${String(index + 1)}`,
    normalizedName: `universidad ${String(index + 1)}`,
    updatedById: ids.actor,
  })) });

  const competition = Competition.create({
    actorId: ids.actor,
    id: ids.competition,
    key: { editionId: ids.edition, eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
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
    id: ids.roundOneConfiguration,
    occurredAt,
    participants: ids.participants.map((id, index) => ({ byeCount: 0, displayName: `Universidad ${String(index + 1)}`, id })),
    roundNumber: 1,
    ruleSetId: ids.ruleSet,
  });
  configuration.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await drawRepository.insert(configuration);
  await lockService.lock({
    actorId: ids.actor,
    competitionId: ids.competition,
    drawConfigurationId: ids.roundOneConfiguration,
    expectedRevision: 6,
    occurredAt,
    ruleSetId: ids.ruleSet,
  });
}

integration('direct knockout lifecycle', () => {
  beforeEach(async () => { await clean(); await seed(); });
  afterAll(async () => { await clean(); await client.$disconnect(); });

  it('re-draws confirmed semifinal winners and finalizes the final winner', async () => {
    await drawService.execute({
      actorId: ids.actor,
      configurationId: ids.roundOneConfiguration,
      executionId: ids.roundOneExecution,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
    });
    await drawService.confirm({ actorId: ids.confirmer, executionId: ids.roundOneExecution, expectedRevision: 1, occurredAt });

    const semifinals = await client.logicalMatch.findMany({ orderBy: { ordinal: 'asc' }, where: { executionId: ids.roundOneExecution } });
    expect(semifinals).toHaveLength(2);
    for (const [index, match] of semifinals.entries()) {
      const resultId = ids.semifinalResults[index];
      if (resultId === undefined) throw new Error('Unexpected semifinal count.');
      await resultService.record({
        actorId: ids.actor,
        detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 },
        matchId: match.id,
        occurredAt: new Date(occurredAt.getTime() + (index + 1) * 60_000),
        resultId,
      });
      await resultService.confirm({
        actorId: ids.confirmer,
        expectedRevision: 1,
        occurredAt: new Date(occurredAt.getTime() + (index + 1) * 60_000 + 30_000),
        resultId,
      });
    }

    const preparedFinal = await nextRoundService.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: 'd3000000-0000-4000-8000-000000000001',
      expectedCompetitionRevision: 7,
      occurredAt: new Date(occurredAt.getTime() + 4 * 60_000),
    });
    expect(preparedFinal).toMatchObject({
      competitionRevision: 8,
      configuration: { formatCode: 'KNOCKOUT', participantCount: 2, roundNumber: 2, status: 'FROZEN' },
    });
    expect(new Set(preparedFinal.configuration.participants.map(({ id }) => id))).toEqual(new Set(semifinals.map(({ participantAId }) => participantAId)));

    await drawService.execute({
      actorId: ids.actor,
      configurationId: preparedFinal.configuration.id,
      executionId: ids.finalExecution,
      occurredAt: new Date(occurredAt.getTime() + 5 * 60_000),
      seed: Uint8Array.from({ length: 32 }, (_, index) => 32 - index),
    });
    await drawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.finalExecution,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 6 * 60_000),
    });

    const final = await client.logicalMatch.findFirstOrThrow({ where: { executionId: ids.finalExecution } });
    await resultService.record({
      actorId: ids.actor,
      detail: { profile: 'SCORE_BASED', scoreA: 1, scoreB: 3 },
      matchId: final.id,
      occurredAt: new Date(occurredAt.getTime() + 7 * 60_000),
      resultId: ids.finalResult,
    });
    await resultService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 8 * 60_000),
      resultId: ids.finalResult,
    });

    const proposal = await championService.propose({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: 'd3000000-0000-4000-8000-000000000002',
      expectedCompetitionRevision: 8,
      occurredAt: new Date(occurredAt.getTime() + 9 * 60_000),
    });
    expect(proposal).toMatchObject({ participantId: final.participantBId, sourceRoundNumber: 2, status: 'PENDING_CONFIRMATION' });

    const champion = await championService.confirm({
      actorId: ids.confirmer,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: 'd3000000-0000-4000-8000-000000000003',
      expectedCompetitionRevision: 9,
      occurredAt: new Date(occurredAt.getTime() + 10 * 60_000),
      proposalId: proposal.proposalId,
    });
    expect(champion).toMatchObject({ competitionRevision: 10, participantId: final.participantBId, status: 'CONFIRMED' });
    expect(await client.competition.findUniqueOrThrow({ where: { id: ids.competition } })).toMatchObject({ revision: 10, status: 'FINALIZED' });
    expect(await client.drawConfiguration.count({ where: { competitionId: ids.competition, formatCode: 'KNOCKOUT' } })).toBe(2);
    expect(await client.officialDraw.count({ where: { competitionId: ids.competition, status: 'CONFIRMED' } })).toBe(2);
    expect(await client.matchResult.count({ where: { competitionId: ids.competition, status: 'CONFIRMED' } })).toBe(3);
  });
});
