import { DomainError } from '../errors/domain-error.js';
import type { AuthorityRole } from '../draw/official-draw.js';
import type { GroupTableRow } from './group-table.js';

export type GroupQualificationStatus =
  | 'ANNULLED'
  | 'CONFIRMED'
  | 'INVALIDATED'
  | 'PENDING_CONFIRMATION';

export interface GroupQualificationSnapshot {
  readonly annulledAt: Date | null;
  readonly annulledBy: string | null;
  readonly annulmentReason: string | null;
  readonly competitionId: string;
  readonly confirmedAt: Date | null;
  readonly confirmedBy: string | null;
  readonly firstParticipantId: string;
  readonly groupId: string;
  readonly id: string;
  readonly invalidatedAt: Date | null;
  readonly invalidatedBy: string | null;
  readonly invalidationReason: string | null;
  readonly proposedAt: Date;
  readonly proposedBy: string;
  readonly revision: number;
  readonly secondParticipantId: string;
  readonly sourceResultIds: readonly string[];
  readonly sourceRuleSetId: string;
  readonly status: GroupQualificationStatus;
}

export interface ProposeGroupQualificationInput {
  readonly actorId: string;
  readonly actorRole: AuthorityRole;
  readonly competitionId: string;
  readonly groupId: string;
  readonly id: string;
  readonly occurredAt: Date;
  readonly sourceResultIds: readonly string[];
  readonly sourceRuleSetId: string;
  readonly table: readonly GroupTableRow[];
}

export interface TransitionGroupQualificationInput {
  readonly actorId: string;
  readonly actorRole: AuthorityRole;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

export interface ReasonedGroupQualificationInput extends TransitionGroupQualificationInput {
  readonly reason: string;
}

function assertAuthority(actorId: string): void {
  if (actorId.trim().length === 0) {
    throw new DomainError('QUALIFICATION_AUTHORITY_INVALID', 'An active qualification authority is required.');
  }
}

function normalizeReason(reason: string): string {
  const normalized = reason.trim().replaceAll(/\s+/g, ' ');
  if (normalized.length === 0) {
    throw new DomainError('QUALIFICATION_TRANSITION_INVALID', 'A reason is required.');
  }
  return normalized;
}

export class GroupQualification {
  #snapshot: GroupQualificationSnapshot;

  private constructor(snapshot: GroupQualificationSnapshot) {
    this.#snapshot = structuredClone(snapshot);
  }

  public static propose(input: ProposeGroupQualificationInput): GroupQualification {
    assertAuthority(input.actorId);
    const identifiers = [input.id, input.competitionId, input.groupId, input.sourceRuleSetId];
    const uniqueSources = new Set(input.sourceResultIds);
    if (
      identifiers.some((identifier) => identifier.trim().length === 0) ||
      input.table.length < 3 ||
      input.sourceResultIds.length === 0 ||
      uniqueSources.size !== input.sourceResultIds.length
    ) {
      throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'Qualification sources are incomplete.');
    }
    const first = input.table[0];
    const second = input.table[1];
    const firstOutside = input.table[2];
    if (first === undefined || second === undefined || firstOutside === undefined) {
      throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'Two qualified participants require a valid cut.');
    }
    if (input.table.slice(2).some(({ position }) => position === first.position || position === second.position)) {
      throw new DomainError('TIE_UNRESOLVED', 'An unresolved tie crosses the qualification cut.');
    }
    return new GroupQualification({
      annulledAt: null,
      annulledBy: null,
      annulmentReason: null,
      competitionId: input.competitionId,
      confirmedAt: null,
      confirmedBy: null,
      firstParticipantId: first.participantId,
      groupId: input.groupId,
      id: input.id,
      invalidatedAt: null,
      invalidatedBy: null,
      invalidationReason: null,
      proposedAt: new Date(input.occurredAt),
      proposedBy: input.actorId,
      revision: 1,
      secondParticipantId: second.participantId,
      sourceResultIds: Object.freeze([...input.sourceResultIds].sort()),
      sourceRuleSetId: input.sourceRuleSetId,
      status: 'PENDING_CONFIRMATION',
    });
  }

  public static rehydrate(snapshot: GroupQualificationSnapshot): GroupQualification {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision <= 0) {
      throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'Qualification revision must be positive.');
    }
    const hasConfirmedAt = snapshot.confirmedAt !== null;
    const hasConfirmedBy = snapshot.confirmedBy !== null;
    const requiresConfirmation = snapshot.status === 'CONFIRMED' || snapshot.status === 'ANNULLED';
    if (
      hasConfirmedAt !== hasConfirmedBy ||
      (requiresConfirmation && !hasConfirmedAt) ||
      (snapshot.status === 'PENDING_CONFIRMATION' && hasConfirmedAt)
    ) {
      throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'Qualification confirmation evidence is inconsistent.');
    }
    const invalidated = snapshot.status === 'INVALIDATED';
    if (invalidated !== (snapshot.invalidatedAt !== null && snapshot.invalidatedBy !== null && snapshot.invalidationReason !== null)) {
      throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'Qualification invalidation evidence is inconsistent.');
    }
    const annulled = snapshot.status === 'ANNULLED';
    if (annulled !== (snapshot.annulledAt !== null && snapshot.annulledBy !== null && snapshot.annulmentReason !== null)) {
      throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'Qualification annulment evidence is inconsistent.');
    }
    return new GroupQualification(snapshot);
  }

  public confirm(input: TransitionGroupQualificationInput): void {
    this.#assertRevision(input.expectedRevision);
    assertAuthority(input.actorId);
    if (this.#snapshot.status !== 'PENDING_CONFIRMATION') {
      throw new DomainError('QUALIFICATION_CONFIRMATION_INVALID', 'Only a pending qualification can be confirmed.');
    }
    if (input.actorId === this.#snapshot.proposedBy && input.actorRole !== 'SUPERADMIN') {
      throw new DomainError(
        'QUALIFICATION_CONFIRMATION_INVALID',
        'An administrator cannot confirm the same qualification they proposed.',
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

  public invalidate(input: ReasonedGroupQualificationInput): void {
    this.#assertRevision(input.expectedRevision);
    assertAuthority(input.actorId);
    if (this.#snapshot.status !== 'PENDING_CONFIRMATION' && this.#snapshot.status !== 'CONFIRMED') {
      throw new DomainError('QUALIFICATION_TRANSITION_INVALID', 'Only an active proposal can be invalidated.');
    }
    this.#snapshot = {
      ...this.#snapshot,
      invalidatedAt: new Date(input.occurredAt),
      invalidatedBy: input.actorId,
      invalidationReason: normalizeReason(input.reason),
      revision: this.#snapshot.revision + 1,
      status: 'INVALIDATED',
    };
  }

  public annul(input: ReasonedGroupQualificationInput): void {
    this.#assertRevision(input.expectedRevision);
    assertAuthority(input.actorId);
    if (input.actorRole !== 'SUPERADMIN' || this.#snapshot.status !== 'CONFIRMED') {
      throw new DomainError('QUALIFICATION_TRANSITION_INVALID', 'Only a superadministrator can annul a confirmed qualification.');
    }
    this.#snapshot = {
      ...this.#snapshot,
      annulledAt: new Date(input.occurredAt),
      annulledBy: input.actorId,
      annulmentReason: normalizeReason(input.reason),
      revision: this.#snapshot.revision + 1,
      status: 'ANNULLED',
    };
  }

  public toSnapshot(): GroupQualificationSnapshot {
    return structuredClone(this.#snapshot);
  }

  #assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.#snapshot.revision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The qualification revision is stale.');
    }
  }
}
