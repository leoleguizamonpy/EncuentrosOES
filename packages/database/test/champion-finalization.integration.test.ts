import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPrismaClient, PrismaChampionFinalizationService } from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const service = new PrismaChampionFinalizationService(client);
const occurredAt = new Date('2026-08-19T17:00:00.000Z');

const ids = {
  proposer: '10000000-0000-4000-8000-000000000001',
  confirmer: '10000000-0000-4000-8000-000000000002',
  competition: '20000000-0000-4000-8000-000000000001',
  edition: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
  institutionA: '50000000-0000-4000-8000-000000000001',
  institutionB: '50000000-0000-4000-8000-000000000002',
  modality: '60000000-0000-4000-8000-000000000001',
  participantA: '70000000-0000-4000-8000-000000000001',
  participantB: '70000000-0000-4000-8000-000000000002',
  sport: '80000000-0000-4000-8000-000000000001',
  ruleSet: '90000000-0000-4000-8000-000000000001',
  configuration: 'a0000000-0000-4000-8000-000000000001',
  execution: 'b0000000-0000-4000-8000-000000000001',
  pairing: 'b1000000-0000-4000-8000-000000000001',
  match: 'c0000000-0000-4000-8000-000000000001',
  result: 'd0000000-0000-4000-8000-000000000001',
} as const;

