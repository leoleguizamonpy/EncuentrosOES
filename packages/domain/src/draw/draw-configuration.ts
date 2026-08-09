import { createHash } from 'node:crypto';

import { DomainError } from '../errors/domain-error.js';
import { planGroupDistribution } from '../competition/group-distribution.js';
import { canonicalize, type CanonicalJsonValue } from '../crypto/canonical-json.js';

export type DrawFormatCode = 'GROUP_STAGE' | 'KNOCKOUT';
export type DrawConfigurationStatus = 'DISCARDED' | 'DRAFT' | 'FROZEN';

export interface DrawParticipantSnapshot {
  readonly byeCount: number;
  readonly displayName: string;
  readonly id: string;
}

type DrawShape =
  | Readonly<{ formatCode: 'GROUP_STAGE'; groupCount: number; roundNumber: 0 }>
  | Readonly<{ formatCode: 'KNOCKOUT'; groupCount: null; roundNumber: number }>;

export interface DrawConfigurationSnapshot {
  readonly algorithmVersion: 'oes-draw-v1';
  readonly canonicalHash: string | null;
  readonly competitionId: string;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly formatCode: DrawFormatCode;
  readonly frozenAt: Date | null;
  readonly frozenBy: string | null;
  readonly groupCount: number | null;
  readonly id: string;
  readonly participantCount: number;
  readonly participants: readonly DrawParticipantSnapshot[];
  readonly revision: number;
  readonly roundNumber: number;
  readonly ruleSetId: string;
  readonly status: DrawConfigurationStatus;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

interface CommonConfigurationInput {
  readonly participants: readonly DrawParticipantSnapshot[];
}

export type CreateDrawConfigurationInput = CommonConfigurationInput &
  DrawShape & {
    readonly actorId: string;
    readonly competitionId: string;
    readonly id: string;
    readonly occurredAt: Date;
    readonly ruleSetId: string;
  };

export type UpdateDrawConfigurationInput = CommonConfigurationInput &
  DrawShape & {
    readonly actorId: string;
    readonly expectedRevision: number;
    readonly occurredAt: Date;
  };

export interface FreezeDrawConfigurationInput {
  readonly actorId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

function validateShape(configuration: CommonConfigurationInput & DrawShape): void {
  const participantIds = new Set<string>();
  for (const participant of configuration.participants) {
    if (
      participant.id.length === 0 ||
      participantIds.has(participant.id) ||
      participant.displayName.trim().length === 0 ||
      !Number.isSafeInteger(participant.byeCount) ||
      participant.byeCount < 0
    ) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'Participants must be unique, named and have a non-negative bye history.',
      );
    }
    participantIds.add(participant.id);
  }

  const participantCount = configuration.participants.length;

  if (configuration.formatCode === 'GROUP_STAGE') {
    planGroupDistribution(participantCount, configuration.groupCount);
    return;
  }

  if (
    participantCount < 2 ||
    !Number.isSafeInteger(configuration.roundNumber) ||
    configuration.roundNumber <= 0
  ) {
    throw new DomainError(
      'DRAW_CONFIGURATION_INCOMPATIBLE',
      'Knockout draws require at least two participants and a positive round.',
    );
  }
}

function canonicalParticipants(
  participants: readonly DrawParticipantSnapshot[],
): readonly DrawParticipantSnapshot[] {
  return Object.freeze(
    participants
      .map((participant) => Object.freeze({ ...participant }))
      .sort((left, right) => Buffer.from(left.id).compare(Buffer.from(right.id))),
  );
}

function hash(snapshot: DrawConfigurationSnapshot): string {
  return createHash('sha256')
    .update(
      canonicalize({
        algorithmVersion: snapshot.algorithmVersion,
        competitionId: snapshot.competitionId,
        formatCode: snapshot.formatCode,
        groupCount: snapshot.groupCount,
        participants: snapshot.participants,
        roundNumber: snapshot.roundNumber,
        ruleSetId: snapshot.ruleSetId,
      } as unknown as CanonicalJsonValue),
    )
    .digest('hex');
}

export class DrawConfiguration {
  #snapshot: DrawConfigurationSnapshot;

