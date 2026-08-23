import { Module } from '@nestjs/common';

import { CompetitionHistoryController } from './competition-history.controller.js';
import { CompetitionHistoryService } from './competition-history.service.js';
import { PrismaResultsStore } from './prisma-results-store.js';
import { ResultsController } from './results.controller.js';
import { RESULTS_STORE } from './results-store.js';
import { ResultsService } from './results.service.js';

@Module({
  controllers: [CompetitionHistoryController, ResultsController],
  providers: [CompetitionHistoryService, ResultsService, { provide: RESULTS_STORE, useClass: PrismaResultsStore }],
})
export class ResultsModule {}
