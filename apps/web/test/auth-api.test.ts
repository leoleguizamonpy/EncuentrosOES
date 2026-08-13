import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentActor, logout } from '../lib/auth-api';

describe('auth API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'oes_csrf=; Max-Age=0; Path=/';
  });

  it('represents an expired server session as unauthenticated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(currentActor()).resolves.toBeNull();
  });

  it('recovers the CSRF token from its cookie after a page reload', async () => {
    document.cookie = 'oes_csrf=csrf-restaurado; Path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await logout();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/auth/logout',
      expect.objectContaining({ headers: { 'X-CSRF-Token': 'csrf-restaurado' }, method: 'POST' }),
    );
  });

  it('refuses an unsafe logout when the CSRF cookie is absent', async () => {
    await expect(logout()).rejects.toThrow('protección CSRF válida');
  });
});
