export interface AuditTimelineEntry {
  readonly actionCode: string;
  readonly actor: Readonly<{ displayName: string | null; id: string | null; role: string }>;
  readonly competitionId: string | null;
  readonly correlationId: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly reason: string | null;
  readonly resourceId: string;
  readonly resourceType: string;
  readonly revisionAfter: number | null;
  readonly revisionBefore: number | null;
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

export async function auditTimeline(): Promise<readonly AuditTimelineEntry[]> {
  const response = await fetch(`${apiUrl}/admin/audit`, { cache: 'no-store', credentials: 'include' });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<readonly AuditTimelineEntry[]>;
}
