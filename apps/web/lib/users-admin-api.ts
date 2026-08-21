export type ManagedUserRole = 'ADMIN' | 'OPERATOR' | 'SUPERADMIN';
export type ManagedUserStatus = 'ACTIVE' | 'DISABLED';

export interface ManagedUser {
  readonly createdAt: string;
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly lastLoginAt: string | null;
  readonly role: ManagedUserRole;
  readonly status: ManagedUserStatus;
  readonly updatedAt: string;
}

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function problem(response: Response): Promise<Error> {
  try {
    const body = await response.json() as ProblemDetails;
    if (typeof body.detail === 'string' && body.detail.length > 0) return new Error(body.detail);
  } catch {
    // Fall through to a safe generic error.
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

export async function managedUsers(): Promise<readonly ManagedUser[]> {
  const response = await fetch(`${apiUrl}/admin/users`, { cache: 'no-store', credentials: 'include' });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<readonly ManagedUser[]>;
}

export function createManagedUser(input: Readonly<{ displayName: string; email: string; password: string; role: ManagedUserRole }>): Promise<ManagedUser> {
  return mutate('/admin/users', 'POST', input);
}

export function updateManagedUser(id: string, input: Readonly<{ displayName: string; password?: string; role: ManagedUserRole; status: ManagedUserStatus }>): Promise<ManagedUser> {
  return mutate(`/admin/users/${id}`, 'PATCH', input);
}
