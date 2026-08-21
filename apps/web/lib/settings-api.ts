const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface SafeRuntimeSettings {
  readonly apiPort: number;
  readonly editable: false;
  readonly runtimeMode: 'NON_PRODUCTION' | 'PRODUCTION';
  readonly sessionAbsoluteMinutes: number;
  readonly sessionIdleMinutes: number;
  readonly source: 'ENVIRONMENT';
  readonly webOrigin: string;
}

export async function runtimeSettings(): Promise<SafeRuntimeSettings> {
  const response = await fetch(`${API_BASE}/admin/settings`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('No fue posible cargar la configuración operativa.');
  return response.json() as Promise<SafeRuntimeSettings>;
}
