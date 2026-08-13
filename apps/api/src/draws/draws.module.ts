import { Module } from '@nestjs/common';

import { DRAW_STORE } from './draw-store.js';
import { DrawsController } from './draws.controller.js';
import { DrawsService } from './draws.service.js';
import { PrismaDrawStore } from './prisma-draw-store.js';

@Module({
  controllers: [DrawsController],
  providers: [DrawsService, { provide: DRAW_STORE, useClass: PrismaDrawStore }],
})
export class DrawsModule {}
