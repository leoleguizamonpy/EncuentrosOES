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
  readonly editions: readonly { readonly id: string; readonly name: string; readonly year: number }[];
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
  readonly institutions: readonly { readonly code: string; readonly id: string; readonly name: string; readonly selected: boolean }[];
  readonly participants: readonly { readonly displayName: string; readonly enabledAt: string; readonly id: string; readonly institutionId: string; readonly status: 'ENABLED' | 'WITHDRAWN' }[];
  readonly validGroupCounts: readonly number[];
}

export interface CreateCompetitionInput {
  readonly editionId: string;
  readonly eventId: string;
  readonly modalityId: string;
  readonly sportId: string;
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
  return new Error('No fue posible completar la operación.');
}

function csrfToken(): string {
  const prefix = 'oes_csrf=';
  for (const part of document.cookie.split(';')) {
    const candidate = part.trim();
    if (candidate.startsWith(prefix)) return decodeURIComponent(candidate.slice(prefix.length));
  }
  throw new Error('La sesión no contiene protección CSRF válida.');
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<T>;
}

async function mutate<T>(path: string, method: 'PATCH' | 'POST', body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
      'X-CSRF-Token': csrfToken(),
    },
    method,
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<T>;
}

export function competitionCatalog(): Promise<CompetitionCatalog> {
  return get('/competitions/catalog');
}

export function competitions(): Promise<readonly CompetitionSummary[]> {
  return get('/competitions');
}

export function competitionDetail(id: string): Promise<CompetitionDetail> {
  return get(`/competitions/${id}`);
}

export function addCompetitionParticipant(id: string, institutionId: string, expectedRevision: number): Promise<CompetitionDetail> {
  return mutate(`/competitions/${id}/participants`, 'POST', { expectedRevision, institutionId });
}

export function configureCompetitionFormat(
  id: string,
  input: Readonly<{ expectedRevision: number; formatCode: 'GROUP_STAGE'; groupCount: number }> | Readonly<{ expectedRevision: number; formatCode: 'KNOCKOUT'; groupCount: null }>,
): Promise<CompetitionDetail> {
  return mutate(`/competitions/${id}/format`, 'PATCH', input);
}

export async function createCompetition(input: CreateCompetitionInput): Promise<CompetitionSummary> {
  return mutate('/competitions', 'POST', input);
}
