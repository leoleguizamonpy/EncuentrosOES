import { NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CompetitionHistoryService } from '../src/results/competition-history.service.js';

function flatClient(): PrismaClient {
  return {
    competition: { findUnique: vi.fn().mockResolvedValue({ id: 'competition-1' }) },
    officialDraw: { findMany: vi.fn().mockResolvedValue([
      { annulledAt: null, annulmentReason: null, confirmedAt: new Date('2026-08-20T12:00:00.000Z'), configurationId: 'config-g', executedAt: new Date('2026-08-20T11:55:00.000Z'), id: 'draw-groups', status: 'CONFIRMED' },
      { annulledAt: null, annulmentReason: null, confirmedAt: new Date('2026-08-21T12:00:00.000Z'), configurationId: 'config-k', executedAt: new Date('2026-08-21T11:55:00.000Z'), id: 'draw-knockout', status: 'CONFIRMED' },
    ]) },
    drawConfiguration: { findMany: vi.fn().mockResolvedValue([
      { formatCode: 'GROUP_STAGE', id: 'config-g', roundNumber: 0, ruleSetId: 'rules-1' },
      { formatCode: 'KNOCKOUT', id: 'config-k', roundNumber: 1, ruleSetId: 'rules-1' },
    ]) },
    competitionRuleSet: { findMany: vi.fn().mockResolvedValue([{ id: 'rules-1', resultProfile: 'SCORE_BASED' }]) },
    drawGroup: { findMany: vi.fn().mockResolvedValue([{ executionId: 'draw-groups', id: 'group-a', label: 'A', ordinal: 1 }]) },
    logicalMatch: { findMany: vi.fn().mockResolvedValue([
      { executionId: 'draw-groups', groupId: 'group-a', id: 'match-g', ordinal: 1, participantAId: 'a', participantBId: 'b', roundNumber: 0, status: 'RESULT_CONFIRMED', winnerParticipantId: 'a' },
      { executionId: 'draw-knockout', groupId: null, id: 'match-k', ordinal: 1, participantAId: 'b', participantBId: 'c', roundNumber: 1, status: 'RESULT_CONFIRMED', winnerParticipantId: 'b' },
    ]) },
    groupStanding: { findMany: vi.fn().mockResolvedValue([
      { draws: 0, groupId: 'group-a', losses: 0, participantId: 'a', played: 2, position: 1, scoreAgainst: 1, scoreDifference: 4, scoreFor: 5, setDifference: 0, setsLost: 0, setsWon: 0, sportPointDifference: 4, sportPointsAgainst: 1, sportPointsFor: 5, tablePoints: 6, tied: false, wins: 2 },
    ]) },
    groupQualification: { findMany: vi.fn().mockResolvedValue([
      { firstParticipantId: 'a', groupId: 'group-a', proposedAt: new Date('2026-08-20T12:20:00.000Z'), secondParticipantId: 'b', status: 'CONFIRMED' },
    ]) },
    matchResult: { findMany: vi.fn().mockResolvedValue([
      { annulledAt: null, annulmentReason: null, confirmedAt: new Date('2026-08-20T12:10:00.000Z'), detailJson: { scoreA: 3, scoreB: 1 }, id: 'result-g', matchId: 'match-g', recordedAt: new Date('2026-08-20T12:05:00.000Z'), resolvedJson: { scoreA: 3, scoreB: 1 }, status: 'CONFIRMED' },
      { annulledAt: null, annulmentReason: null, confirmedAt: new Date('2026-08-21T12:10:00.000Z'), detailJson: { scoreA: 2, scoreB: 0 }, id: 'result-k', matchId: 'match-k', recordedAt: new Date('2026-08-21T12:05:00.000Z'), resolvedJson: { scoreA: 2, scoreB: 0 }, status: 'CONFIRMED' },
    ]) },
    drawPairing: { findMany: vi.fn().mockResolvedValue([{ executionId: 'draw-knockout', pairingType: 'BYE', participantAId: 'a', priorByeCount: 0 }]) },
    drawPublication: { findMany: vi.fn().mockResolvedValue([{ id: 'publication-1', officialDrawId: 'draw-knockout', publishedAt: new Date('2026-08-21T12:01:00.000Z'), verificationCode: 'verify-1' }]) },
    competitionParticipant: { findMany: vi.fn().mockResolvedValue([
      { displayName: 'Colegio A', id: 'a' },
      { displayName: 'Colegio B', id: 'b' },
      { displayName: 'Colegio C', id: 'c' },
    ]) },
  } as unknown as PrismaClient;
}

describe('CompetitionHistoryService', () => {
  it('projects every confirmed or annulled execution from flat reads', async () => {
    const history = await new CompetitionHistoryService(flatClient()).history('competition-1');

    expect(history.executions).toHaveLength(2);
    expect(history.executions[0]?.groups[0]?.standings[0]?.tablePoints).toBe(6);
    expect(history.executions[0]?.groups[0]?.qualified.map(({ displayName }) => displayName)).toEqual(['Colegio A', 'Colegio B']);
    expect(history.executions[1]?.bye?.participant.displayName).toBe('Colegio A');
    expect(history.executions[1]?.matches[0]?.results[0]?.status).toBe('CONFIRMED');
  });

  it('rejects a missing competition', async () => {
    const client = { competition: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    await expect(new CompetitionHistoryService(client).history('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
