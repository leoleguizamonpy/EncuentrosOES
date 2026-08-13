import type { AccountRole } from '../identity/identity-store.js';

export interface CatalogItem {
  readonly code: string;
  readonly id: string;
  readonly name: string;
}

export interface CompetitionCatalog {
  readonly combinations: readonly {
    readonly event: CatalogItem;
    readonly modality: CatalogItem;
    readonly sport: CatalogItem;
  }[];
  readonly editions: readonly {
    readonly id: string;
    readonly name: string;
    readonly year: number;
  }[];
}

export interface CompetitionSummary {
  readonly createdAt: string;
  readonly edition: { readonly id: string; readonly name: string; readonly year: number };
  readonly event: CatalogItem;
  readonly formatCode: 'GROUP_STAGE' | 'KNOCKOUT' | null;
  readonly id: string;
  readonly modality: CatalogItem;
  readonly participantCount: number;
  readonly revision: number;
  readonly sport: CatalogItem;
  readonly status: 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
}

export interface CreateStoredCompetitionInput {
  readonly actorId: string;
  readonly actorRole: AccountRole;
  readonly correlationId: string;
  readonly editionId: string;
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly modalityId: string;
  readonly sportId: string;
}

export type CompetitionStoreErrorCode =
  | 'CATALOG_SELECTION_INVALID'
  | 'COMPETITION_ALREADY_EXISTS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS';

export class CompetitionStoreError extends Error {
  public constructor(public readonly code: CompetitionStoreErrorCode, message: string) {
    super(message);
    this.name = 'CompetitionStoreError';
  }
}

export interface CompetitionStore {
  catalog(): Promise<CompetitionCatalog>;
  create(input: CreateStoredCompetitionInput): Promise<CompetitionSummary>;
  list(): Promise<readonly CompetitionSummary[]>;
}

export const COMPETITION_STORE = Symbol('COMPETITION_STORE');
