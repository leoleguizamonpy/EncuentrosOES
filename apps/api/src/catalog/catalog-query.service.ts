import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import { CatalogAssetService } from './catalog-asset.service.js';
import type { CatalogSnapshot } from './catalog-contracts.js';

@Injectable()
export class CatalogQueryService {
  public constructor(
    @Inject(PRISMA_CLIENT) private readonly client: PrismaClient,
    private readonly assets: CatalogAssetService,
  ) {}

  public async catalog(): Promise<CatalogSnapshot> {
    const [editions, events, sports, modalities, institutions, combinations, assetMap] = await Promise.all([
      this.client.edition.findMany({ orderBy: [{ year: 'desc' }, { name: 'asc' }] }),
      this.client.event.findMany({ orderBy: { name: 'asc' } }),
      this.client.sport.findMany({ orderBy: { name: 'asc' } }),
      this.client.modality.findMany({ orderBy: { name: 'asc' } }),
      this.client.institution.findMany({ orderBy: [{ event: { name: 'asc' } }, { name: 'asc' }] }),
      this.client.eventSportModality.findMany({
        include: { event: true, modality: true, sport: true },
        orderBy: [{ event: { name: 'asc' } }, { sport: { name: 'asc' } }, { modality: { name: 'asc' } }],
      }),
      this.assets.indexByResource(),
    ]);
    return {
      combinations,
      editions,
      events,
      institutions: institutions.map((item) => ({ ...item, iconAssetId: assetMap.get(`INSTITUTION:${item.id}`) ?? null })),
      modalities: modalities.map((item) => ({ ...item, iconAssetId: assetMap.get(`MODALITY:${item.id}`) ?? null })),
      sports: sports.map((item) => ({ ...item, iconAssetId: assetMap.get(`SPORT:${item.id}`) ?? null })),
    };
  }
}
