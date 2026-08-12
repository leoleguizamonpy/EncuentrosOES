import { DomainError } from '../errors/domain-error.js';
import type { AuthorityRole } from '../draw/official-draw.js';
import type { CompetitionRuleSetSnapshot } from '../rules/competition-rule-set.js';

export type MatchResultStatus = 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';

export type ResultDetail =
  | Readonly<{ profile: 'SCORE_BASED'; scoreA: number; scoreB: number }>
  | Readonly<{
      profile: 'SET_BASED';
      sets: readonly Readonly<{ pointsA: number; pointsB: number }>[];
    }>;

export interface ResolvedResult {
  readonly draws: boolean;
  readonly outcomeA: 'DRAW' | 'LOSS' | 'WIN';
  readonly outcomeB: 'DRAW' | 'LOSS' | 'WIN';
  readonly scoreA: number;
  readonly scoreB: number;
  readonly setsWonA: number;
  readonly setsWonB: number;
  readonly sportPointsA: number;
  readonly sportPointsB: number;
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

export function resolveResult(
  participantAId: string,
  participantBId: string,
  detail: ResultDetail,
  ruleSet: CompetitionRuleSetSnapshot,
): ResolvedResult {
  if (ruleSet.status !== 'FROZEN' || detail.profile !== ruleSet.resultProfile) {
    throw new DomainError('RESULT_DETAIL_INVALID', 'Result and frozen rule profile must match.');
  }
  let scoreA = 0;
  let scoreB = 0;
  let setsWonA = 0;
  let setsWonB = 0;
  let sportPointsA = 0;
  let sportPointsB = 0;
  if (detail.profile === 'SCORE_BASED') {
    nonNegative(detail.scoreA, 'scoreA');
    nonNegative(detail.scoreB, 'scoreB');
    scoreA = detail.scoreA;
    scoreB = detail.scoreB;
    sportPointsA = scoreA;
    sportPointsB = scoreB;
    if (
      (ruleSet.profileConfig.profile !== 'SCORE_BASED' || !ruleSet.profileConfig.allowDraws) &&
      scoreA === scoreB
    ) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'This competition does not allow draws.');
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
  }
  const draws = scoreA === scoreB;
  return Object.freeze({
    draws,
    outcomeA: draws ? 'DRAW' : scoreA > scoreB ? 'WIN' : 'LOSS',
    outcomeB: draws ? 'DRAW' : scoreB > scoreA ? 'WIN' : 'LOSS',
    scoreA,
    scoreB,
    setsWonA,
    setsWonB,
    sportPointsA,
    sportPointsB,
    winnerParticipantId: draws ? null : scoreA > scoreB ? participantAId : participantBId,
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
    if (JSON.stringify(reproduced) !== JSON.stringify(snapshot.resolved)) {
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
    if (this.#snapshot.status !== 'PENDING_CONFIRMATION' || input.actorId === this.#snapshot.recordedBy) {
      throw new DomainError('RESULT_CONFIRMATION_INVALID', 'Another authority must confirm a pending result.');
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
