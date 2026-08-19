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

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function problem(response: Response): Promise<Error> {
  try {
    const body = await response.json() as ProblemDetails;
    if (typeof body.detail === 'string' && body.detail.length > 0) return new Error(body.detail);
  } catch {
    // A safe generic message is returned below.
  }
  return new Error('No fue posible completar la finalización de la competencia.');
}

function csrfToken(): string {
  const prefix = 'oes_csrf=';
  for (const part of document.cookie.split(';')) {
    const candidate = part.trim();
    if (candidate.startsWith(prefix)) return decodeURIComponent(candidate.slice(prefix.length));
  }
  throw new Error('La sesión no contiene protección CSRF válida.');
}

export async function champion(competitionId: string): Promise<ChampionView | null> {
  const response = await fetch(`${apiUrl}/competitions/${competitionId}/champion`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<ChampionView | null>;
}

async function mutate(path: string, expectedRevision: number): Promise<ChampionView> {
  const response = await fetch(`${apiUrl}${path}`, {
    body: JSON.stringify({ expectedRevision }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
      'X-CSRF-Token': csrfToken(),
    },
    method: 'POST',
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<ChampionView>;
}

export function proposeChampion(competitionId: string, expectedRevision: number): Promise<ChampionView> {
  return mutate(`/competitions/${competitionId}/champion/propose`, expectedRevision);
}

export function confirmChampion(competitionId: string, proposalId: string, expectedRevision: number): Promise<ChampionView> {
  return mutate(`/competitions/${competitionId}/champion/${proposalId}/confirm`, expectedRevision);
}
