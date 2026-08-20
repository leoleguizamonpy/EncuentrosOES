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

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken(),
    },
    method: 'POST',
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<T>;
}

export function adminCatalog(): Promise<AdminCatalog> {
  return get('/admin/catalog');
}

export function createEdition(input: Readonly<{ name: string; status: 'CLOSED' | 'OPEN'; year: number }>): Promise<AdminEdition> {
  return post('/admin/catalog/editions', input);
}

export function createEvent(input: Readonly<{ code: string; name: string }>): Promise<AdminEvent> {
  return post('/admin/catalog/events', input);
}

export function createSport(input: Readonly<{ code: string; icon: CatalogIconInput | null; name: string }>): Promise<AdminVisualItem> {
  return post('/admin/catalog/sports', input);
}

export function createModality(input: Readonly<{ code: string; icon: CatalogIconInput | null; name: string }>): Promise<AdminVisualItem> {
  return post('/admin/catalog/modalities', input);
}

export function createInstitution(input: Readonly<{ code: string; eventId: string; icon: CatalogIconInput | null; name: string }>): Promise<AdminInstitution> {
  return post('/admin/catalog/institutions', input);
}

export function createCombination(input: Readonly<{ eventId: string; modalityId: string; sportId: string }>): Promise<AdminCombination> {
  return post('/admin/catalog/combinations', input);
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
  return {
    base64: dataUrl.slice(comma + 1),
    fileName: file.name,
    mimeType: file.type as CatalogIconInput['mimeType'],
  };
}
