import { Module } from '@nestjs/common';

import { COMPETITION_STORE } from './competition-store.js';
import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';
import { PrismaCompetitionStore } from './prisma-competition-store.js';

@Module({
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    { provide: COMPETITION_STORE, useClass: PrismaCompetitionStore },
  ],
})
export class CompetitionsModule {}
