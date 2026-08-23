import { DomainError } from '../errors/domain-error.js';
import type { AuthorityRole } from '../draw/official-draw.js';
import type { CompetitionRuleSetSnapshot } from '../rules/competition-rule-set.js';

export type MatchResultStatus = 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
export type AdministrativeOutcome =
  | 'ABANDONED_A'
  | 'ABANDONED_B'
  | 'NO_SHOW_A'
  | 'NO_SHOW_B'
  | 'NO_SHOW_BOTH'
  | 'WITHDRAWN_A'
  | 'WITHDRAWN_B';
export type PenaltyTieBreak = Readonly<{ method: 'PENALTIES'; scoreA: number; scoreB: number }>;

export type ResultDetail =
  | Readonly<{ profile: 'SCORE_BASED'; scoreA: number; scoreB: number; tieBreak?: PenaltyTieBreak }>
  | Readonly<{
      profile: 'SET_BASED';
      sets: readonly Readonly<{ pointsA: number; pointsB: number }>[];
    }>
  | Readonly<{ profile: 'ADMINISTRATIVE'; outcome: AdministrativeOutcome }>;

export interface ResolvedResult {
  readonly administrativeOutcome?: AdministrativeOutcome;
  readonly draws: boolean;
  readonly outcomeA: 'DRAW' | 'LOSS' | 'WIN';
  readonly outcomeB: 'DRAW' | 'LOSS' | 'WIN';
  readonly scoreA: number;
  readonly scoreB: number;
  readonly setsWonA: number;
  readonly setsWonB: number;
  readonly sportingMetricsCounted?: boolean;
  readonly sportPointsA: number;
  readonly sportPointsB: number;
  readonly tablePointsA?: number;
  readonly tablePointsB?: number;
  readonly tieBreak?: PenaltyTieBreak;
  readonly winnerParticipantId: string | null;
}

export interface MatchResultSnapshot {
  readonly annulledAt: Date | null;
  readonly annulledBy: string | null;
  readonly annulmentReason: string | null;
  readonly confirmedAt: Date | null;
  readonly confirmedBy: string | null;
  readonly detail: ResultDetail;
  readonly id: string;
  readonly matchId: string;
  readonly participantAId: string;
  readonly participantBId: string;
  readonly recordedAt: Date;
  readonly recordedBy: string;
  readonly resolved: ResolvedResult;
  readonly revision: number;
  readonly ruleSetId: string;
  readonly status: MatchResultStatus;
}

export interface RecordMatchResultInput {
  readonly actorId: string;
  readonly actorRole: AuthorityRole;
  readonly detail: ResultDetail;
  readonly id: string;
  readonly matchId: string;
  readonly occurredAt: Date;
  readonly participantAId: string;
  readonly participantBId: string;
  readonly ruleSet: CompetitionRuleSetSnapshot;
}

export interface ConfirmMatchResultInput {
  readonly actorId: string;
  readonly actorRole: AuthorityRole;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

export interface AnnulMatchResultInput extends ConfirmMatchResultInput {
  readonly reason: string;
}

function assertAuthority(actorId: string, role: AuthorityRole): void {
  if (actorId.trim().length === 0 || !(['ADMIN', 'SUPERADMIN'] as readonly string[]).includes(role)) {
    throw new DomainError('RESULT_AUTHORITY_INVALID', 'An active result authority is required.');
  }
}

function nonNegative(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('RESULT_DETAIL_INVALID', `${field} must be a non-negative integer.`);
  }
}

function outcomePoints(ruleSet: CompetitionRuleSetSnapshot, code: 'DRAW' | 'LOSS' | 'WIN'): number {
  const outcome = ruleSet.outcomes.find((candidate) => candidate.code === code);
  if (outcome === undefined) {
    throw new DomainError('RESULT_DETAIL_INVALID', `Outcome ${code} has no point value.`);
  }
  return outcome.tablePoints;
}

function sameTieBreak(left: PenaltyTieBreak | undefined, right: PenaltyTieBreak | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.method === right.method && left.scoreA === right.scoreA && left.scoreB === right.scoreB;
}

function sameResolvedResult(left: ResolvedResult, right: ResolvedResult, detail: ResultDetail): boolean {
  const base = (
    left.draws === right.draws &&
    left.outcomeA === right.outcomeA &&
    left.outcomeB === right.outcomeB &&
    left.scoreA === right.scoreA &&
    left.scoreB === right.scoreB &&
    left.setsWonA === right.setsWonA &&
    left.setsWonB === right.setsWonB &&
    left.sportPointsA === right.sportPointsA &&
    left.sportPointsB === right.sportPointsB &&
    left.winnerParticipantId === right.winnerParticipantId
  );
  if (!base) return false;
  const extended = detail.profile === 'ADMINISTRATIVE' || (detail.profile === 'SCORE_BASED' && detail.tieBreak !== undefined);
  if (!extended) return true;
  return left.administrativeOutcome === right.administrativeOutcome &&
    left.sportingMetricsCounted === right.sportingMetricsCounted &&
    left.tablePointsA === right.tablePointsA &&
    left.tablePointsB === right.tablePointsB &&
    sameTieBreak(left.tieBreak, right.tieBreak);
}

