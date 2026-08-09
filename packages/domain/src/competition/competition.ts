import { DomainError } from '../errors/domain-error.js';
import type { DrawConfigurationSnapshot, DrawFormatCode } from '../draw/draw-configuration.js';
import type { CompetitionRuleSetSnapshot } from '../rules/competition-rule-set.js';

export type CompetitionStatus = 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
export type ParticipantStatus = 'ENABLED' | 'WITHDRAWN';

export interface CompetitionKey {
  readonly editionId: string;
  readonly eventId: string;
  readonly modalityId: string;
  readonly sportId: string;
}

export interface ParticipantSnapshot {
  readonly displayName: string;
  readonly enabledAt: Date;
  readonly enabledBy: string;
  readonly eventId: string;
  readonly id: string;
  readonly institutionId: string;
  readonly revision: number;
  readonly status: ParticipantStatus;
}

export interface CompetitionSnapshot {
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly id: string;
  readonly formatCode: DrawFormatCode | null;
  readonly key: CompetitionKey;
  readonly lockedAt: Date | null;
  readonly lockedBy: string | null;
  readonly participants: readonly ParticipantSnapshot[];
  readonly revision: number;
  readonly status: CompetitionStatus;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

export interface CreateCompetitionInput {
  readonly actorId: string;
  readonly id: string;
  readonly key: CompetitionKey;
  readonly occurredAt: Date;
}

export interface AddParticipantInput {
  readonly actorId: string;
  readonly displayName: string;
  readonly eventId: string;
  readonly expectedRevision: number;
  readonly id: string;
  readonly institutionId: string;
  readonly occurredAt: Date;
}

export interface OpenCompetitionInput {
  readonly actorId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

export interface LockCompetitionInput {
  readonly actorId: string;
  readonly drawConfiguration: Pick<
    DrawConfigurationSnapshot,
    | 'competitionId'
    | 'formatCode'
    | 'participantCount'
    | 'participants'
    | 'ruleSetId'
    | 'status'
  >;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
  readonly ruleSet: Pick<CompetitionRuleSetSnapshot, 'competitionId' | 'id' | 'status'>;
}

function normalizeDisplayName(value: string): string {
  const normalized = value.trim().replaceAll(/\s+/g, ' ');

  if (normalized.length === 0 || normalized.length > 120) {
    throw new DomainError(
      'INVALID_DISPLAY_NAME',
      'Participant display name must contain between 1 and 120 characters.',
    );
  }

  return normalized;
}

function copyParticipant(participant: ParticipantSnapshot): ParticipantSnapshot {
  return Object.freeze({
    ...participant,
    enabledAt: new Date(participant.enabledAt),
  });
}

export class Competition {
  readonly #createdAt: Date;
  readonly #createdBy: string;
  readonly #id: string;
  readonly #key: CompetitionKey;
  readonly #participants: ParticipantSnapshot[];
  #formatCode: DrawFormatCode | null;
  #lockedAt: Date | null;
  #lockedBy: string | null;
  #revision: number;
  #status: CompetitionStatus;
  #updatedAt: Date;
  #updatedBy: string;

  private constructor(snapshot: CompetitionSnapshot) {
    this.#id = snapshot.id;
    this.#key = Object.freeze({ ...snapshot.key });
    this.#status = snapshot.status;
    this.#formatCode = snapshot.formatCode;
    this.#lockedAt = snapshot.lockedAt === null ? null : new Date(snapshot.lockedAt);
    this.#lockedBy = snapshot.lockedBy;
    this.#revision = snapshot.revision;
    this.#participants = snapshot.participants.map(copyParticipant);
    this.#createdAt = new Date(snapshot.createdAt);
    this.#createdBy = snapshot.createdBy;
    this.#updatedAt = new Date(snapshot.updatedAt);
    this.#updatedBy = snapshot.updatedBy;
  }

  public static create(input: CreateCompetitionInput): Competition {
    return new Competition({
      createdAt: input.occurredAt,
      createdBy: input.actorId,
      id: input.id,
      formatCode: null,
      key: input.key,
      lockedAt: null,
      lockedBy: null,
      participants: [],
      revision: 1,
      status: 'DRAFT',
      updatedAt: input.occurredAt,
      updatedBy: input.actorId,
    });
  }

  public static rehydrate(snapshot: CompetitionSnapshot): Competition {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision <= 0) {
      throw new DomainError(
        'CONCURRENCY_CONFLICT',
        'A persisted competition must have a positive revision.',
      );
    }

    const locked = snapshot.status === 'LOCKED' || snapshot.status === 'FINALIZED';
    const hasLockEvidence =
      snapshot.lockedAt !== null && snapshot.lockedBy !== null && snapshot.formatCode !== null;
    if (locked !== hasLockEvidence) {
      throw new DomainError(
        'INVALID_COMPETITION_STATE',
        'Persisted lock evidence is inconsistent with competition status.',
      );
    }

