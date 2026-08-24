import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CompetitionQueryService } from '../src/competitions/competition-query.service.js';

function asPrismaClient(value: object): PrismaClient {
  return value as unknown as PrismaClient;
}

describe('CompetitionQueryService', () => {
  it('builds the competition catalog without relational include fanout', async () => {
    const combinationFindMany = vi.fn().mockResolvedValue([
      { active: true, eventId: 'event-1', modalityId: 'modality-1', sportId: 'sport-1' },
    ]);
    const client = asPrismaClient({
      edition: {
        findMany: vi.fn().mockResolvedValue([{ id: 'edition-1', name: 'OES 2026', year: 2026 }]),
      },
      eventSportModality: { findMany: combinationFindMany },
      event: {
        findMany: vi.fn().mockResolvedValue([{ code: 'COL', id: 'event-1', name: 'Colegiales' }]),
      },
      sport: {
        findMany: vi.fn().mockResolvedValue([{ code: 'FUTSAL', id: 'sport-1', name: 'Futsal' }]),
      },
      modality: {
        findMany: vi.fn().mockResolvedValue([{ code: 'M', id: 'modality-1', name: 'Masculina' }]),
      },
    });

    const catalog = await new CompetitionQueryService(client).catalog();

    expect(catalog.combinations).toEqual([
      {
        event: { code: 'COL', id: 'event-1', name: 'Colegiales' },
        modality: { code: 'M', id: 'modality-1', name: 'Masculina' },
        sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' },
      },
    ]);
    expect(combinationFindMany).toHaveBeenCalledWith({
      select: { active: true, eventId: true, modalityId: true, sportId: true },
      where: { active: true },
    });
  });

  it('builds competition summaries from flat queries and preserves participant counts', async () => {
    const competitionFindMany = vi.fn().mockResolvedValue([
      {
        createdAt: new Date('2026-08-23T12:00:00.000Z'),
        editionId: 'edition-1',
        eventId: 'event-1',
        formatCode: 'GROUP_STAGE',
        groupCount: 2,
        id: 'competition-1',
        modalityId: 'modality-1',
        revision: 4,
        sportId: 'sport-1',
        status: 'OPEN',
      },
    ]);
    const client = asPrismaClient({
      competition: { findMany: competitionFindMany },
      edition: {
        findMany: vi.fn().mockResolvedValue([{ id: 'edition-1', name: 'OES 2026', year: 2026 }]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([{ code: 'COL', id: 'event-1', name: 'Colegiales' }]),
      },
      sport: {
        findMany: vi.fn().mockResolvedValue([{ code: 'FUTSAL', id: 'sport-1', name: 'Futsal' }]),
      },
      modality: {
        findMany: vi.fn().mockResolvedValue([{ code: 'M', id: 'modality-1', name: 'Masculina' }]),
      },
      competitionParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { competitionId: 'competition-1' },
          { competitionId: 'competition-1' },
        ]),
      },
    });

    const summaries = await new CompetitionQueryService(client).list();

    expect(summaries[0]).toMatchObject({
      id: 'competition-1',
      participantCount: 2,
      revision: 4,
      status: 'OPEN',
    });
    expect(competitionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        editionId: true,
        eventId: true,
        modalityId: true,
        sportId: true,
      }),
    }));
    expect(competitionFindMany.mock.calls[0]?.[0]).not.toHaveProperty('include');
  });
});