async function cleanDatabase(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seedFinal(): Promise<void> {
  await client.user.createMany({ data: [
    { displayName: 'Administrador Uno', emailNormalized: 'admin1@example.test', id: ids.proposer, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
    { displayName: 'Administrador Dos', emailNormalized: 'admin2@example.test', id: ids.confirmer, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
  ] });
  await client.edition.create({ data: { createdById: ids.proposer, id: ids.edition, name: 'OES 2026', status: 'OPEN', updatedById: ids.proposer, year: 2026 } });
  await client.event.create({ data: { code: 'COLEGIALES', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({ data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport } });
  await client.institution.createMany({ data: [
    { code: 'A', createdById: ids.proposer, eventId: ids.event, id: ids.institutionA, name: 'Colegio A', normalizedName: 'colegio a', updatedById: ids.proposer },
    { code: 'B', createdById: ids.proposer, eventId: ids.event, id: ids.institutionB, name: 'Colegio B', normalizedName: 'colegio b', updatedById: ids.proposer },
  ] });
  await client.competition.create({ data: {
    createdById: ids.proposer, editionId: ids.edition, eventId: ids.event, formatCode: 'KNOCKOUT', id: ids.competition,
    lockedAt: occurredAt, lockedById: ids.proposer, modalityId: ids.modality, revision: 6, sportId: ids.sport,
    status: 'LOCKED', updatedById: ids.proposer,
  } });
  await client.competitionParticipant.createMany({ data: [
    { competitionId: ids.competition, displayName: 'Colegio A', enabledAt: occurredAt, enabledById: ids.proposer, eventId: ids.event, id: ids.participantA, institutionId: ids.institutionA },
    { competitionId: ids.competition, displayName: 'Colegio B', enabledAt: occurredAt, enabledById: ids.proposer, eventId: ids.event, id: ids.participantB, institutionId: ids.institutionB },
  ] });
  await client.competitionRuleSet.create({ data: {
    canonicalHash: '1'.repeat(64), competitionId: ids.competition, createdById: ids.proposer, frozenAt: occurredAt, frozenById: ids.proposer,
    id: ids.ruleSet, knockoutResolutionCode: 'HIGHER_SCORE', profileConfig: { allowDraws: false }, resultProfile: 'SCORE_BASED',
    revision: 2, revisionNumber: 1, schemaVersion: 1, status: 'FROZEN', updatedById: ids.proposer,
  } });
  await client.drawConfiguration.create({ data: {
    algorithmVersion: 'oes-draw-v1', canonicalHash: '2'.repeat(64), competitionId: ids.competition, createdById: ids.proposer,
    formatCode: 'KNOCKOUT', frozenAt: occurredAt, frozenById: ids.proposer, id: ids.configuration, participantCount: 2,
    revision: 2, roundNumber: 3, ruleSetId: ids.ruleSet, status: 'FROZEN', updatedById: ids.proposer,
  } });
  await client.officialDraw.create({ data: {
    algorithmVersion: 'oes-draw-v1', competitionId: ids.competition, configurationId: ids.configuration,
    confirmedAt: occurredAt, confirmedById: ids.confirmer, evidenceHash: '3'.repeat(64), evidenceJson: {}, executedAt: occurredAt,
    executedById: ids.proposer, id: ids.execution, resultHash: '4'.repeat(64), revision: 2, seedCommitment: '5'.repeat(64),
    seedHex: '6'.repeat(64), status: 'CONFIRMED',
  } });
  await client.drawPairing.create({ data: {
    competitionId: ids.competition, executionId: ids.execution, id: ids.pairing, ordinal: 1,
    pairingType: 'MATCH', participantAId: ids.participantA, participantBId: ids.participantB,
  } });
  await client.logicalMatch.create({ data: {
    competitionId: ids.competition, executionId: ids.execution, id: ids.match, ordinal: 1, pairingId: ids.pairing,
    participantAId: ids.participantA, participantBId: ids.participantB, roundNumber: 3,
    status: 'RESULT_CONFIRMED', winnerParticipantId: ids.participantA,
  } });
  await client.matchResult.create({ data: {
    competitionId: ids.competition, confirmedAt: occurredAt, confirmedById: ids.confirmer,
    detailJson: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 1 }, id: ids.result, matchId: ids.match,
    participantAId: ids.participantA, participantBId: ids.participantB, recordedAt: occurredAt, recordedById: ids.proposer,
    resolvedJson: { scoreA: 2, scoreB: 1, setsWonA: 0, setsWonB: 0, winnerParticipantId: ids.participantA },
    revision: 2, ruleSetId: ids.ruleSet, status: 'CONFIRMED', winnerParticipantId: ids.participantA,
  } });
}

integration('PrismaChampionFinalizationService', () => {
  beforeEach(async () => { await cleanDatabase(); await seedFinal(); });
  afterAll(async () => { await cleanDatabase(); await client.$disconnect(); });

  it('proposes from the confirmed final and requires another authority to finalize', async () => {
    const proposal = await service.propose({
      actorId: ids.proposer, actorRole: 'ADMIN', competitionId: ids.competition,
      correlationId: 'e0000000-0000-4000-8000-000000000001', expectedCompetitionRevision: 6, occurredAt,
    });
    expect(proposal).toMatchObject({
      competitionRevision: 7, participantId: ids.participantA, sourceExecutionId: ids.execution,
      sourceMatchId: ids.match, sourceResultId: ids.result, sourceRoundNumber: 3, status: 'PENDING_CONFIRMATION',
    });
    expect((await client.competition.findUniqueOrThrow({ where: { id: ids.competition } })).status).toBe('LOCKED');

    await expect(service.confirm({
      actorId: ids.proposer, actorRole: 'ADMIN', competitionId: ids.competition,
      correlationId: 'e0000000-0000-4000-8000-000000000002', expectedCompetitionRevision: 7,
      occurredAt: new Date('2026-08-19T17:05:00.000Z'), proposalId: proposal.proposalId,
    })).rejects.toThrow(/cannot confirm/i);

    const champion = await service.confirm({
      actorId: ids.confirmer, actorRole: 'ADMIN', competitionId: ids.competition,
      correlationId: 'e0000000-0000-4000-8000-000000000003', expectedCompetitionRevision: 7,
      occurredAt: new Date('2026-08-19T17:06:00.000Z'), proposalId: proposal.proposalId,
    });
    expect(champion).toMatchObject({ competitionRevision: 8, participantId: ids.participantA, status: 'CONFIRMED' });
    expect(await client.competition.findUniqueOrThrow({ where: { id: ids.competition } })).toMatchObject({
      finalizedById: ids.confirmer, revision: 8, status: 'FINALIZED',
    });
    expect(await client.auditEntry.count({ where: { competitionId: ids.competition, actionCode: { in: ['CHAMPION_PROPOSED', 'CHAMPION_CONFIRMED'] } } })).toBe(2);
    expect((await service.find(ids.competition))?.status).toBe('CONFIRMED');
  });

  it('does not propose a champion while the latest knockout round has more than one match', async () => {
    const secondPairingId = 'b1000000-0000-4000-8000-000000000002';
    await client.drawPairing.create({ data: {
      competitionId: ids.competition, executionId: ids.execution, id: secondPairingId, ordinal: 2,
      pairingType: 'MATCH', participantAId: ids.participantA, participantBId: ids.participantB,
    } });
    await client.logicalMatch.create({ data: {
      competitionId: ids.competition, executionId: ids.execution, id: 'c0000000-0000-4000-8000-000000000002', ordinal: 2,
      pairingId: secondPairingId, participantAId: ids.participantA, participantBId: ids.participantB, roundNumber: 3,
      status: 'RESULT_CONFIRMED', winnerParticipantId: ids.participantA,
    } });
    await expect(service.propose({
      actorId: ids.proposer, actorRole: 'ADMIN', competitionId: ids.competition,
      correlationId: 'e0000000-0000-4000-8000-000000000004', expectedCompetitionRevision: 6, occurredAt,
    })).rejects.toThrow(/exactly one playable match/i);
    expect(await client.auditEntry.count({ where: { actionCode: 'CHAMPION_PROPOSED' } })).toBe(0);
  });
});
