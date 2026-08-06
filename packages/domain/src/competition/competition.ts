import { DomainError } from '../errors/domain-error.js';

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
  readonly key: CompetitionKey;
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
  #revision: number;
  #status: CompetitionStatus;
  #updatedAt: Date;
  #updatedBy: string;

  private constructor(snapshot: CompetitionSnapshot) {
    this.#id = snapshot.id;
    this.#key = Object.freeze({ ...snapshot.key });
    this.#status = snapshot.status;
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
      key: input.key,
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

  public toSnapshot(): CompetitionSnapshot {
    return Object.freeze({
      createdAt: new Date(this.#createdAt),
      createdBy: this.#createdBy,
      id: this.#id,
      key: Object.freeze({ ...this.#key }),
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
