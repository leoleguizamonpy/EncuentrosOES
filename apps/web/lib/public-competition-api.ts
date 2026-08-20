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

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

export async function publicCompetitionJourney(competitionId: string): Promise<PublicCompetitionJourney | null> {
  const response = await fetch(`${apiUrl}/public/competitions/${competitionId}/journey`, { cache: 'no-store' });
  if (!response.ok) {
    try {
      const body = await response.json() as ProblemDetails;
      throw new Error(typeof body.detail === 'string' ? body.detail : 'No fue posible cargar la competencia pública.');
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error('No fue posible cargar la competencia pública.');
    }
  }
  return response.json() as Promise<PublicCompetitionJourney | null>;
}
