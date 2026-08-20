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

export interface PublicCompetitionJourney {
  readonly champion: Readonly<{
    confirmedAt: string;
    participantDisplayName: string;
    participantId: string;
  }> | null;
  readonly competition: Readonly<{
    edition: string;
    event: string;
    finalizedAt: string | null;
    id: string;
    modality: string;
    sport: string;
    status: 'FINALIZED' | 'LOCKED';
  }>;
  readonly rounds: readonly Readonly<{
    confirmedAt: string;
    executionId: string;
    formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
    groups: readonly Readonly<{
      label: string;
      members: readonly Readonly<{ displayName: string; id: string }>[];
      ordinal: number;
      standings: readonly Readonly<{
        draws: number;
        losses: number;
        participant: Readonly<{ displayName: string; id: string }>;
        played: number;
        position: number;
        scoreAgainst: number;
        scoreDifference: number;
        scoreFor: number;
        setDifference: number;
        setsLost: number;
        setsWon: number;
        sportPointDifference: number;
        sportPointsAgainst: number;
        sportPointsFor: number;
        tablePoints: number;
        tied: boolean;
        wins: number;
      }>[];
    }>[];
    matches: readonly Readonly<{
      groupLabel: string | null;
      id: string;
      ordinal: number;
      participantA: Readonly<{ displayName: string; id: string }>;
      participantB: Readonly<{ displayName: string; id: string }>;
      result: Readonly<{ detail: unknown; resolved: unknown }> | null;
      winnerParticipantId: string | null;
    }>[];
    publication: Readonly<{
      id: string;
      publishedAt: string;
      verificationCode: string;
    }>;
    roundNumber: number;
  }>[];
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
  publicJourney(competitionId: string): Promise<PublicCompetitionJourney | null>;
}

export const CHAMPION_STORE = Symbol('CHAMPION_STORE');
