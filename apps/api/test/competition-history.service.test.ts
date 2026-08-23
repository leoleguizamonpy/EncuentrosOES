import { NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CompetitionHistoryService } from '../src/results/competition-history.service.js';

function participant(id: string, displayName: string) {
  return { displayName, id };
}

describe('CompetitionHistoryService', () => {
  it('projects every confirmed or annulled execution instead of only the latest round', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      officialDraws: [
        {
          annulledAt: null,
          annulmentReason: null,
          confirmedAt: new Date('2026-08-20T12:00:00.000Z'),
          configuration: { formatCode: 'GROUP_STAGE', roundNumber: 0, ruleSet: { resultProfile: 'SCORE_BASED' } },
          executedAt: new Date('2026-08-20T11:55:00.000Z'),
          groups: [{
            id: 'group-a', label: 'A', ordinal: 1,
            qualifications: [{ firstParticipant: participant('a', 'Colegio A'), secondParticipant: participant('b', 'Colegio B'), status: 'CONFIRMED' }],
            standings: [{ draws: 0, losses: 0, participant: participant('a', 'Colegio A'), played: 2, position: 1, scoreAgainst: 1, scoreDifference: 4, scoreFor: 5, setDifference: 0, setsLost: 0, setsWon: 0, sportPointDifference: 4, sportPointsAgainst: 1, sportPointsFor: 5, tablePoints: 6, tied: false, wins: 2 }],
          }],
          id: 'draw-groups',
          matches: [{ group: { label: 'A' }, id: 'match-g', ordinal: 1, participantA: participant('a', 'Colegio A'), participantB: participant('b', 'Colegio B'), results: [{ annulledAt: null, annulmentReason: null, confirmedAt: new Date('2026-08-20T12:10:00.000Z'), detailJson: { scoreA: 3, scoreB: 1 }, id: 'result-g', recordedAt: new Date('2026-08-20T12:05:00.000Z'), resolvedJson: { scoreA: 3, scoreB: 1 }, status: 'CONFIRMED' }], roundNumber: 0, status: 'RESULT_CONFIRMED', winnerParticipantId: 'a' }],
          pairings: [],
          publication: null,
          status: 'CONFIRMED',
        },
        {
          annulledAt: null,
          annulmentReason: null,
          confirmedAt: new Date('2026-08-21T12:00:00.000Z'),
          configuration: { formatCode: 'KNOCKOUT', roundNumber: 1, ruleSet: { resultProfile: 'SCORE_BASED' } },
          executedAt: new Date('2026-08-21T11:55:00.000Z'),
          groups: [],
          id: 'draw-knockout',
          matches: [{ group: null, id: 'match-k', ordinal: 1, participantA: participant('b', 'Colegio B'), participantB: participant('c', 'Colegio C'), results: [{ annulledAt: null, annulmentReason: null, confirmedAt: new Date('2026-08-21T12:10:00.000Z'), detailJson: { scoreA: 2, scoreB: 0 }, id: 'result-k', recordedAt: new Date('2026-08-21T12:05:00.000Z'), resolvedJson: { scoreA: 2, scoreB: 0 }, status: 'CONFIRMED' }], roundNumber: 1, status: 'RESULT_CONFIRMED', winnerParticipantId: 'b' }],
          pairings: [{ pairingType: 'BYE', participantA: participant('a', 'Colegio A'), priorByeCount: 0 }],
          publication: { id: 'publication-1', publishedAt: new Date('2026-08-21T12:01:00.000Z'), verificationCode: 'verify-1' },
          status: 'CONFIRMED',
        },
      ],
    });
    const client = { competition: { findUnique } } as unknown as PrismaClient;
    const service = new CompetitionHistoryService(client);

    const history = await service.history('competition-1');

    expect(history.executions).toHaveLength(2);
    expect(history.executions[0]?.groups[0]?.standings[0]?.tablePoints).toBe(6);
    expect(history.executions[0]?.groups[0]?.qualified.map(({ displayName }) => displayName)).toEqual(['Colegio A', 'Colegio B']);
    expect(history.executions[1]?.bye?.participant.displayName).toBe('Colegio A');
    expect(history.executions[1]?.matches[0]?.results[0]?.status).toBe('CONFIRMED');
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'competition-1' } }));
  });

  it('rejects a missing competition', async () => {
    const client = { competition: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    await expect(new CompetitionHistoryService(client).history('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
