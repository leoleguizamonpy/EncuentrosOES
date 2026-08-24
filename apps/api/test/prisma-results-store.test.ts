import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { PrismaResultsStore } from '../src/results/prisma-results-store.js';

const competitionId = '20000000-0000-4000-8000-000000000001';
const participantA = { displayName: 'Colegio A', id: '50000000-0000-4000-8000-000000000001' };
const participantB = { displayName: 'Colegio B', id: '50000000-0000-4000-8000-000000000002' };
const authorityA = { displayName: 'Autoridad Uno', id: '10000000-0000-4000-8000-000000000001' };
const authorityB = { displayName: 'Autoridad Dos', id: '10000000-0000-4000-8000-000000000002' };

function emptyStore(status: string): PrismaResultsStore {
  return new PrismaResultsStore({
    competition: { findUnique: vi.fn().mockResolvedValue({ status }) },
    officialDraw: { findFirst: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient);
}

function populatedStore(): PrismaResultsStore {
  return new PrismaResultsStore({
    competition: { findUnique: vi.fn().mockResolvedValue({ status: 'LOCKED' }) },
    officialDraw: { findFirst: vi.fn().mockResolvedValue({ configurationId: 'config-1', id: 'draw-1' }) },
    drawConfiguration: { findUnique: vi.fn().mockResolvedValue({ ruleSetId: 'rules-1' }) },
    competitionRuleSet: { findUnique: vi.fn().mockResolvedValue({ resultProfile: 'SCORE_BASED' }) },
    drawGroup: { findMany: vi.fn().mockResolvedValue([{ executionId: 'draw-1', id: '30000000-0000-4000-8000-000000000001', label: 'A', ordinal: 1 }]) },
    logicalMatch: { findMany: vi.fn().mockResolvedValue([{
      executionId: 'draw-1',
      groupId: '30000000-0000-4000-8000-000000000001',
      id: '40000000-0000-4000-8000-000000000001',
      ordinal: 1,
      participantAId: participantA.id,
      participantBId: participantB.id,
      roundNumber: 0,
      status: 'RESULT_CONFIRMED',
      winnerParticipantId: participantA.id,
    }]) },
    groupStanding: { findMany: vi.fn().mockResolvedValue([{
      draws: 0,
      groupId: '30000000-0000-4000-8000-000000000001',
      losses: 0,
      participantId: participantA.id,
      played: 1,
      position: 1,
      scoreAgainst: 1,
      scoreDifference: 2,
      scoreFor: 3,
      setDifference: 0,
      setsLost: 0,
      setsWon: 0,
      sportPointDifference: 2,
      sportPointsAgainst: 1,
      sportPointsFor: 3,
      tablePoints: 3,
      tied: false,
      wins: 1,
    }]) },
    groupQualification: { findMany: vi.fn().mockResolvedValue([{
      confirmedAt: null,
      confirmedById: null,
      firstParticipantId: participantA.id,
      groupId: '30000000-0000-4000-8000-000000000001',
      id: '70000000-0000-4000-8000-000000000001',
      proposedAt: new Date('2026-08-13T18:06:00.000Z'),
      proposedById: authorityA.id,
      revision: 1,
      secondParticipantId: participantB.id,
      status: 'PENDING_CONFIRMATION',
    }]) },
    matchResult: { findMany: vi.fn().mockResolvedValue([{
      confirmedAt: new Date('2026-08-13T18:05:00.000Z'),
      confirmedById: authorityB.id,
      detailJson: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 },
      id: '60000000-0000-4000-8000-000000000001',
      matchId: '40000000-0000-4000-8000-000000000001',
      recordedAt: new Date('2026-08-13T18:04:00.000Z'),
      recordedById: authorityA.id,
      resolvedJson: { scoreA: 3, scoreB: 1 },
      revision: 2,
      status: 'CONFIRMED',
    }]) },
    competitionParticipant: { findMany: vi.fn().mockResolvedValue([participantA, participantB]) },
    user: { findMany: vi.fn().mockResolvedValue([authorityA, authorityB]) },
  } as unknown as PrismaClient);
}

describe('PrismaResultsStore', () => {
  it('returns an empty restorable workspace before an official draw is confirmed', async () => {
    const workspace = await emptyStore('DRAFT').workspace(competitionId);
    expect(workspace).toEqual({ competitionId, competitionStatus: 'DRAFT', groups: [], matches: [], resultProfile: null });
  });

  it('maps active results and persisted standings from flat reads', async () => {
    const workspace = await populatedStore().workspace(competitionId);
    expect(workspace).toMatchObject({
      competitionStatus: 'LOCKED',
      groups: [{ complete: true, label: 'A', qualification: { firstParticipant: participantA, proposedBy: { displayName: 'Autoridad Uno' }, secondParticipant: participantB, status: 'PENDING_CONFIRMATION' }, standings: [{ participant: participantA, tablePoints: 3 }] }],
      matches: [{ participantA, participantB, result: { confirmedBy: { displayName: 'Autoridad Dos' }, status: 'CONFIRMED' }, status: 'RESULT_CONFIRMED' }],
      resultProfile: 'SCORE_BASED',
    });
  });

  it('rejects result mutations after the competition is finalized', async () => {
    const store = new PrismaResultsStore({
      competition: { findUnique: vi.fn().mockResolvedValue({ status: 'FINALIZED' }) },
      logicalMatch: { findUnique: vi.fn().mockResolvedValue({ competitionId }) },
    } as unknown as PrismaClient);

    await expect(store.record({
      actorId: authorityA.id,
      correlationId: '30000000-0000-4000-8000-000000000001',
      detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 1 },
      idempotencyKey: 'finalized-result-mutation',
      matchId: '40000000-0000-4000-8000-000000000001',
    })).rejects.toThrow(/finalized competition/i);
  });
});
