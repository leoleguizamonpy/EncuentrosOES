import { createHash } from 'node:crypto';

import { DomainError } from '../errors/domain-error.js';
import { planGroupDistribution } from '../competition/group-distribution.js';

export type DrawFormatCode = 'GROUP_STAGE' | 'KNOCKOUT';
export type DrawConfigurationStatus = 'DISCARDED' | 'DRAFT' | 'FROZEN';

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
  readonly revision: number;
  readonly roundNumber: number;
  readonly ruleSetId: string;
  readonly status: DrawConfigurationStatus;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

interface CommonConfigurationInput {
  readonly participantCount: number;
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
  if (!Number.isSafeInteger(configuration.participantCount)) {
    throw new DomainError('INVALID_PARTICIPANT_COUNT', 'Participant count must be an integer.');
  }

  if (configuration.formatCode === 'GROUP_STAGE') {
    planGroupDistribution(configuration.participantCount, configuration.groupCount);
    return;
  }

  if (
    configuration.participantCount < 2 ||
    !Number.isSafeInteger(configuration.roundNumber) ||
    configuration.roundNumber <= 0
  ) {
    throw new DomainError(
      'DRAW_CONFIGURATION_INCOMPATIBLE',
      'Knockout draws require at least two participants and a positive round.',
    );
  }
}

function hash(snapshot: DrawConfigurationSnapshot): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        algorithmVersion: snapshot.algorithmVersion,
        competitionId: snapshot.competitionId,
        formatCode: snapshot.formatCode,
        groupCount: snapshot.groupCount,
        participantCount: snapshot.participantCount,
        roundNumber: snapshot.roundNumber,
        ruleSetId: snapshot.ruleSetId,
      }),
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
      participantCount: input.participantCount,
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
      participantCount: input.participantCount,
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
      updatedAt: new Date(this.#snapshot.updatedAt),
    });
  }

  #assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.#snapshot.revision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The draw was modified by another operation.');
    }
  }
}
