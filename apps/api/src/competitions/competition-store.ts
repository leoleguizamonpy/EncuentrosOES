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
  readonly groupCount: number | null;
  readonly id: string;
  readonly modality: CatalogItem;
  readonly participantCount: number;
  readonly revision: number;
  readonly sport: CatalogItem;
  readonly status: 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
}

export interface CompetitionDetail extends CompetitionSummary {
  readonly institutions: readonly {
    readonly code: string;
    readonly id: string;
    readonly name: string;
    readonly selected: boolean;
  }[];
  readonly participants: readonly {
    readonly displayName: string;
    readonly enabledAt: string;
    readonly id: string;
    readonly institutionId: string;
    readonly status: 'ENABLED' | 'WITHDRAWN';
  }[];
  readonly ruleSet: CompetitionRuleSetView | null;
  readonly validGroupCounts: readonly number[];
}

export type ScoreTieBreakCriterion =
  | 'HEAD_TO_HEAD_TABLE_POINTS'
  | 'SCORE_DIFFERENCE'
  | 'SCORE_FOR'
  | 'TABLE_POINTS'
  | 'WINS';

export type SetTieBreakCriterion =
  | 'HEAD_TO_HEAD_TABLE_POINTS'
  | 'SETS_WON'
  | 'SET_DIFFERENCE'
  | 'SPORT_POINTS_FOR'
  | 'SPORT_POINT_DIFFERENCE'
  | 'TABLE_POINTS'
  | 'WINS';

export type RuleSetConfiguration =
  | Readonly<{
      allowDraws: boolean;
      drawPoints: number | null;
      lossPoints: number;
      resultProfile: 'SCORE_BASED';
      tieBreakCriteria: readonly ScoreTieBreakCriterion[];
      winPoints: number;
    }>
  | Readonly<{
      lossPoints: number;
      resultProfile: 'SET_BASED';
      setsToWin: number;
      tieBreakCriteria: readonly SetTieBreakCriterion[];
      winPoints: number;
    }>;

export type CompetitionRuleSetView = RuleSetConfiguration & Readonly<{
  readonly canonicalHash: string | null;
  readonly frozenAt: string | null;
  readonly id: string;
  readonly revision: number;
  readonly status: 'DRAFT' | 'FROZEN' | 'REPLACED';
}>;

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

interface CompetitionMutationInput {
  readonly actorId: string;
  readonly actorRole: AccountRole;
  readonly competitionId: string;
  readonly correlationId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
}

export interface AddStoredParticipantInput extends CompetitionMutationInput {
  readonly institutionId: string;
}

export type ConfigureStoredFormatInput = CompetitionMutationInput & (
  | Readonly<{ formatCode: 'GROUP_STAGE'; groupCount: number }>
  | Readonly<{ formatCode: 'KNOCKOUT'; groupCount: null }>
);

export type SaveStoredRuleSetInput = Omit<CompetitionMutationInput, 'expectedRevision'> &
  RuleSetConfiguration & Readonly<{ expectedRevision: number | null }>;

export type FreezeStoredRuleSetInput = CompetitionMutationInput;

export type CompetitionStoreErrorCode =
  | 'CATALOG_SELECTION_INVALID'
  | 'COMPETITION_ALREADY_EXISTS'
  | 'COMPETITION_NOT_FOUND'
  | 'COMPETITION_NOT_EDITABLE'
  | 'CONCURRENCY_CONFLICT'
  | 'DUPLICATE_PARTICIPANT'
  | 'FORMAT_CONFIGURATION_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INSTITUTION_INVALID'
  | 'RULE_SET_INVALID'
  | 'RULE_SET_NOT_FOUND';

export class CompetitionStoreError extends Error {
  public constructor(public readonly code: CompetitionStoreErrorCode, message: string) {
    super(message);
    this.name = 'CompetitionStoreError';
  }
}

export interface CompetitionStore {
  addParticipant(input: AddStoredParticipantInput): Promise<CompetitionDetail>;
  catalog(): Promise<CompetitionCatalog>;
  configureFormat(input: ConfigureStoredFormatInput): Promise<CompetitionDetail>;
  create(input: CreateStoredCompetitionInput): Promise<CompetitionSummary>;
  detail(id: string): Promise<CompetitionDetail>;
  freezeRuleSet(input: FreezeStoredRuleSetInput): Promise<CompetitionDetail>;
  list(): Promise<readonly CompetitionSummary[]>;
  saveRuleSet(input: SaveStoredRuleSetInput): Promise<CompetitionDetail>;
}

export const COMPETITION_STORE = Symbol('COMPETITION_STORE');
