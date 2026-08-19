import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPrismaClient, PrismaMatchResultService, PrismaNextRoundService } from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const resultService = new PrismaMatchResultService(client);
const nextRoundService = new PrismaNextRoundService(client);
const occurredAt = new Date('2026-08-19T20:00:00.000Z');
const hash = 'd'.repeat(64);

const ids = {
  recorder: '14000000-0000-4000-8000-000000000001',
  confirmer: '14000000-0000-4000-8000-000000000002',
  superadmin: '14000000-0000-4000-8000-000000000003',
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
  semifinalConfiguration: 'a4000000-0000-4000-8000-000000000001',
  finalConfiguration: 'a4000000-0000-4000-8000-000000000002',
  semifinalExecution: 'b4000000-0000-4000-8000-000000000001',
  finalExecution: 'b4000000-0000-4000-8000-000000000002',
  semifinalPairings: [
    'e4000000-0000-4000-8000-000000000001',
    'e4000000-0000-4000-8000-000000000002',
  ],
  semifinalMatches: [
    'f4000000-0000-4000-8000-000000000001',
    'f4000000-0000-4000-8000-000000000002',
  ],
  semifinalResults: [
    'c4000000-0000-4000-8000-000000000001',
    'c4000000-0000-4000-8000-000000000002',
  ],
  finalPairing: 'e4000000-0000-4000-8000-000000000003',
  finalMatch: 'f4000000-0000-4000-8000-000000000003',
  finalResult: 'c4000000-0000-4000-8000-000000000003',
  publication: 'd4000000-0000-4000-8000-000000000001',
  replacementResult: 'c4000000-0000-4000-8000-000000000004',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seed(): Promise<void> {
  await client.user.createMany({ data: [
    { displayName: 'Registrador', emailNormalized: 'annul-recorder@example.test', id: ids.recorder, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
    { displayName: 'Confirmador', emailNormalized: 'annul-confirmer@example.test', id: ids.confirmer, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
    { displayName: 'Superadministrador', emailNormalized: 'annul-super@example.test', id: ids.superadmin, passwordHash: 'hash', role: 'SUPERADMIN', status: 'ACTIVE' },
  ] });
  await client.edition.create({ data: { createdById: ids.recorder, id: ids.edition, name: 'OES 2026', status: 'OPEN', updatedById: ids.recorder, year: 2026 } });
  await client.event.create({ data: { code: 'ANNUL_EVENT', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'ANNUL_FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'ANNUL_MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({ data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport } });
  await client.institution.createMany({ data: ids.institutions.map((id, index) => ({
    code: `ANNUL-${String(index + 1)}`,
    createdById: ids.recorder,
    eventId: ids.event,
    id,
    name: `Colegio ${String(index + 1)}`,
    normalizedName: `colegio ${String(index + 1)}`,
    updatedById: ids.recorder,
  })) });
  await client.competition.create({ data: {
    createdById: ids.recorder,
    editionId: ids.edition,
    eventId: ids.event,
    formatCode: 'KNOCKOUT',
    groupCount: null,
    id: ids.competition,
    lockedAt: occurredAt,
    lockedById: ids.recorder,
    modalityId: ids.modality,
    revision: 8,
    sportId: ids.sport,
    status: 'LOCKED',
    updatedById: ids.recorder,
  } });
  await client.competitionParticipant.createMany({ data: ids.participants.map((id, index) => ({
    competitionId: ids.competition,
    displayName: `Colegio ${String(index + 1)}`,
    enabledAt: occurredAt,
    enabledById: ids.recorder,
    eventId: ids.event,
    id,
    institutionId: ids.institutions[index] ?? ids.institutions[0],
  })) });
  await client.competitionRuleSet.create({ data: {
    canonicalHash: hash,
    competitionId: ids.competition,
    createdById: ids.recorder,
    frozenAt: occurredAt,
    frozenById: ids.recorder,
    id: ids.ruleSet,
    knockoutResolutionCode: 'HIGHER_SCORE',
    profileConfig: { allowDraws: false, profile: 'SCORE_BASED' },
    resultProfile: 'SCORE_BASED',
    revisionNumber: 1,
    schemaVersion: 1,
    status: 'FROZEN',
    updatedById: ids.recorder,
  } });
  await client.drawConfiguration.createMany({ data: [
    {
      canonicalHash: hash,
      competitionId: ids.competition,
      createdById: ids.recorder,
      formatCode: 'KNOCKOUT',
      frozenAt: occurredAt,
      frozenById: ids.recorder,
      groupCount: null,
      id: ids.semifinalConfiguration,
      participantCount: 4,
      revision: 2,
      roundNumber: 1,
      ruleSetId: ids.ruleSet,
      status: 'FROZEN',
      updatedById: ids.recorder,
    },
    {
      canonicalHash: 'e'.repeat(64),
      competitionId: ids.competition,
      createdById: ids.recorder,
      formatCode: 'KNOCKOUT',
      frozenAt: new Date(occurredAt.getTime() + 10 * 60_000),
      frozenById: ids.recorder,
      groupCount: null,
      id: ids.finalConfiguration,
      participantCount: 2,
      revision: 2,
      roundNumber: 2,
      ruleSetId: ids.ruleSet,
      status: 'FROZEN',
      updatedById: ids.recorder,
    },
  ] });
  await client.officialDraw.createMany({ data: [
    {
      algorithmVersion: 'oes-draw-v1', competitionId: ids.competition, configurationId: ids.semifinalConfiguration,
      confirmedAt: occurredAt, confirmedById: ids.confirmer, evidenceHash: hash, evidenceJson: { round: 1 },
      executedAt: occurredAt, executedById: ids.recorder, id: ids.semifinalExecution, resultHash: hash,
      revision: 2, seedCommitment: hash, seedHex: hash, status: 'CONFIRMED',
    },
    {
      algorithmVersion: 'oes-draw-v1', competitionId: ids.competition, configurationId: ids.finalConfiguration,
      confirmedAt: new Date(occurredAt.getTime() + 11 * 60_000), confirmedById: ids.confirmer,
      evidenceHash: 'e'.repeat(64), evidenceJson: { round: 2 }, executedAt: new Date(occurredAt.getTime() + 10 * 60_000),
      executedById: ids.recorder, id: ids.finalExecution, resultHash: 'e'.repeat(64), revision: 2,
      seedCommitment: 'e'.repeat(64), seedHex: 'e'.repeat(64), status: 'CONFIRMED',
    },
  ] });
  await client.drawPairing.createMany({ data: [
    { competitionId: ids.competition, executionId: ids.semifinalExecution, id: ids.semifinalPairings[0], ordinal: 1, pairingType: 'MATCH', participantAId: ids.participants[0], participantBId: ids.participants[1] },
    { competitionId: ids.competition, executionId: ids.semifinalExecution, id: ids.semifinalPairings[1], ordinal: 2, pairingType: 'MATCH', participantAId: ids.participants[2], participantBId: ids.participants[3] },
    { competitionId: ids.competition, executionId: ids.finalExecution, id: ids.finalPairing, ordinal: 1, pairingType: 'MATCH', participantAId: ids.participants[0], participantBId: ids.participants[2] },
  ] });
  await client.logicalMatch.createMany({ data: [
    { competitionId: ids.competition, executionId: ids.semifinalExecution, id: ids.semifinalMatches[0], ordinal: 1, pairingId: ids.semifinalPairings[0], participantAId: ids.participants[0], participantBId: ids.participants[1], roundNumber: 1, status: 'RESULT_CONFIRMED', winnerParticipantId: ids.participants[0] },
    { competitionId: ids.competition, executionId: ids.semifinalExecution, id: ids.semifinalMatches[1], ordinal: 2, pairingId: ids.semifinalPairings[1], participantAId: ids.participants[2], participantBId: ids.participants[3], roundNumber: 1, status: 'RESULT_CONFIRMED', winnerParticipantId: ids.participants[2] },
    { competitionId: ids.competition, executionId: ids.finalExecution, id: ids.finalMatch, ordinal: 1, pairingId: ids.finalPairing, participantAId: ids.participants[0], participantBId: ids.participants[2], roundNumber: 2, status: 'RESULT_CONFIRMED', winnerParticipantId: ids.participants[0] },
  ] });
  await client.matchResult.createMany({ data: [
    {
      competitionId: ids.competition, confirmedAt: occurredAt, confirmedById: ids.confirmer,
      detailJson: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 }, id: ids.semifinalResults[0], matchId: ids.semifinalMatches[0],
      participantAId: ids.participants[0], participantBId: ids.participants[1], recordedAt: occurredAt, recordedById: ids.recorder,
      resolvedJson: { scoreA: 2, scoreB: 0, setsWonA: 0, setsWonB: 0, winnerParticipantId: ids.participants[0] },
      revision: 2, ruleSetId: ids.ruleSet, status: 'CONFIRMED', winnerParticipantId: ids.participants[0],
    },
    {
      competitionId: ids.competition, confirmedAt: occurredAt, confirmedById: ids.confirmer,
      detailJson: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 }, id: ids.semifinalResults[1], matchId: ids.semifinalMatches[1],
      participantAId: ids.participants[2], participantBId: ids.participants[3], recordedAt: occurredAt, recordedById: ids.recorder,
      resolvedJson: { scoreA: 3, scoreB: 1, setsWonA: 0, setsWonB: 0, winnerParticipantId: ids.participants[2] },
      revision: 2, ruleSetId: ids.ruleSet, status: 'CONFIRMED', winnerParticipantId: ids.participants[2],
    },
    {
      competitionId: ids.competition, confirmedAt: new Date(occurredAt.getTime() + 12 * 60_000), confirmedById: ids.confirmer,
      detailJson: { profile: 'SCORE_BASED', scoreA: 1, scoreB: 0 }, id: ids.finalResult, matchId: ids.finalMatch,
      participantAId: ids.participants[0], participantBId: ids.participants[2], recordedAt: new Date(occurredAt.getTime() + 12 * 60_000), recordedById: ids.recorder,
      resolvedJson: { scoreA: 1, scoreB: 0, setsWonA: 0, setsWonB: 0, winnerParticipantId: ids.participants[0] },
      revision: 2, ruleSetId: ids.ruleSet, status: 'CONFIRMED', winnerParticipantId: ids.participants[0],
    },
  ] });
  await client.drawPublication.create({ data: {
    actJson: { schemaVersion: 'test' }, competitionId: ids.competition, id: ids.publication,
    officialDrawId: ids.finalExecution, publishedAt: new Date(occurredAt.getTime() + 12 * 60_000), publishedById: ids.recorder,
    revision: 1, status: 'PUBLISHED', verificationCode: 'f'.repeat(64),
  } });
}

integration('annulment recovery', () => {
  beforeEach(async () => { await clean(); await seed(); });
  afterAll(async () => { await clean(); await client.$disconnect(); });

  it('invalidates downstream rounds and permits a clean replacement round', async () => {
    const annulledAt = new Date(occurredAt.getTime() + 20 * 60_000);
    await resultService.annul({
      actorId: ids.superadmin,
      expectedRevision: 2,
      occurredAt: annulledAt,
      reason: 'Corrección oficial de semifinal',
      resultId: ids.semifinalResults[0],
    });

    expect(await client.drawConfiguration.findUnique({ where: { id: ids.finalConfiguration } })).toMatchObject({ status: 'REPLACED' });
    expect(await client.officialDraw.findUnique({ where: { id: ids.finalExecution } })).toMatchObject({ status: 'ANNULLED' });
    expect(await client.drawPublication.findUnique({ where: { id: ids.publication } })).toMatchObject({ status: 'REVOKED' });
    expect(await client.matchResult.findUnique({ where: { id: ids.finalResult } })).toMatchObject({ status: 'ANNULLED' });
    expect(await client.logicalMatch.findUnique({ where: { id: ids.finalMatch } })).toMatchObject({ status: 'PENDING_RESULT', winnerParticipantId: null });
    expect(await client.competition.findUnique({ where: { id: ids.competition } })).toMatchObject({ revision: 9, status: 'LOCKED' });
    expect(await client.auditEntry.findFirst({ where: { actionCode: 'DOWNSTREAM_COMPETITIVE_STATE_INVALIDATED', competitionId: ids.competition } })).not.toBeNull();

    await resultService.record({
      actorId: ids.recorder,
      detail: { profile: 'SCORE_BASED', scoreA: 0, scoreB: 2 },
      matchId: ids.semifinalMatches[0],
      occurredAt: new Date(annulledAt.getTime() + 60_000),
      resultId: ids.replacementResult,
    });
    await resultService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt: new Date(annulledAt.getTime() + 90_000),
      resultId: ids.replacementResult,
    });

    const replacementRound = await nextRoundService.prepare({
      actorId: ids.recorder,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: 'd4000000-0000-4000-8000-000000000002',
      expectedCompetitionRevision: 9,
      occurredAt: new Date(annulledAt.getTime() + 2 * 60_000),
    });
    expect(replacementRound.configuration).toMatchObject({ formatCode: 'KNOCKOUT', participantCount: 2, roundNumber: 2, status: 'FROZEN' });
    expect(replacementRound.configuration.participants.map(({ id }) => id).sort()).toEqual([ids.participants[1], ids.participants[2]].sort());
    expect(await client.drawConfiguration.count({ where: { competitionId: ids.competition, roundNumber: 2, status: 'FROZEN' } })).toBe(1);
  });
});
