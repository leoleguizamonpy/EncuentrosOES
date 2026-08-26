import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generalChampionshipByScope } from '../lib/general-championship-api';

describe('general championship API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('treats an empty successful scope response as no championship yet', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generalChampionshipByScope('edition-1', 'event-1')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/general-championships/by-scope?editionId=edition-1&eventId=event-1',
      { cache: 'no-store', credentials: 'include' },
    );
  });
});
