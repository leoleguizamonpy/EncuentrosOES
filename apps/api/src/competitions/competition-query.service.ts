import { Inject, Injectable, Optional } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  COMPETITION_STORE,
  type CompetitionCatalog,
  type CompetitionStore,
  type CompetitionSummary,
} from './competition-store.js';
import { PrismaCompetitionStore } from './prisma-competition-store.js';

interface CatalogEntity {
  readonly code: string;
  readonly id: string;
  readonly name: string;
}

interface EditionView {
  readonly id: string;
  readonly name: string;
  readonly year: number;
}

function required<T>(map: ReadonlyMap<string, T>, id: string, entity: string): T {
  const value = map.get(id);
  if (value === undefined) {
    throw new Error(`Competition read model references a missing ${entity}: ${id}`);
  }
  return value;
}

@Injectable()
export class CompetitionQueryService {
  public constructor(
    @Inject(PRISMA_CLIENT) private readonly client: PrismaClient,
    @Optional() @Inject(COMPETITION_STORE) private readonly store?: CompetitionStore,
  ) {}

  public async catalog(): Promise<CompetitionCatalog> {
    if (this.store !== undefined && !(this.store instanceof PrismaCompetitionStore)) {
      return this.store.catalog();
    }

    const [editions, combinationRows, events, sports, modalities] = await Promise.all([
      this.client.edition.findMany({
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, year: true },
        where: { status: 'OPEN' },
      }),
      this.client.eventSportModality.findMany({
        select: { active: true, eventId: true, modalityId: true, sportId: true },
        where: { active: true },
      }),
      this.client.event.findMany({
        select: { code: true, id: true, name: true },
        where: { active: true },
      }),
      this.client.sport.findMany({
        select: { code: true, id: true, name: true },
        where: { active: true },
      }),
      this.client.modality.findMany({
        select: { code: true, id: true, name: true },
        where: { active: true },
      }),
    ]);

    const eventById = new Map(events.map((entity) => [entity.id, entity]));
    const sportById = new Map(sports.map((entity) => [entity.id, entity]));
    const modalityById = new Map(modalities.map((entity) => [entity.id, entity]));
    const combinations = combinationRows
      .filter(
        (row) =>
          eventById.has(row.eventId) &&
          sportById.has(row.sportId) &&
          modalityById.has(row.modalityId),
      )
      .map((row) => ({
        event: required(eventById, row.eventId, 'event'),
        modality: required(modalityById, row.modalityId, 'modality'),
        sport: required(sportById, row.sportId, 'sport'),
      }))
      .sort((a, b) =>
        a.event.name.localeCompare(b.event.name) ||
        a.sport.name.localeCompare(b.sport.name) ||
        a.modality.name.localeCompare(b.modality.name),
      );

    return { combinations, editions };
  }

  public async list(): Promise<readonly CompetitionSummary[]> {
    if (this.store !== undefined && !(this.store instanceof PrismaCompetitionStore)) {
      return this.store.list();
    }

    const records = await this.client.competition.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        createdAt: true,
        editionId: true,
        eventId: true,
        formatCode: true,
        groupCount: true,
        id: true,
        modalityId: true,
        revision: true,
        sportId: true,
        status: true,
      },
    });
    if (records.length === 0) return [];

    const editionIds = [...new Set(records.map(({ editionId }) => editionId))];
    const eventIds = [...new Set(records.map(({ eventId }) => eventId))];
    const sportIds = [...new Set(records.map(({ sportId }) => sportId))];
    const modalityIds = [...new Set(records.map(({ modalityId }) => modalityId))];
    const competitionIds = records.map(({ id }) => id);

    const [editions, events, sports, modalities, participantRows] = await Promise.all([
      this.client.edition.findMany({
        select: { id: true, name: true, year: true },
        where: { id: { in: editionIds } },
      }),
      this.client.event.findMany({
        select: { code: true, id: true, name: true },
        where: { id: { in: eventIds } },
      }),
      this.client.sport.findMany({
        select: { code: true, id: true, name: true },
        where: { id: { in: sportIds } },
      }),
      this.client.modality.findMany({
        select: { code: true, id: true, name: true },
        where: { id: { in: modalityIds } },
      }),
      this.client.competitionParticipant.findMany({
        select: { competitionId: true },
        where: { competitionId: { in: competitionIds } },
      }),
    ]);

    const editionById = new Map<string, EditionView>(editions.map((entity) => [entity.id, entity]));
    const eventById = new Map<string, CatalogEntity>(events.map((entity) => [entity.id, entity]));
    const sportById = new Map<string, CatalogEntity>(sports.map((entity) => [entity.id, entity]));
    const modalityById = new Map<string, CatalogEntity>(modalities.map((entity) => [entity.id, entity]));
    const participantCount = new Map<string, number>();
    for (const { competitionId } of participantRows) {
      participantCount.set(competitionId, (participantCount.get(competitionId) ?? 0) + 1);
    }

    return records.map((record) => ({
      createdAt: record.createdAt.toISOString(),
      edition: required(editionById, record.editionId, 'edition'),
      event: required(eventById, record.eventId, 'event'),
      formatCode: record.formatCode as CompetitionSummary['formatCode'],
      groupCount: record.groupCount,
      id: record.id,
      modality: required(modalityById, record.modalityId, 'modality'),
      participantCount: participantCount.get(record.id) ?? 0,
      revision: record.revision,
      sport: required(sportById, record.sportId, 'sport'),
      status: record.status as CompetitionSummary['status'],
    }));
  }
}
