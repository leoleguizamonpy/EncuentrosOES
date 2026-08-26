import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import { GeneralChampionshipError } from './general-championship.service.js';

export interface GeneralChampionshipOptions {
  readonly competitions: readonly Readonly<{ id: string; label: string }>[];
  readonly institutions: readonly Readonly<{ id: string; name: string }>[];
}

@Injectable()
export class GeneralChampionshipOptionsService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  public async find(championshipId: string): Promise<GeneralChampionshipOptions> {
    const championship = await this.prisma.generalChampionship.findUnique({ select: { editionId: true, eventId: true }, where: { id: championshipId } });
    if (championship === null) throw new GeneralChampionshipError('INVALID', 'General championship does not exist.');
    const institutions = await this.prisma.institution.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true }, where: { active: true, eventId: championship.eventId } });
    const competitions = await this.prisma.competition.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, modalityId: true, sportId: true },
      where: { editionId: championship.editionId, eventId: championship.eventId, status: 'FINALIZED' },
    });
    const sportIds = [...new Set(competitions.map((competition) => competition.sportId))];
    const modalityIds = [...new Set(competitions.map((competition) => competition.modalityId))];
    const sports = sportIds.length === 0 ? [] : await this.prisma.sport.findMany({ select: { id: true, name: true }, where: { id: { in: sportIds } } });
    const modalities = modalityIds.length === 0 ? [] : await this.prisma.modality.findMany({ select: { id: true, name: true }, where: { id: { in: modalityIds } } });
    const sportById = new Map(sports.map((entry) => [entry.id, entry.name]));
    const modalityById = new Map(modalities.map((entry) => [entry.id, entry.name]));
    return {
      competitions: competitions.map((competition) => ({ id: competition.id, label: `${sportById.get(competition.sportId) ?? 'Deporte'} · ${modalityById.get(competition.modalityId) ?? 'Modalidad'}` })),
      institutions,
    };
  }
}