function administrativeResolution(
  participantAId: string,
  participantBId: string,
  outcome: AdministrativeOutcome,
): ResolvedResult {
  const aLoses = outcome === 'ABANDONED_A' || outcome === 'NO_SHOW_A' || outcome === 'WITHDRAWN_A';
  const bLoses = outcome === 'ABANDONED_B' || outcome === 'NO_SHOW_B' || outcome === 'WITHDRAWN_B';
  const bothLose = outcome === 'NO_SHOW_BOTH';
  const winnerParticipantId = bothLose ? null : aLoses ? participantBId : participantAId;
  return Object.freeze({
    administrativeOutcome: outcome,
    draws: false,
    outcomeA: aLoses || bothLose ? 'LOSS' : 'WIN',
    outcomeB: bLoses || bothLose ? 'LOSS' : 'WIN',
    scoreA: 0,
    scoreB: 0,
    setsWonA: 0,
    setsWonB: 0,
    sportingMetricsCounted: false,
    sportPointsA: 0,
    sportPointsB: 0,
    tablePointsA: aLoses || bothLose ? 0 : 3,
    tablePointsB: bLoses || bothLose ? 0 : 3,
    winnerParticipantId,
  });
}

export function resolveResult(
  participantAId: string,
  participantBId: string,
  detail: ResultDetail,
  ruleSet: CompetitionRuleSetSnapshot,
): ResolvedResult {
  if (ruleSet.status !== 'FROZEN') {
    throw new DomainError('RESULT_DETAIL_INVALID', 'Results require frozen rules.');
  }
  if (detail.profile === 'ADMINISTRATIVE') {
    return administrativeResolution(participantAId, participantBId, detail.outcome);
  }
  if (detail.profile !== ruleSet.resultProfile) {
    throw new DomainError('RESULT_DETAIL_INVALID', 'Result and frozen rule profile must match.');
  }
  let scoreA = 0;
  let scoreB = 0;
  let setsWonA = 0;
  let setsWonB = 0;
  let sportPointsA = 0;
  let sportPointsB = 0;
  let tieBreak: PenaltyTieBreak | undefined;
  let winnerParticipantId: string | null = null;
  if (detail.profile === 'SCORE_BASED') {
    nonNegative(detail.scoreA, 'scoreA');
    nonNegative(detail.scoreB, 'scoreB');
    scoreA = detail.scoreA;
    scoreB = detail.scoreB;
    sportPointsA = scoreA;
    sportPointsB = scoreB;
    if (detail.tieBreak !== undefined) {
      if (scoreA !== scoreB || detail.tieBreak.method !== 'PENALTIES') {
        throw new DomainError('RESULT_DETAIL_INVALID', 'A penalty shootout can only resolve a tied score.');
      }
      nonNegative(detail.tieBreak.scoreA, 'tieBreak.scoreA');
      nonNegative(detail.tieBreak.scoreB, 'tieBreak.scoreB');
      if (detail.tieBreak.scoreA === detail.tieBreak.scoreB) {
        throw new DomainError('RESULT_DETAIL_INVALID', 'A penalty shootout must determine a winner.');
      }
      tieBreak = Object.freeze({ ...detail.tieBreak });
      winnerParticipantId = detail.tieBreak.scoreA > detail.tieBreak.scoreB ? participantAId : participantBId;
    } else if (scoreA !== scoreB) {
      winnerParticipantId = scoreA > scoreB ? participantAId : participantBId;
    } else if (ruleSet.profileConfig.profile !== 'SCORE_BASED' || !ruleSet.profileConfig.allowDraws) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'This competition does not allow unresolved draws.');
    }
  } else {
    if (ruleSet.profileConfig.profile !== 'SET_BASED' || detail.sets.length === 0) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'A set result requires played sets.');
    }
    for (const set of detail.sets) {
      nonNegative(set.pointsA, 'set.pointsA');
      nonNegative(set.pointsB, 'set.pointsB');
      if (set.pointsA === set.pointsB) {
        throw new DomainError('RESULT_DETAIL_INVALID', 'A played set cannot finish tied.');
      }
      sportPointsA += set.pointsA;
      sportPointsB += set.pointsB;
      if (set.pointsA > set.pointsB) setsWonA += 1;
      else setsWonB += 1;
    }
    if (
      Math.max(setsWonA, setsWonB) !== ruleSet.profileConfig.setsToWin ||
      Math.min(setsWonA, setsWonB) >= ruleSet.profileConfig.setsToWin
    ) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Set result does not reach the configured win target.');
    }
    scoreA = setsWonA;
    scoreB = setsWonB;
    winnerParticipantId = scoreA > scoreB ? participantAId : participantBId;
  }
  const draws = winnerParticipantId === null;
  const outcomeA = draws ? 'DRAW' : winnerParticipantId === participantAId ? 'WIN' : 'LOSS';
  const outcomeB = draws ? 'DRAW' : winnerParticipantId === participantBId ? 'WIN' : 'LOSS';
  return Object.freeze({
    draws,
    outcomeA,
    outcomeB,
    scoreA,
    scoreB,
    setsWonA,
    setsWonB,
    sportingMetricsCounted: true,
    sportPointsA,
    sportPointsB,
    tablePointsA: outcomePoints(ruleSet, outcomeA),
    tablePointsB: outcomePoints(ruleSet, outcomeB),
    ...(tieBreak === undefined ? {} : { tieBreak }),
    winnerParticipantId,
  });
}

