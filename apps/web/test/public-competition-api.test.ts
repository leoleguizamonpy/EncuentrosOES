import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicCompetitionJourney, publicDrawHistory } from '../lib/public-competition-api';

describe('public competition API client', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('loads an ongoing published competition without credentials or caching', async () => {
    const payload = {
      champion: null,
      competition: { edition: 'OES 2026', event: 'Colegiales', finalizedAt: null, id: 'competition-1', modality: 'Masculina', sport: 'Futsal', status: 'LOCKED' },
      rounds: [{
        confirmedAt: '2026-08-19T17:00:00.000Z',
        executionId: 'execution-1',
        formatCode: 'GROUP_STAGE',
        groups: [{
          label: 'A',
          members: [{ displayName: 'Colegio A', id: 'participant-a' }, { displayName: 'Colegio B', id: 'participant-b' }],
          ordinal: 1,
          standings: [{
            draws: 0, losses: 0, participant: { displayName: 'Colegio A', id: 'participant-a' }, played: 1, position: 1,
            scoreAgainst: 1, scoreDifference: 2, scoreFor: 3, setDifference: 0, setsLost: 0, setsWon: 0,
            sportPointDifference: 0, sportPointsAgainst: 0, sportPointsFor: 0, tablePoints: 3, tied: false, wins: 1,
          }],
        }],
        matches: [{
          groupLabel: 'A', id: 'match-1', ordinal: 1,
          participantA: { displayName: 'Colegio A', id: 'participant-a' },
          participantB: { displayName: 'Colegio B', id: 'participant-b' },
          result: { detail: { scoreA: 3, scoreB: 1 }, resolved: { winnerParticipantId: 'participant-a' } },
          winnerParticipantId: 'participant-a',
        }],
        publication: { id: 'publication-1', publishedAt: '2026-08-19T17:01:00.000Z', verificationCode: 'a'.repeat(64) },
        roundNumber: 0,
      }],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicCompetitionJourney('competition-1')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/public/competitions/competition-1/journey',
      { cache: 'no-store' },
    );
  });

  it('loads champion information when the public competition is finalized', async () => {
    const payload = {
      champion: { confirmedAt: '2026-08-19T17:06:00.000Z', participantDisplayName: 'Colegio A', participantId: 'participant-a' },
      competition: { edition: 'OES 2026', event: 'Colegiales', finalizedAt: '2026-08-19T17:06:00.000Z', id: 'competition-1', modality: 'Masculina', sport: 'Futsal', status: 'FINALIZED' },
      rounds: [],
    };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    await expect(publicCompetitionJourney('competition-1')).resolves.toEqual(payload);
  });

  it('preserves null while the competition has no official publication', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('null', { status: 200 })));
    await expect(publicCompetitionJourney('competition-1')).resolves.toBeNull();
  });

  it('loads the publication history without credentials or caching', async () => {
    const payload = [{
      formatCode: 'GROUP_STAGE', integrityValid: true, officialDrawId: 'draw-1', publicationId: 'publication-1',
      publishedAt: '2026-08-19T17:01:00.000Z', revocationReason: null, revokedAt: null, roundNumber: 0,
      status: 'PUBLISHED', verificationCode: 'a'.repeat(64),
    }];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicDrawHistory('competition-1')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/public/competitions/competition-1/draw-publications',
      { cache: 'no-store' },
    );
  });
});
