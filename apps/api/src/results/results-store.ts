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
  readonly standings: readonly StandingRowView[];
}

export interface ResultsWorkspace {
  readonly competitionId: string;
  readonly competitionStatus: 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
  readonly groups: readonly ResultGroupView[];
  readonly matches: readonly ResultMatchView[];
  readonly resultProfile: 'SCORE_BASED' | 'SET_BASED' | null;
}

export class ResultsStoreError extends Error {
  public constructor(public readonly code: 'COMPETITION_NOT_FOUND' | 'RESULTS_INTEGRITY_FAILURE', message: string) {
    super(message);
    this.name = 'ResultsStoreError';
  }
}

export interface ResultsStore {
  workspace(competitionId: string): Promise<ResultsWorkspace>;
}

export const RESULTS_STORE = Symbol('RESULTS_STORE');
