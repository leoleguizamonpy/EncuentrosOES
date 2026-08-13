import type { AccountRole } from '../identity/identity-store.js';

export interface DrawConfigurationView {
  readonly canonicalHash: string;
  readonly formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
  readonly groupCount: number | null;
  readonly id: string;
  readonly participantCount: number;
  readonly revision: number;
  readonly roundNumber: number;
  readonly status: 'FROZEN';
}

export interface DrawParticipantView {
  readonly displayName: string;
  readonly id: string;
}

export interface DrawAuthorityView {
  readonly displayName: string;
  readonly id: string;
}

export type OfficialDrawResultView =
  | Readonly<{
      formatCode: 'GROUP_STAGE';
      groups: readonly Readonly<{
        label: string;
        members: readonly DrawParticipantView[];
        ordinal: number;
      }>[];
    }>
  | Readonly<{
      bye: Readonly<{ participant: DrawParticipantView; priorByeCount: number }> | null;
      formatCode: 'KNOCKOUT';
      pairings: readonly Readonly<{
        ordinal: number;
        participantA: DrawParticipantView;
        participantB: DrawParticipantView;
      }>[];
      roundNumber: number;
    }>;

export interface OfficialDrawView {
  readonly confirmedAt: string | null;
  readonly confirmedBy: DrawAuthorityView | null;
  readonly evidenceHash: string;
  readonly executedAt: string;
  readonly executedBy: DrawAuthorityView;
  readonly id: string;
  readonly matchCount: number;
  readonly result: OfficialDrawResultView;
  readonly revision: number;
  readonly seedCommitment: string;
  readonly seedHex: string | null;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

export interface DrawWorkspace {
  readonly competitionId: string;
  readonly competitionRevision: number;
  readonly competitionStatus: 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
  readonly configuration: DrawConfigurationView | null;
  readonly execution: OfficialDrawView | null;
}

interface DrawMutationInput {
  readonly actorId: string;
  readonly actorRole: AccountRole;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export interface PrepareDrawInput extends DrawMutationInput {
  readonly competitionId: string;
  readonly expectedRevision: number;
}

export interface ExecuteDrawInput extends DrawMutationInput {
  readonly configurationId: string;
  readonly expectedRevision: number;
}

export interface ConfirmDrawInput extends DrawMutationInput {
  readonly executionId: string;
  readonly expectedRevision: number;
}

export interface AnnulDrawInput extends ConfirmDrawInput {
  readonly reason: string;
}

export type DrawStoreErrorCode =
  | 'COMPETITION_NOT_FOUND'
  | 'CONCURRENCY_CONFLICT'
  | 'DRAW_CONFIRMATION_INVALID'
  | 'DRAW_ANNULMENT_INVALID'
  | 'DRAW_CONFIGURATION_INVALID'
  | 'DRAW_EXECUTION_INVALID'
  | 'DRAW_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS';

export class DrawStoreError extends Error {
  public constructor(public readonly code: DrawStoreErrorCode, message: string) {
    super(message);
    this.name = 'DrawStoreError';
  }
}

export interface DrawStore {
  annul(input: AnnulDrawInput): Promise<DrawWorkspace>;
  confirm(input: ConfirmDrawInput): Promise<DrawWorkspace>;
  execute(input: ExecuteDrawInput): Promise<DrawWorkspace>;
  prepare(input: PrepareDrawInput): Promise<DrawWorkspace>;
  workspace(competitionId: string): Promise<DrawWorkspace>;
}

export const DRAW_STORE = Symbol('DRAW_STORE');
