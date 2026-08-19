import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { PrismaResultsStore } from '../src/results/prisma-results-store.js';

const competitionId = '20000000-0000-4000-8000-000000000001';

function storeWith(value: unknown): PrismaResultsStore {
  return new PrismaResultsStore({ competition: { findUnique: vi.fn().mockResolvedValue(value) } } as unknown as PrismaClient);
}

describe('PrismaResultsStore', () => {
  it('returns an empty restorable workspace before an official draw is confirmed', async () => {
    const workspace = await storeWith({ id: competitionId, officialDraws: [], status: 'DRAFT' }).workspace(competitionId);
    expect(workspace).toEqual({ competitionId, competitionStatus: 'DRAFT', groups: [], matches: [], resultProfile: null });
  });

  it('maps active results and persisted standings from the confirmed draw', async () => {
    const participantA = { displayName: 'Colegio A', id: '50000000-0000-4000-8000-000000000001' };
    const participantB = { displayName: 'Colegio B', id: '50000000-0000-4000-8000-000000000002' };
    const group = { id: '30000000-0000-4000-8000-000000000001', label: 'A' };
    const workspace = await storeWith({
      id: competitionId,
      officialDraws: [{
        configuration: { ruleSet: { resultProfile: 'SCORE_BASED' } },
        groups: [{
          ...group,
          ordinal: 1,
          qualifications: [{
            confirmedAt: null, confirmedBy: null,
            firstParticipant: participantA, id: '70000000-0000-4000-8000-000000000001',
            proposedAt: new Date('2026-08-13T18:06:00.000Z'), proposedBy: { displayName: 'Autoridad Uno', id: '10000000-0000-4000-8000-000000000001' },
            revision: 1, secondParticipant: participantB, status: 'PENDING_CONFIRMATION',
          }],
          standings: [{ draws: 0, losses: 0, participant: participantA, participantId: participantA.id, played: 1, position: 1, scoreAgainst: 1, scoreDifference: 2, scoreFor: 3, setDifference: 0, setsLost: 0, setsWon: 0, sportPointDifference: 2, sportPointsAgainst: 1, sportPointsFor: 3, tablePoints: 3, tied: false, wins: 1 }],
        }],
        matches: [{
          group, id: '40000000-0000-4000-8000-000000000001', ordinal: 1, participantA, participantB, participantAId: participantA.id, participantBId: participantB.id, roundNumber: 0, status: 'RESULT_CONFIRMED', winnerParticipantId: participantA.id,
          results: [{ confirmedAt: new Date('2026-08-13T18:05:00.000Z'), confirmedBy: { displayName: 'Autoridad Dos', id: '10000000-0000-4000-8000-000000000002' }, detailJson: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 }, id: '60000000-0000-4000-8000-000000000001', recordedAt: new Date('2026-08-13T18:04:00.000Z'), recordedBy: { displayName: 'Autoridad Uno', id: '10000000-0000-4000-8000-000000000001' }, resolvedJson: { scoreA: 3, scoreB: 1 }, revision: 2, status: 'CONFIRMED' }],
        }],
      }],
      status: 'LOCKED',
    }).workspace(competitionId);
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
      actorId: '10000000-0000-4000-8000-000000000001',
      correlationId: '30000000-0000-4000-8000-000000000001',
      detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 1 },
      idempotencyKey: 'finalized-result-mutation',
      matchId: '40000000-0000-4000-8000-000000000001',
    })).rejects.toThrow(/finalized competition/i);
  });
});
