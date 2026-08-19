import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareNextRound } from '../lib/continuity-api';

describe('continuity API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'oes_csrf=csrf-continuidad; Path=/';
  });

  it('prepares the next round with CSRF, revision and idempotency', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      competitionId: 'competition-1',
      competitionRevision: 9,
      configuration: { canonicalHash: 'hash', id: 'configuration-2', participantCount: 4, roundNumber: 1, status: 'FROZEN' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000031');

    await prepareNextRound('competition-1', 8);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/v1/competitions/competition-1/next-round/prepare', {
      body: JSON.stringify({ expectedRevision: 8 }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '00000000-0000-4000-8000-000000000031',
        'X-CSRF-Token': 'csrf-continuidad',
      },
      method: 'POST',
    });
  });
});
