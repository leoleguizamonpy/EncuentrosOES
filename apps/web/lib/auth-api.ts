export type AccountRole = 'ADMIN' | 'OPERATOR' | 'SUPERADMIN';

export interface Actor {
  readonly displayName: string;
  readonly id: string;
  readonly role: AccountRole;
}

interface LoginResponse {
  readonly actor: Actor;
  readonly csrfToken: string;
  readonly expiresAt: string;
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

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    body: JSON.stringify({ email, password }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<LoginResponse>;
}

export async function currentActor(): Promise<Actor | null> {
  const response = await fetch(`${apiUrl}/auth/me`, { cache: 'no-store', credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<Actor>;
}

function cookieValue(name: string): string | null {
  const encodedName = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(';')) {
    const candidate = part.trim();
    if (candidate.startsWith(encodedName)) return decodeURIComponent(candidate.slice(encodedName.length));
  }
  return null;
}

export async function logout(): Promise<void> {
  const csrfToken = cookieValue('oes_csrf');
  if (csrfToken === null) throw new Error('La sesión no contiene protección CSRF válida.');
  const response = await fetch(`${apiUrl}/auth/logout`, {
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
    method: 'POST',
  });
  if (!response.ok) throw await problem(response);
}
