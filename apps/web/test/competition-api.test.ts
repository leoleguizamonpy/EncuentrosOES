import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addCompetitionParticipant,
  configureCompetitionFormat,
  confirmOfficialDraw,
  createCompetition,
  executeOfficialDraw,
  freezeCompetitionRuleSet,
  prepareOfficialDraw,
  saveCompetitionRuleSet,
} from '../lib/competition-api';

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

  it('sends the persisted revision when mutating competition setup', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'competition-1', revision: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'competition-1', revision: 3 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003');

    await addCompetitionParticipant('competition-1', 'institution-1', 4);
    await configureCompetitionFormat('competition-1', { expectedRevision: 5, formatCode: 'GROUP_STAGE', groupCount: 2 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/participants');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ expectedRevision: 4, institutionId: 'institution-1' }), method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/format');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify({ expectedRevision: 5, formatCode: 'GROUP_STAGE', groupCount: 2 }), method: 'PATCH' });
  });

  it('saves and freezes the scoring template through revisioned endpoints', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'competition-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'competition-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005');

    await saveCompetitionRuleSet('competition-1', {
      allowDraws: true,
      drawPoints: 1,
      expectedRevision: null,
      lossPoints: 0,
      resultProfile: 'SCORE_BASED',
      tieBreakCriteria: ['TABLE_POINTS', 'WINS'],
      winPoints: 3,
    });
    await freezeCompetitionRuleSet('competition-1', 1);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/rules');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/rules/freeze');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify({ expectedRevision: 1 }), method: 'POST' });
  });

  it('uses revisioned endpoints for the complete official draw workflow', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ competitionId: 'competition-1' }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000006')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000007')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000008');

    await prepareOfficialDraw('competition-1', 7);
    await executeOfficialDraw('configuration-1', 2);
    await confirmOfficialDraw('execution-1', 1);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3001/api/v1/competitions/competition-1/draw-workspace/prepare');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ expectedRevision: 7 }), method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/api/v1/draw-configurations/configuration-1/execute');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify({ expectedRevision: 2 }), method: 'POST' });
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3001/api/v1/official-draws/execution-1/confirm');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ body: JSON.stringify({ expectedRevision: 1 }), method: 'POST' });
  });
});
