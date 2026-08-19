import { describe, expect, it } from 'vitest';

import { deriveChampionCandidate } from '../src/index.js';

const confirmedFinal = {
  byeParticipantIds: [],
  executionId: 'execution-final',
  formatCode: 'KNOCKOUT' as const,
  matches: [{
    id: 'match-final',
    resultId: 'result-final',
    status: 'RESULT_CONFIRMED' as const,
    winnerParticipantId: 'participant-champion',
  }],
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
      matches: [...confirmedFinal.matches, { ...confirmedFinal.matches[0], id: 'match-2', resultId: 'result-2' }],
    })).toThrow(/exactly one playable match/i);
  });

  it('rejects a round that still contains a bye advance', () => {
    expect(() => deriveChampionCandidate({ ...confirmedFinal, byeParticipantIds: ['participant-bye'] })).toThrow(/no bye/i);
  });

  it('rejects an unconfirmed final result', () => {
    expect(() => deriveChampionCandidate({
      ...confirmedFinal,
      matches: [{ ...confirmedFinal.matches[0], resultId: null, status: 'RESULT_PENDING_CONFIRMATION', winnerParticipantId: null }],
    })).toThrow(/confirmed result and winner/i);
  });
});
