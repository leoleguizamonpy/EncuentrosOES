export interface GeneralScoringRuleView {
  readonly label: string;
  readonly placement: number;
  readonly points: number;
}

export interface GeneralChampionshipCatalogView {
  readonly editions: readonly Readonly<{ id: string; name: string; year: number }>[];
  readonly events: readonly Readonly<{ id: string; name: string }>[];
}

export interface GeneralChampionshipOptionsView {
  readonly competitions: readonly Readonly<{ id: string; label: string }>[];
  readonly institutions: readonly Readonly<{ id: string; name: string }>[];
}

export interface GeneralChampionshipView {
  readonly champion: Readonly<{ institutionId: string; institutionName: string; points: number }> | null;
  readonly contributions: readonly Readonly<{
    automatic: boolean;
    confirmedAt: string | null;
    confirmedBy: Readonly<{ id: string; name: string }> | null;
    description: string;
    id: string;
    institution: Readonly<{ id: string; name: string }>;
    points: number;
    recordedAt: string;
    recordedBy: Readonly<{ id: string; name: string }> | null;
    revision: number;
    source: Readonly<{ competitionId: string; label: string; placement: number }> | null;
    sourceType: 'COMPETITION_PLACEMENT' | 'SPECIAL';
    status: 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
    title: string;
  }>[];
  readonly edition: Readonly<{ id: string; name: string; year: number }>;
  readonly event: Readonly<{ id: string; name: string }>;
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly rules: readonly GeneralScoringRuleView[];
  readonly standings: readonly Readonly<{
    contributionCount: number;
    institution: Readonly<{ id: string; name: string }>;
    placementContributionCount: number;
    position: number;
    specialContributionCount: number;
    tied: boolean;
    totalPoints: number;
  }>[];
  readonly status: 'ACTIVE' | 'DRAFT' | 'FINALIZED';
}

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function problem(response: Response): Promise<Error> {
  try {
    const body = await response.json() as ProblemDetails;
    if (typeof body.detail === 'string' && body.detail.length > 0) return new Error(body.detail);
  } catch {
    // Generic message below.
  }
  return new Error('No fue posible completar la operación del Campeonato General.');
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
  const response = await fetch(`${apiUrl}${path}`, { cache: 'no-store', credentials: 'include' });
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

export function generalChampionshipCatalog(): Promise<GeneralChampionshipCatalogView> { return get('/general-championships/catalog'); }
export function generalChampionshipByScope(editionId: string, eventId: string): Promise<GeneralChampionshipView | null> { return get(`/general-championships/by-scope?editionId=${encodeURIComponent(editionId)}&eventId=${encodeURIComponent(eventId)}`); }
export function generalChampionshipOptions(id: string): Promise<GeneralChampionshipOptionsView> { return get(`/general-championships/${id}/options`); }
export function createGeneralChampionship(input: Readonly<{ editionId: string; eventId: string; name: string }>): Promise<GeneralChampionshipView> { return mutate('/general-championships', 'POST', input); }
export function saveGeneralScoring(id: string, expectedRevision: number, rules: readonly GeneralScoringRuleView[]): Promise<GeneralChampionshipView> { return mutate(`/general-championships/${id}/scoring`, 'PATCH', { expectedRevision, rules }); }
export function activateGeneralChampionship(id: string, expectedRevision: number): Promise<GeneralChampionshipView> { return mutate(`/general-championships/${id}/activate`, 'POST', { expectedRevision }); }
export function syncGeneralChampionship(id: string, expectedRevision: number): Promise<GeneralChampionshipView> { return mutate(`/general-championships/${id}/sync`, 'POST', { expectedRevision }); }
export function addGeneralSpecialContribution(id: string, input: Readonly<{ description: string; expectedRevision: number; institutionId: string; points: number; title: string }>): Promise<GeneralChampionshipView> { return mutate(`/general-championships/${id}/special-contributions`, 'POST', input); }
export function addGeneralPlacementContribution(id: string, input: Readonly<{ competitionId: string; description: string; expectedRevision: number; institutionId: string; placement: number }>): Promise<GeneralChampionshipView> { return mutate(`/general-championships/${id}/placement-contributions`, 'POST', input); }
export function confirmGeneralContribution(contributionId: string, expectedRevision: number): Promise<GeneralChampionshipView> { return mutate(`/general-championships/contributions/${contributionId}/confirm`, 'POST', { expectedRevision }); }
export function annulGeneralContribution(contributionId: string, expectedRevision: number, reason: string): Promise<GeneralChampionshipView> { return mutate(`/general-championships/contributions/${contributionId}/annul`, 'POST', { expectedRevision, reason }); }
export function finalizeGeneralChampionship(id: string, expectedRevision: number): Promise<GeneralChampionshipView> { return mutate(`/general-championships/${id}/finalize`, 'POST', { expectedRevision }); }
