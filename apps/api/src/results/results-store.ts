export interface ResultParticipantView {
  readonly displayName: string;
  readonly id: string;
}

export interface MatchResultView {
  readonly confirmedAt: string | null;
  readonly confirmedBy: ResultParticipantView | null;
  readonly detail: unknown;
  readonly id: string;
  readonly recordedAt: string;
  readonly recordedBy: ResultParticipantView;
  readonly resolved: unknown;
  readonly revision: number;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

export interface ResultMatchView {
  readonly group: Readonly<{ id: string; label: string }> | null;
  readonly id: string;
  readonly ordinal: number;
  readonly participantA: ResultParticipantView;
  readonly participantB: ResultParticipantView;
  readonly result: MatchResultView | null;
  readonly roundNumber: number;
  readonly status: 'PENDING_RESULT' | 'RESULT_CONFIRMED' | 'RESULT_PENDING_CONFIRMATION';
  readonly winnerParticipantId: string | null;
}

export interface StandingRowView {
  readonly draws: number;
  readonly losses: number;
  readonly participant: ResultParticipantView;
  readonly played: number;
  readonly position: number;
  readonly scoreAgainst: number;
  readonly scoreDifference: number;
  readonly scoreFor: number;
  readonly setDifference: number;
  readonly setsLost: number;
  readonly setsWon: number;
  readonly sportPointDifference: number;
  readonly sportPointsAgainst: number;
  readonly sportPointsFor: number;
  readonly tablePoints: number;
  readonly tied: boolean;
  readonly wins: number;
}

export interface ResultGroupView {
  readonly complete: boolean;
  readonly id: string;
  readonly label: string;
  readonly ordinal: number;
  readonly qualification: GroupQualificationView | null;
  readonly standings: readonly StandingRowView[];
}

export interface GroupQualificationView {
  readonly confirmedAt: string | null;
  readonly confirmedBy: ResultParticipantView | null;
  readonly firstParticipant: ResultParticipantView;
  readonly id: string;
  readonly proposedAt: string;
  readonly proposedBy: ResultParticipantView;
  readonly revision: number;
  readonly secondParticipant: ResultParticipantView;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

export interface ResultsWorkspace {
  readonly competitionId: string;
  readonly competitionStatus: 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
  readonly groups: readonly ResultGroupView[];
  readonly matches: readonly ResultMatchView[];
  readonly resultProfile: 'SCORE_BASED' | 'SET_BASED' | null;
}

interface ResultMutationInput {
  readonly actorId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export type AdministrativeOutcome =
  | 'ABANDONED_A'
  | 'ABANDONED_B'
  | 'NO_SHOW_A'
  | 'NO_SHOW_B'
  | 'NO_SHOW_BOTH'
  | 'WITHDRAWN_A'
  | 'WITHDRAWN_B';

export interface RecordResultInput extends ResultMutationInput {
  readonly detail:
    | Readonly<{ profile: 'SCORE_BASED'; scoreA: number; scoreB: number; tieBreak?: Readonly<{ method: 'PENALTIES'; scoreA: number; scoreB: number }> }>
    | Readonly<{ profile: 'SET_BASED'; sets: readonly Readonly<{ pointsA: number; pointsB: number }>[] }>
    | Readonly<{ profile: 'ADMINISTRATIVE'; outcome: AdministrativeOutcome }>;
  readonly matchId: string;
}

export interface ConfirmResultInput extends ResultMutationInput {
  readonly expectedRevision: number;
  readonly resultId: string;
}

export interface AnnulResultInput extends ConfirmResultInput {
  readonly reason: string;
}

export interface ConfirmQualificationInput extends ResultMutationInput {
  readonly expectedRevision: number;
  readonly qualificationId: string;
}

export class ResultsStoreError extends Error {
  public constructor(public readonly code: 'COMPETITION_NOT_FOUND' | 'RESULTS_INTEGRITY_FAILURE', message: string) {
    super(message);
    this.name = 'ResultsStoreError';
  }
}

export interface ResultsStore {
  annul(input: AnnulResultInput): Promise<ResultsWorkspace>;
  confirm(input: ConfirmResultInput): Promise<ResultsWorkspace>;
  confirmQualification(input: ConfirmQualificationInput): Promise<ResultsWorkspace>;
  record(input: RecordResultInput): Promise<ResultsWorkspace>;
  workspace(competitionId: string): Promise<ResultsWorkspace>;
}

export const RESULTS_STORE = Symbol('RESULTS_STORE');
