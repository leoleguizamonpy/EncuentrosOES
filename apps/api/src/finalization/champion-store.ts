import type { AccountRole } from '../identity/identity-store.js';

export interface ChampionView {
  readonly competitionId: string;
  readonly competitionRevision: number;
  readonly confirmedAt: string | null;
  readonly confirmedBy: string | null;
  readonly participantDisplayName: string;
  readonly participantId: string;
  readonly proposalId: string;
  readonly proposedAt: string;
  readonly proposedBy: string;
  readonly sourceExecutionId: string;
  readonly sourceMatchId: string;
  readonly sourceResultId: string;
  readonly sourceRoundNumber: number;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

interface ChampionMutationInput {
  readonly actorId: string;
  readonly actorRole: AccountRole;
  readonly competitionId: string;
  readonly correlationId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
}

export type ProposeChampionInput = ChampionMutationInput;
export interface ConfirmChampionInput extends ChampionMutationInput { readonly proposalId: string }

export type ChampionStoreErrorCode =
  | 'CHAMPION_INVALID'
  | 'CONCURRENCY_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS';

export class ChampionStoreError extends Error {
  public constructor(public readonly code: ChampionStoreErrorCode, message: string) {
    super(message);
    this.name = 'ChampionStoreError';
  }
}

export interface ChampionStore {
  confirm(input: ConfirmChampionInput): Promise<ChampionView>;
  find(competitionId: string): Promise<ChampionView | null>;
  propose(input: ProposeChampionInput): Promise<ChampionView>;
}

export const CHAMPION_STORE = Symbol('CHAMPION_STORE');
