import { Module } from '@nestjs/common';

import { GeneralChampionshipController } from './general-championship.controller.js';
import { GeneralChampionshipService } from './general-championship.service.js';

@Module({
  controllers: [GeneralChampionshipController],
  providers: [GeneralChampionshipService],
})
export class GeneralChampionshipModule {}
