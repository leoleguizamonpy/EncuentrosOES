import type { AccountRole } from '../identity/identity-store.js';

export interface NextRoundConfigurationView {
  readonly canonicalHash: string;
  readonly id: string;
  readonly participantCount: number;
  readonly roundNumber: number;
  readonly status: 'FROZEN';
}

export interface NextRoundView {
  readonly competitionId: string;
  readonly competitionRevision: number;
  readonly configuration: NextRoundConfigurationView;
}

export interface PrepareNextRoundInput {
  readonly actorId: string;
  readonly actorRole: AccountRole;
  readonly competitionId: string;
  readonly correlationId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
}

export type NextRoundStoreErrorCode =
  | 'CONCURRENCY_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'NEXT_ROUND_INVALID';

export class NextRoundStoreError extends Error {
  public constructor(public readonly code: NextRoundStoreErrorCode, message: string) {
    super(message);
    this.name = 'NextRoundStoreError';
  }
}

export interface NextRoundStore {
  prepare(input: PrepareNextRoundInput): Promise<NextRoundView>;
}

export const NEXT_ROUND_STORE = Symbol('NEXT_ROUND_STORE');
