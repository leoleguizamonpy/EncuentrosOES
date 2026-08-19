import { Module } from '@nestjs/common';

import { NextRoundController } from './next-round.controller.js';
import { NextRoundService } from './next-round.service.js';
import { NEXT_ROUND_STORE } from './next-round-store.js';
import { PrismaNextRoundStore } from './prisma-next-round-store.js';

@Module({
  controllers: [NextRoundController],
  providers: [NextRoundService, { provide: NEXT_ROUND_STORE, useClass: PrismaNextRoundStore }],
})
export class NextRoundModule {}
