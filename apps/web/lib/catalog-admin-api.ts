export interface CatalogIconInput {
  readonly base64: string;
  readonly fileName: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface AdminEdition {
  readonly id: string;
  readonly name: string;
  readonly status: 'CLOSED' | 'OPEN';
  readonly year: number;
}

export interface AdminEvent {
  readonly active: boolean;
  readonly code: string;
  readonly id: string;
  readonly name: string;
}

export interface AdminVisualItem extends AdminEvent {
  readonly iconAssetId: string | null;
}

export interface AdminInstitution extends AdminVisualItem {
  readonly eventId: string;
  readonly revision: number;
}

export interface AdminCombination {
  readonly active: boolean;
  readonly event: AdminEvent;
  readonly eventId: string;
  readonly modality: AdminEvent;
  readonly modalityId: string;
  readonly sport: AdminEvent;
  readonly sportId: string;
}

export interface AdminCatalog {
  readonly combinations: readonly AdminCombination[];
  readonly editions: readonly AdminEdition[];
  readonly events: readonly AdminEvent[];
  readonly institutions: readonly AdminInstitution[];
  readonly modalities: readonly AdminVisualItem[];
  readonly sports: readonly AdminVisualItem[];
}

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

function redirectExpiredSession(): void {
  if (typeof window === 'undefined') return;
  const target = '/login';
  if (window.location.pathname !== target) window.location.replace(target);
}

async function problem(response: Response): Promise<Error> {
  if (response.status === 401) {
    redirectExpiredSession();
    return new Error('La sesión expiró. Volvé a iniciar sesión.');
  }
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
  redirectExpiredSession();
  throw new Error('La sesión expiró. Volvé a iniciar sesión.');
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
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
    method,
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<T>;
}

export function adminCatalog(): Promise<AdminCatalog> {
  return get('/admin/catalog');
}

export function createEdition(input: Readonly<{ name: string; status: 'CLOSED' | 'OPEN'; year: number }>): Promise<AdminEdition> {
  return mutate('/admin/catalog/editions', 'POST', input);
}

export function updateEdition(id: string, input: Readonly<{ name: string; status: 'CLOSED' | 'OPEN'; year: number }>): Promise<AdminEdition> {
  return mutate(`/admin/catalog/editions/${id}`, 'PATCH', input);
}

export function createEvent(input: Readonly<{ code: string; name: string }>): Promise<AdminEvent> {
  return mutate('/admin/catalog/events', 'POST', input);
}

export function updateEvent(id: string, input: Readonly<{ active: boolean; code: string; name: string }>): Promise<AdminEvent> {
  return mutate(`/admin/catalog/events/${id}`, 'PATCH', input);
}

export function createSport(input: Readonly<{ code: string; icon: CatalogIconInput | null; name: string }>): Promise<AdminVisualItem> {
  return mutate('/admin/catalog/sports', 'POST', input);
}

export function updateSport(id: string, input: Readonly<{ active: boolean; code: string; icon?: CatalogIconInput | null; name: string }>): Promise<AdminVisualItem> {
  return mutate(`/admin/catalog/sports/${id}`, 'PATCH', input);
}

export function createModality(input: Readonly<{ code: string; icon: CatalogIconInput | null; name: string }>): Promise<AdminVisualItem> {
  return mutate('/admin/catalog/modalities', 'POST', input);
}

export function updateModality(id: string, input: Readonly<{ active: boolean; code: string; icon?: CatalogIconInput | null; name: string }>): Promise<AdminVisualItem> {
  return mutate(`/admin/catalog/modalities/${id}`, 'PATCH', input);
}

export function createInstitution(input: Readonly<{ code: string; eventId: string; icon: CatalogIconInput | null; name: string }>): Promise<AdminInstitution> {
  return mutate('/admin/catalog/institutions', 'POST', input);
}

export function updateInstitution(id: string, input: Readonly<{ active: boolean; code: string; eventId: string; icon?: CatalogIconInput | null; name: string }>): Promise<AdminInstitution> {
  return mutate(`/admin/catalog/institutions/${id}`, 'PATCH', input);
}

export function createCombination(input: Readonly<{ eventId: string; modalityId: string; sportId: string }>): Promise<AdminCombination> {
  return mutate('/admin/catalog/combinations', 'POST', input);
}

export function updateCombination(input: Readonly<{ active: boolean; eventId: string; modalityId: string; sportId: string }>): Promise<AdminCombination> {
  return mutate('/admin/catalog/combinations', 'PATCH', input);
}

export function catalogAssetUrl(assetId: string): string {
  return `${apiUrl}/public/assets/${assetId}`;
}

export async function iconFromFile(file: File | null): Promise<CatalogIconInput | null> {
  if (file === null) return null;
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) throw new Error('El icono debe ser PNG, JPG/JPEG o WEBP.');
  if (file.size <= 0 || file.size > 1_572_864) throw new Error('El icono debe pesar como máximo 1,5 MB.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No fue posible leer el archivo seleccionado.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No fue posible leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('El archivo seleccionado no es válido.');
  return { base64: dataUrl.slice(comma + 1), fileName: file.name, mimeType: file.type as CatalogIconInput['mimeType'] };
}
