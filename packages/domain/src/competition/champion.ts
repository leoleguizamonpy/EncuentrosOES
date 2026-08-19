import { DomainError } from '../errors/domain-error.js';

export interface ChampionSourceMatch {
  readonly id: string;
  readonly resultId: string | null;
  readonly status: 'PENDING_RESULT' | 'RESULT_PENDING_CONFIRMATION' | 'RESULT_CONFIRMED' | 'RESULT_ANNULLED';
  readonly winnerParticipantId: string | null;
}

export interface ChampionSource {
  readonly byeParticipantIds: readonly string[];
  readonly executionId: string;
  readonly formatCode: 'KNOCKOUT';
  readonly matches: readonly ChampionSourceMatch[];
  readonly roundNumber: number;
}

export interface ChampionCandidate {
  readonly participantId: string;
  readonly sourceExecutionId: string;
  readonly sourceMatchId: string;
  readonly sourceResultId: string;
  readonly sourceRoundNumber: number;
}

export function deriveChampionCandidate(source: ChampionSource): ChampionCandidate {
  if (source.executionId.trim().length === 0 || !Number.isSafeInteger(source.roundNumber) || source.roundNumber < 1) {
    throw new DomainError('DRAW_CONFIGURATION_INCOMPATIBLE', 'Champion evidence requires a valid knockout execution and round.');
  }
  if (source.byeParticipantIds.length !== 0 || source.matches.length !== 1) {
    throw new DomainError('DRAW_CONFIGURATION_INCOMPATIBLE', 'A champion can only be derived from a final knockout round with exactly one playable match and no bye.');
  }

  const finalMatch = source.matches[0];
  if (
    finalMatch === undefined ||
    finalMatch.id.trim().length === 0 ||
    finalMatch.status !== 'RESULT_CONFIRMED' ||
    finalMatch.resultId === null ||
    finalMatch.resultId.trim().length === 0 ||
    finalMatch.winnerParticipantId === null ||
    finalMatch.winnerParticipantId.trim().length === 0
  ) {
    throw new DomainError('DRAW_CONFIGURATION_INCOMPATIBLE', 'The final match must expose one confirmed result and winner before a champion can be proposed.');
  }

  return Object.freeze({
    participantId: finalMatch.winnerParticipantId,
    sourceExecutionId: source.executionId,
    sourceMatchId: finalMatch.id,
    sourceResultId: finalMatch.resultId,
    sourceRoundNumber: source.roundNumber,
  });
}
