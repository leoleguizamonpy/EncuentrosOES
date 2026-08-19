import { Competition, CompetitionRuleSet, DrawConfiguration } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaChampionFinalizationService,
  PrismaCompetitionLockService,
  PrismaCompetitionRepository,
  PrismaCompetitionRuleSetRepository,
  PrismaDrawConfigurationRepository,
  PrismaGroupQualificationService,
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
const qualificationService = new PrismaGroupQualificationService(client);
const nextRoundService = new PrismaNextRoundService(client);
const championService = new PrismaChampionFinalizationService(client);

const occurredAt = new Date('2026-08-19T18:30:00.000Z');
const ids = {
  actor: '12000000-0000-4000-8000-000000000001',
  confirmer: '12000000-0000-4000-8000-000000000002',
  competition: '22000000-0000-4000-8000-000000000001',
  edition: '32000000-0000-4000-8000-000000000001',
  event: '42000000-0000-4000-8000-000000000001',
  sport: '52000000-0000-4000-8000-000000000001',
  modality: '62000000-0000-4000-8000-000000000001',
  institutionA: '72000000-0000-4000-8000-000000000001',
  institutionB: '72000000-0000-4000-8000-000000000002',
  institutionC: '72000000-0000-4000-8000-000000000003',
  participantA: '82000000-0000-4000-8000-000000000001',
  participantB: '82000000-0000-4000-8000-000000000002',
  participantC: '82000000-0000-4000-8000-000000000003',
  ruleSet: '92000000-0000-4000-8000-000000000001',
  groupConfiguration: 'a2000000-0000-4000-8000-000000000001',
  groupExecution: 'b2000000-0000-4000-8000-000000000001',
  finalExecution: 'b2000000-0000-4000-8000-000000000002',
  groupResultA: 'c2000000-0000-4000-8000-000000000001',
  groupResultB: 'c2000000-0000-4000-8000-000000000002',
  groupResultC: 'c2000000-0000-4000-8000-000000000003',
  finalResult: 'c2000000-0000-4000-8000-000000000004',
  nextRoundCorrelation: 'd2000000-0000-4000-8000-000000000001',
  championProposalCorrelation: 'd2000000-0000-4000-8000-000000000002',
  championConfirmCorrelation: 'd2000000-0000-4000-8000-000000000003',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seedCatalog(): Promise<void> {
  await client.user.createMany({ data: [
    { displayName: 'Administrador Uno', emailNormalized: 'lifecycle-admin@example.test', id: ids.actor, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
    { displayName: 'Administrador Dos', emailNormalized: 'lifecycle-confirmer@example.test', id: ids.confirmer, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
  ] });
  await client.edition.create({ data: { createdById: ids.actor, id: ids.edition, name: 'OES 2026', status: 'OPEN', updatedById: ids.actor, year: 2026 } });
  await client.event.create({ data: { code: 'LIFECYCLE_EVENT', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'LIFECYCLE_FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'LIFECYCLE_MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({ data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport } });
  await client.institution.createMany({ data: [
    { code: 'LIFE-A', createdById: ids.actor, eventId: ids.event, id: ids.institutionA, name: 'Colegio A', normalizedName: 'colegio a', updatedById: ids.actor },
    { code: 'LIFE-B', createdById: ids.actor, eventId: ids.event, id: ids.institutionB, name: 'Colegio B', normalizedName: 'colegio b', updatedById: ids.actor },
    { code: 'LIFE-C', createdById: ids.actor, eventId: ids.event, id: ids.institutionC, name: 'Colegio C', normalizedName: 'colegio c', updatedById: ids.actor },
  ] });
}

async function prepareGroupCompetition(): Promise<void> {
  const competition = Competition.create({
    actorId: ids.actor,
    id: ids.competition,
    key: { editionId: ids.edition, eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
    occurredAt,
  });
  const participants = [
    [ids.participantA, ids.institutionA, 'Colegio A'],
    [ids.participantB, ids.institutionB, 'Colegio B'],
    [ids.participantC, ids.institutionC, 'Colegio C'],
  ] as const;
  for (const [index, [id, institutionId, displayName]] of participants.entries()) {
    competition.addParticipant({
      actorId: ids.actor,
      displayName,
      eventId: ids.event,
      expectedRevision: index + 1,
      id,
      institutionId,
      occurredAt,
    });
  }
  competition.open({ actorId: ids.actor, expectedRevision: 4, occurredAt });
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
    tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE', 'SCORE_FOR'],
  });
  rules.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await ruleSetRepository.insert(rules);

  const configuration = DrawConfiguration.create({
    actorId: ids.actor,
    competitionId: ids.competition,
    formatCode: 'GROUP_STAGE',
    groupCount: 1,
    id: ids.groupConfiguration,
    occurredAt,
    participants: participants.map(([id, , displayName]) => ({ byeCount: 0, displayName, id })),
    roundNumber: 0,
    ruleSetId: ids.ruleSet,
  });
  configuration.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await drawRepository.insert(configuration);
  await lockService.lock({
    actorId: ids.actor,
    competitionId: ids.competition,
    drawConfigurationId: ids.groupConfiguration,
    expectedRevision: 5,
    occurredAt,
    ruleSetId: ids.ruleSet,
  });
}

async function confirmGroupResults(): Promise<void> {
  const matches = await client.logicalMatch.findMany({ orderBy: { ordinal: 'asc' }, where: { executionId: ids.groupExecution } });
  const resultIds = [ids.groupResultA, ids.groupResultB, ids.groupResultC] as const;
  expect(matches).toHaveLength(3);

  for (const [index, match] of matches.entries()) {
    const resultId = resultIds[index];
    if (resultId === undefined) throw new Error('Unexpected group match count.');
    const participantAWins = match.participantAId.localeCompare(match.participantBId) < 0;
    await resultService.record({
      actorId: ids.actor,
      detail: { profile: 'SCORE_BASED', scoreA: participantAWins ? 2 : 0, scoreB: participantAWins ? 0 : 2 },
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
}

integration('full competition lifecycle', () => {
  beforeEach(async () => { await clean(); await seedCatalog(); });
  afterAll(async () => { await clean(); await client.$disconnect(); });

  it('runs groups through a knockout final and finalizes one auditable champion', async () => {
    await prepareGroupCompetition();

    await drawService.execute({
      actorId: ids.actor,
      configurationId: ids.groupConfiguration,
      executionId: ids.groupExecution,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index),
    });
    await drawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.groupExecution,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 10_000),
    });
    await confirmGroupResults();

    const qualification = await client.groupQualification.findFirstOrThrow({ where: { competitionId: ids.competition, status: 'PENDING_CONFIRMATION' } });
    await qualificationService.confirm({
      actorId: ids.confirmer,
      expectedRevision: qualification.revision,
      occurredAt: new Date(occurredAt.getTime() + 5 * 60_000),
      qualificationId: qualification.id,
    });

    const nextRound = await nextRoundService.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: ids.nextRoundCorrelation,
      expectedCompetitionRevision: 6,
      occurredAt: new Date(occurredAt.getTime() + 6 * 60_000),
    });
    expect(nextRound).toMatchObject({
      competitionRevision: 7,
      configuration: { formatCode: 'KNOCKOUT', participantCount: 2, roundNumber: 1, status: 'FROZEN' },
    });

    await drawService.execute({
      actorId: ids.actor,
      configurationId: nextRound.configuration.id,
      executionId: ids.finalExecution,
      occurredAt: new Date(occurredAt.getTime() + 7 * 60_000),
      seed: Uint8Array.from({ length: 32 }, (_, index) => 31 - index),
    });
    await drawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.finalExecution,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 8 * 60_000),
    });

    const finalMatch = await client.logicalMatch.findFirstOrThrow({ where: { executionId: ids.finalExecution } });
    await resultService.record({
      actorId: ids.actor,
      detail: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 },
      matchId: finalMatch.id,
      occurredAt: new Date(occurredAt.getTime() + 9 * 60_000),
      resultId: ids.finalResult,
    });
    await resultService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt: new Date(occurredAt.getTime() + 10 * 60_000),
      resultId: ids.finalResult,
    });

    const proposal = await championService.propose({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: ids.championProposalCorrelation,
      expectedCompetitionRevision: 7,
      occurredAt: new Date(occurredAt.getTime() + 11 * 60_000),
    });
    expect(proposal).toMatchObject({
      competitionRevision: 8,
      participantId: finalMatch.participantAId,
      sourceExecutionId: ids.finalExecution,
      sourceMatchId: finalMatch.id,
      sourceResultId: ids.finalResult,
      sourceRoundNumber: 1,
      status: 'PENDING_CONFIRMATION',
    });

    const champion = await championService.confirm({
      actorId: ids.confirmer,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: ids.championConfirmCorrelation,
      expectedCompetitionRevision: 8,
      occurredAt: new Date(occurredAt.getTime() + 12 * 60_000),
      proposalId: proposal.proposalId,
    });
    expect(champion).toMatchObject({ competitionRevision: 9, participantId: finalMatch.participantAId, status: 'CONFIRMED' });

    expect(await client.competition.findUniqueOrThrow({ where: { id: ids.competition } })).toMatchObject({
      finalizedById: ids.confirmer,
      revision: 9,
      status: 'FINALIZED',
    });
    expect(await client.drawConfiguration.count({ where: { competitionId: ids.competition } })).toBe(2);
    expect(await client.officialDraw.count({ where: { competitionId: ids.competition, status: 'CONFIRMED' } })).toBe(2);
    expect(await client.matchResult.count({ where: { competitionId: ids.competition, status: 'CONFIRMED' } })).toBe(4);
    expect(await client.groupQualification.count({ where: { competitionId: ids.competition, status: 'CONFIRMED' } })).toBe(1);
    expect(await client.auditEntry.count({ where: { competitionId: ids.competition, actionCode: { in: ['NEXT_ROUND_CONFIGURATION_FROZEN', 'CHAMPION_PROPOSED', 'CHAMPION_CONFIRMED'] } } })).toBe(3);

    await expect(nextRoundService.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: 'd2000000-0000-4000-8000-000000000004',
      expectedCompetitionRevision: 9,
      occurredAt: new Date(occurredAt.getTime() + 13 * 60_000),
    })).rejects.toMatchObject({ code: 'DRAW_CONFIGURATION_INCOMPATIBLE' });
  });
});
