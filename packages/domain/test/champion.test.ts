import { describe, expect, it } from 'vitest';

import { deriveChampionCandidate, type ChampionSource } from '../src/index.js';

const finalMatch = {
  id: 'match-final',
  resultId: 'result-final',
  status: 'RESULT_CONFIRMED' as const,
  winnerParticipantId: 'participant-champion',
};

const confirmedFinal: ChampionSource = {
  byeParticipantIds: [],
  executionId: 'execution-final',
  formatCode: 'KNOCKOUT',
  matches: [finalMatch],
  roundNumber: 3,
};

describe('deriveChampionCandidate', () => {
  it('derives the champion from exactly one confirmed final match', () => {
    expect(deriveChampionCandidate(confirmedFinal)).toEqual({
      participantId: 'participant-champion',
      sourceExecutionId: 'execution-final',
      sourceMatchId: 'match-final',
      sourceResultId: 'result-final',
      sourceRoundNumber: 3,
    });
  });

  it('rejects a semifinal or any round with more than one playable match', () => {
    expect(() => deriveChampionCandidate({
      ...confirmedFinal,
      matches: [finalMatch, {
        id: 'match-2',
        resultId: 'result-2',
        status: 'RESULT_CONFIRMED',
        winnerParticipantId: 'participant-other',
      }],
    })).toThrow(/exactly one playable match/i);
  });

  it('rejects a round that still contains a bye advance', () => {
    expect(() => deriveChampionCandidate({ ...confirmedFinal, byeParticipantIds: ['participant-bye'] })).toThrow(/no bye/i);
  });

  it('rejects an unconfirmed final result', () => {
    expect(() => deriveChampionCandidate({
      ...confirmedFinal,
      matches: [{
        id: 'match-final',
        resultId: null,
        status: 'RESULT_PENDING_CONFIRMATION',
        winnerParticipantId: null,
      }],
    })).toThrow(/confirmed result and winner/i);
  });
});
