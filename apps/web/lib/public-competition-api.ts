export interface PublicCompetitionJourney {
  readonly champion: Readonly<{
    confirmedAt: string;
    participantDisplayName: string;
    participantId: string;
  }>;
  readonly competition: Readonly<{
    edition: string;
    event: string;
    finalizedAt: string;
    id: string;
    modality: string;
    sport: string;
    status: 'FINALIZED';
  }>;
  readonly rounds: readonly Readonly<{
    confirmedAt: string;
    executionId: string;
    formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
    matches: readonly Readonly<{
      groupLabel: string | null;
      id: string;
      ordinal: number;
      participantA: Readonly<{ displayName: string; id: string }>;
      participantB: Readonly<{ displayName: string; id: string }>;
      result: Readonly<{ detail: unknown; resolved: unknown }>;
      winnerParticipantId: string | null;
    }>[];
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
