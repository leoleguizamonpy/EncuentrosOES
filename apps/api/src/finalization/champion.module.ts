import { Module } from '@nestjs/common';

import { ChampionController } from './champion.controller.js';
import { ChampionService } from './champion.service.js';
import { CHAMPION_STORE } from './champion-store.js';
import { PrismaChampionStore } from './prisma-champion-store.js';

@Module({
  controllers: [ChampionController],
  providers: [ChampionService, { provide: CHAMPION_STORE, useClass: PrismaChampionStore }],
})
export class ChampionModule {}
