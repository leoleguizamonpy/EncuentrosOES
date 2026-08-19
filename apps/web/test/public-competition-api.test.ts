import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicCompetitionJourney } from '../lib/public-competition-api';

describe('public competition API client', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('loads the finalized competition without credentials or caching', async () => {
    const payload = {
      champion: { confirmedAt: '2026-08-19T17:06:00.000Z', participantDisplayName: 'Colegio A', participantId: 'participant-a' },
      competition: { edition: 'OES 2026', event: 'Colegiales', finalizedAt: '2026-08-19T17:06:00.000Z', id: 'competition-1', modality: 'Masculina', sport: 'Futsal', status: 'FINALIZED' },
      rounds: [],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicCompetitionJourney('competition-1')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/public/competitions/competition-1/journey',
      { cache: 'no-store' },
    );
  });

  it('preserves null while the competition is not publicly finalized', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('null', { status: 200 })));
    await expect(publicCompetitionJourney('competition-1')).resolves.toBeNull();
  });
});
