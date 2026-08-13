import { Module } from '@nestjs/common';

import { PrismaResultsStore } from './prisma-results-store.js';
import { ResultsController } from './results.controller.js';
import { RESULTS_STORE } from './results-store.js';
import { ResultsService } from './results.service.js';

@Module({
  controllers: [ResultsController],
  providers: [ResultsService, { provide: RESULTS_STORE, useClass: PrismaResultsStore }],
})
export class ResultsModule {}
