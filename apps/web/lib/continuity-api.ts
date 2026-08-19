export interface PreparedNextRoundView {
  readonly competitionId: string;
  readonly competitionRevision: number;
  readonly configuration: Readonly<{
    canonicalHash: string;
    id: string;
    participantCount: number;
    roundNumber: number;
    status: 'FROZEN';
  }>;
}

interface ProblemDetails {
  readonly detail?: string;
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function problem(response: Response): Promise<Error> {
  try {
    const body = await response.json() as ProblemDetails;
    if (typeof body.detail === 'string' && body.detail.length > 0) return new Error(body.detail);
  } catch {
    // A safe generic message is returned below.
  }
  return new Error('No fue posible preparar la siguiente ronda.');
}

function csrfToken(): string {
  const prefix = 'oes_csrf=';
  for (const part of document.cookie.split(';')) {
    const candidate = part.trim();
    if (candidate.startsWith(prefix)) return decodeURIComponent(candidate.slice(prefix.length));
  }
  throw new Error('La sesión no contiene protección CSRF válida.');
}

export async function prepareNextRound(
  competitionId: string,
  expectedRevision: number,
): Promise<PreparedNextRoundView> {
  const response = await fetch(`${apiUrl}/competitions/${competitionId}/next-round/prepare`, {
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
  return response.json() as Promise<PreparedNextRoundView>;
}
