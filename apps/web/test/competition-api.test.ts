import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCompetition } from '../lib/competition-api';

describe('competition API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'oes_csrf=csrf-competencias; Path=/';
  });

  it('sends CSRF and a unique idempotency key when creating', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'competition-1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    await createCompetition({ editionId: 'edition', eventId: 'event', modalityId: 'modality', sportId: 'sport' });
    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error('Expected competition request');
    expect(call[0]).toBe('http://localhost:3001/api/v1/competitions');
    expect(call[1]).toMatchObject({
      headers: {
        'Idempotency-Key': '00000000-0000-4000-8000-000000000001',
        'X-CSRF-Token': 'csrf-competencias',
      },
      method: 'POST',
    });
  });
});
