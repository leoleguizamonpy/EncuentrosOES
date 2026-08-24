import { Module } from '@nestjs/common';

import { CompetitionQueryService } from './competition-query.service.js';
import { COMPETITION_STORE } from './competition-store.js';
import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';
import { PrismaCompetitionStore } from './prisma-competition-store.js';

@Module({
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    CompetitionQueryService,
    { provide: COMPETITION_STORE, useClass: PrismaCompetitionStore },
  ],
})
export class CompetitionsModule {}