    const institutionIds = new Set<string>();

    for (const participant of snapshot.participants) {
      if (participant.eventId !== snapshot.key.eventId) {
        throw new DomainError(
          'COMPETITION_SCOPE_MISMATCH',
          'A persisted participant belongs to another event.',
        );
      }

      if (institutionIds.has(participant.institutionId)) {
        throw new DomainError(
          'DUPLICATE_PARTICIPANT',
          'A persisted competition contains a duplicate institution.',
        );
      }

      institutionIds.add(participant.institutionId);
    }

    return new Competition(snapshot);
  }

  public addParticipant(input: AddParticipantInput): void {
    this.#assertRevision(input.expectedRevision);
    this.#assertEditable();

    if (input.eventId !== this.#key.eventId) {
      throw new DomainError(
        'COMPETITION_SCOPE_MISMATCH',
        'The institution and competition must belong to the same event.',
      );
    }

    if (
      this.#participants.some(
        ({ institutionId }) => institutionId === input.institutionId,
      )
    ) {
      throw new DomainError(
        'DUPLICATE_PARTICIPANT',
        'The institution is already enabled in this competition.',
      );
    }

    this.#participants.push(
      Object.freeze({
        displayName: normalizeDisplayName(input.displayName),
        enabledAt: new Date(input.occurredAt),
        enabledBy: input.actorId,
        eventId: input.eventId,
        id: input.id,
        institutionId: input.institutionId,
        revision: 1,
        status: 'ENABLED',
      }),
    );
    this.#recordMutation(input.actorId, input.occurredAt);
  }

  public open(input: OpenCompetitionInput): void {
    this.#assertRevision(input.expectedRevision);

    if (this.#status !== 'DRAFT') {
      throw new DomainError(
        'INVALID_COMPETITION_STATE',
        'Only a draft competition can be opened.',
      );
    }

    this.#status = 'OPEN';
    this.#recordMutation(input.actorId, input.occurredAt);
  }

  public lock(input: LockCompetitionInput): void {
    this.#assertRevision(input.expectedRevision);
    if (this.#status !== 'OPEN') {
      throw new DomainError(
        'INVALID_COMPETITION_STATE',
        'Only an open competition can be locked.',
      );
    }

    const enabledParticipantCount = this.#participants.filter(
      ({ status }) => status === 'ENABLED',
    ).length;
    const enabledParticipantIds = new Set(
      this.#participants
        .filter(({ status }) => status === 'ENABLED')
        .map(({ id }) => id),
    );
    const valid =
      input.ruleSet.competitionId === this.#id &&
      input.ruleSet.status === 'FROZEN' &&
      input.drawConfiguration.competitionId === this.#id &&
      input.drawConfiguration.status === 'FROZEN' &&
      input.drawConfiguration.ruleSetId === input.ruleSet.id &&
      input.drawConfiguration.participantCount === enabledParticipantCount &&
      input.drawConfiguration.participants.every(({ id }) => enabledParticipantIds.has(id));
    if (!valid) {
      throw new DomainError(
        'LOCK_PRECONDITION_FAILED',
        'Participants, frozen rules and frozen draw configuration must match.',
      );
    }

    this.#formatCode = input.drawConfiguration.formatCode;
    this.#lockedAt = new Date(input.occurredAt);
    this.#lockedBy = input.actorId;
    this.#status = 'LOCKED';
    this.#recordMutation(input.actorId, input.occurredAt);
  }

  public toSnapshot(): CompetitionSnapshot {
    return Object.freeze({
      createdAt: new Date(this.#createdAt),
      createdBy: this.#createdBy,
      formatCode: this.#formatCode,
      id: this.#id,
      key: Object.freeze({ ...this.#key }),
      lockedAt: this.#lockedAt === null ? null : new Date(this.#lockedAt),
      lockedBy: this.#lockedBy,
      participants: Object.freeze(this.#participants.map(copyParticipant)),
      revision: this.#revision,
      status: this.#status,
      updatedAt: new Date(this.#updatedAt),
      updatedBy: this.#updatedBy,
    });
  }

  #assertEditable(): void {
    if (this.#status !== 'DRAFT' && this.#status !== 'OPEN') {
      throw new DomainError(
        'COMPETITION_NOT_EDITABLE',
        'Participants can only change while the competition is draft or open.',
      );
    }
  }

  #assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.#revision) {
      throw new DomainError(
        'CONCURRENCY_CONFLICT',
        'The competition was modified by another operation.',
      );
    }
  }

  #recordMutation(actorId: string, occurredAt: Date): void {
    this.#revision += 1;
    this.#updatedAt = new Date(occurredAt);
    this.#updatedBy = actorId;
  }
}
