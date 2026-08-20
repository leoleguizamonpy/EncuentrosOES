import { Module } from '@nestjs/common';

import { DRAW_STORE } from './draw-store.js';
import { DrawsController } from './draws.controller.js';
import { DrawsService } from './draws.service.js';
import { PrismaDrawStore } from './prisma-draw-store.js';
import { PublicDrawHistoryController } from './public-draw-history.controller.js';
import { PublicDrawHistoryService } from './public-draw-history.service.js';

@Module({
  controllers: [DrawsController, PublicDrawHistoryController],
  providers: [DrawsService, PublicDrawHistoryService, { provide: DRAW_STORE, useClass: PrismaDrawStore }],
})
export class DrawsModule {}