  private constructor(snapshot: DrawConfigurationSnapshot) {
    this.#snapshot = {
      ...snapshot,
      createdAt: new Date(snapshot.createdAt),
      frozenAt: snapshot.frozenAt === null ? null : new Date(snapshot.frozenAt),
      participants: canonicalParticipants(snapshot.participants),
      updatedAt: new Date(snapshot.updatedAt),
    };
  }

  public static create(input: CreateDrawConfigurationInput): DrawConfiguration {
    validateShape(input);
    return new DrawConfiguration({
      algorithmVersion: 'oes-draw-v1',
      canonicalHash: null,
      competitionId: input.competitionId,
      createdAt: input.occurredAt,
      createdBy: input.actorId,
      formatCode: input.formatCode,
      frozenAt: null,
      frozenBy: null,
      groupCount: input.groupCount,
      id: input.id,
      participantCount: input.participants.length,
      participants: canonicalParticipants(input.participants),
      revision: 1,
      roundNumber: input.roundNumber,
      ruleSetId: input.ruleSetId,
      status: 'DRAFT',
      updatedAt: input.occurredAt,
      updatedBy: input.actorId,
    });
  }

  public static rehydrate(snapshot: DrawConfigurationSnapshot): DrawConfiguration {
    validateShape(snapshot as CommonConfigurationInput & DrawShape);
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision <= 0) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'Draw revision must be positive.');
    }
    const frozen = snapshot.status !== 'DRAFT';
    const anyEvidence =
      snapshot.canonicalHash !== null || snapshot.frozenAt !== null || snapshot.frozenBy !== null;
    const allEvidence =
      snapshot.canonicalHash !== null && snapshot.frozenAt !== null && snapshot.frozenBy !== null;
    if ((!frozen && anyEvidence) || (frozen && !allEvidence)) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INTEGRITY_FAILURE',
        'Draw freeze evidence is inconsistent.',
      );
    }
    if (frozen && hash(snapshot) !== snapshot.canonicalHash) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INTEGRITY_FAILURE',
        'The draw configuration hash is invalid.',
      );
    }
    return new DrawConfiguration(snapshot);
  }

  public update(input: UpdateDrawConfigurationInput): void {
    this.#assertRevision(input.expectedRevision);
    if (this.#snapshot.status !== 'DRAFT') {
      throw new DomainError('DRAW_CONFIGURATION_FROZEN', 'A frozen draw cannot be edited.');
    }
    validateShape(input);
    this.#snapshot = {
      ...this.#snapshot,
      formatCode: input.formatCode,
      groupCount: input.groupCount,
      participantCount: input.participants.length,
      participants: canonicalParticipants(input.participants),
      revision: this.#snapshot.revision + 1,
      roundNumber: input.roundNumber,
      updatedAt: new Date(input.occurredAt),
      updatedBy: input.actorId,
    };
  }

  public freeze(input: FreezeDrawConfigurationInput): void {
    this.#assertRevision(input.expectedRevision);
    if (this.#snapshot.status !== 'DRAFT') {
      throw new DomainError('DRAW_CONFIGURATION_FROZEN', 'Only a draft draw can be frozen.');
    }
    const frozen = {
      ...this.#snapshot,
      frozenAt: new Date(input.occurredAt),
      frozenBy: input.actorId,
      revision: this.#snapshot.revision + 1,
      status: 'FROZEN' as const,
      updatedAt: new Date(input.occurredAt),
      updatedBy: input.actorId,
    };
    this.#snapshot = { ...frozen, canonicalHash: hash(frozen) };
  }

  public toSnapshot(): DrawConfigurationSnapshot {
    return Object.freeze({
      ...this.#snapshot,
      createdAt: new Date(this.#snapshot.createdAt),
      frozenAt: this.#snapshot.frozenAt === null ? null : new Date(this.#snapshot.frozenAt),
      participants: canonicalParticipants(this.#snapshot.participants),
      updatedAt: new Date(this.#snapshot.updatedAt),
    });
  }

  #assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.#snapshot.revision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The draw was modified by another operation.');
    }
  }
}
