export interface HistoryParticipantView {
  readonly displayName: string;
  readonly id: string;
}

export interface HistoryResultView {
  readonly annulledAt: string | null;
  readonly annulmentReason: string | null;
  readonly confirmedAt: string | null;
  readonly detail: unknown;
  readonly id: string;
  readonly recordedAt: string;
  readonly resolved: unknown;
  readonly status: 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

export interface HistoryMatchView {
  readonly groupLabel: string | null;
  readonly id: string;
  readonly ordinal: number;
  readonly participantA: HistoryParticipantView;
  readonly participantB: HistoryParticipantView;
  readonly results: readonly HistoryResultView[];
  readonly roundNumber: number;
  readonly status: string;
  readonly winnerParticipantId: string | null;
}

export interface HistoryStandingView {
  readonly draws: number;
  readonly losses: number;
  readonly participant: HistoryParticipantView;
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

export interface HistoryGroupView {
  readonly id: string;
  readonly label: string;
  readonly ordinal: number;
  readonly qualified: readonly HistoryParticipantView[];
  readonly standings: readonly HistoryStandingView[];
}

export interface HistoryExecutionView {
  readonly annulledAt: string | null;
  readonly annulmentReason: string | null;
  readonly bye: Readonly<{ participant: HistoryParticipantView; priorByeCount: number }> | null;
  readonly confirmedAt: string | null;
  readonly executedAt: string;
  readonly formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
  readonly groups: readonly HistoryGroupView[];
  readonly id: string;
  readonly matches: readonly HistoryMatchView[];
  readonly publication: Readonly<{ id: string; publishedAt: string; verificationCode: string }> | null;
  readonly resultProfile: 'SCORE_BASED' | 'SET_BASED';
  readonly roundNumber: number;
  readonly status: 'ANNULLED' | 'CONFIRMED';
}

export interface CompetitionHistoryView {
  readonly competitionId: string;
  readonly executions: readonly HistoryExecutionView[];
}

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

export async function competitionHistory(competitionId: string): Promise<CompetitionHistoryView> {
  const response = await fetch(`${apiUrl}/competitions/${competitionId}/history`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    try {
      const body = await response.json() as ProblemDetails;
      if (typeof body.detail === 'string' && body.detail.length > 0) throw new Error(body.detail);
    } catch (caught: unknown) {
      if (caught instanceof Error) throw caught;
    }
    throw new Error('No fue posible recuperar el historial competitivo.');
  }
  return response.json() as Promise<CompetitionHistoryView>;
}
