import { beforeEach, describe, expect, it, vi } from 'vitest';

import { champion, confirmChampion, proposeChampion } from '../lib/champion-api';

describe('champion API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'oes_csrf=csrf-campeon; Path=/';
  });

  it('restores champion state without caching', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('null', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await champion('competition-1');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/v1/competitions/competition-1/champion', {
      cache: 'no-store', credentials: 'include',
    });
  });

  it('treats an empty successful response as no champion yet', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(champion('competition-1')).resolves.toBeNull();
  });

  it('proposes and confirms with CSRF, revisions and unique idempotency keys', async () => {
    const proposalResponse = {
      competitionId: 'competition-1',
      competitionRevision: 8,
      participantId: 'participant-1',
      proposalId: 'proposal-1',
      status: 'PENDING_CONFIRMATION',
    };
    const confirmationResponse = {
      ...proposalResponse,
      competitionRevision: 9,
      status: 'CONFIRMED',
    };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(proposalResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(confirmationResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000041')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000042');

    await proposeChampion('competition-1', 7);
    await confirmChampion('competition-1', 'proposal-1', 8);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/champion/propose');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({ expectedRevision: 7 }),
      headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000041', 'X-CSRF-Token': 'csrf-campeon' },
      method: 'POST',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/champion/proposal-1/confirm');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify({ expectedRevision: 8 }),
      headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000042', 'X-CSRF-Token': 'csrf-campeon' },
      method: 'POST',
    });
  });
});