export class MatchResult {
  #snapshot: MatchResultSnapshot;

  private constructor(snapshot: MatchResultSnapshot) {
    this.#snapshot = structuredClone(snapshot);
  }

  public static record(input: RecordMatchResultInput): MatchResult {
    assertAuthority(input.actorId, input.actorRole);
    if (
      input.id.trim().length === 0 ||
      input.matchId.trim().length === 0 ||
      input.participantAId === input.participantBId
    ) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Result identifiers are invalid.');
    }
    return new MatchResult({
      annulledAt: null,
      annulledBy: null,
      annulmentReason: null,
      confirmedAt: null,
      confirmedBy: null,
      detail: structuredClone(input.detail),
      id: input.id,
      matchId: input.matchId,
      participantAId: input.participantAId,
      participantBId: input.participantBId,
      recordedAt: input.occurredAt,
      recordedBy: input.actorId,
      resolved: resolveResult(
        input.participantAId,
        input.participantBId,
        input.detail,
        input.ruleSet,
      ),
      revision: 1,
      ruleSetId: input.ruleSet.id,
      status: 'PENDING_CONFIRMATION',
    });
  }

  public static rehydrate(
    snapshot: MatchResultSnapshot,
    ruleSet: CompetitionRuleSetSnapshot,
  ): MatchResult {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision <= 0) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Result revision must be positive.');
    }
    const reproduced = resolveResult(
      snapshot.participantAId,
      snapshot.participantBId,
      snapshot.detail,
      ruleSet,
    );
    if (!sameResolvedResult(reproduced, snapshot.resolved, snapshot.detail)) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Persisted result resolution is invalid.');
    }
    const confirmed = snapshot.status === 'CONFIRMED' || snapshot.status === 'ANNULLED';
    if (confirmed !== (snapshot.confirmedAt !== null && snapshot.confirmedBy !== null)) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Result confirmation evidence is inconsistent.');
    }
    const annulled = snapshot.status === 'ANNULLED';
    const hasAnnulment = snapshot.annulledAt !== null && snapshot.annulledBy !== null && snapshot.annulmentReason !== null;
    if (annulled !== hasAnnulment) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Result annulment evidence is inconsistent.');
    }
    return new MatchResult(snapshot);
  }

  public confirm(input: ConfirmMatchResultInput): void {
    this.#assertRevision(input.expectedRevision);
    assertAuthority(input.actorId, input.actorRole);
    if (this.#snapshot.status !== 'PENDING_CONFIRMATION') {
      throw new DomainError('RESULT_CONFIRMATION_INVALID', 'Only a pending result can be confirmed.');
    }
    if (input.actorId === this.#snapshot.recordedBy && input.actorRole !== 'SUPERADMIN') {
      throw new DomainError(
        'RESULT_CONFIRMATION_INVALID',
        'An administrator cannot confirm the same result they recorded.',
      );
    }
    this.#snapshot = {
      ...this.#snapshot,
      confirmedAt: new Date(input.occurredAt),
      confirmedBy: input.actorId,
      revision: this.#snapshot.revision + 1,
      status: 'CONFIRMED',
    };
  }

  public annul(input: AnnulMatchResultInput): void {
    this.#assertRevision(input.expectedRevision);
    assertAuthority(input.actorId, input.actorRole);
    const reason = input.reason.trim().replaceAll(/\s+/g, ' ');
    if (input.actorRole !== 'SUPERADMIN' || this.#snapshot.status !== 'CONFIRMED' || reason.length === 0) {
      throw new DomainError('RESULT_ANNULMENT_INVALID', 'Only a superadministrator can annul a confirmed result with a reason.');
    }
    this.#snapshot = {
      ...this.#snapshot,
      annulledAt: new Date(input.occurredAt),
      annulledBy: input.actorId,
      annulmentReason: reason,
      revision: this.#snapshot.revision + 1,
      status: 'ANNULLED',
    };
  }

  public toSnapshot(): MatchResultSnapshot {
    return structuredClone(this.#snapshot);
  }

  #assertRevision(expected: number): void {
    if (expected !== this.#snapshot.revision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The result revision is stale.');
    }
  }
}
