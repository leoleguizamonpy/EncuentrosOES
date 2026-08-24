import { Module } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import { CompetitionQueryService } from './competition-query.service.js';
import { COMPETITION_STORE, type CompetitionStore } from './competition-store.js';
import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';
import { PrismaCompetitionStore } from './prisma-competition-store.js';

@Module({
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    { provide: COMPETITION_STORE, useClass: PrismaCompetitionStore },
    {
      inject: [PRISMA_CLIENT, COMPETITION_STORE],
      provide: CompetitionQueryService,
      useFactory: (client: PrismaClient, store: CompetitionStore) =>
        store instanceof PrismaCompetitionStore
          ? new CompetitionQueryService(client)
          : {
              catalog: () => store.catalog(),
              list: () => store.list(),
            },
    },
  ],
})
export class CompetitionsModule {}
