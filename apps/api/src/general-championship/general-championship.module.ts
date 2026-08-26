import { Module } from '@nestjs/common';

import { GeneralChampionshipOptionsController } from './general-championship-options.controller.js';
import { GeneralChampionshipOptionsService } from './general-championship-options.service.js';
import { GeneralChampionshipController } from './general-championship.controller.js';
import { GeneralChampionshipService } from './general-championship.service.js';

@Module({
  controllers: [GeneralChampionshipController, GeneralChampionshipOptionsController],
  providers: [GeneralChampionshipService, GeneralChampionshipOptionsService],
})
export class GeneralChampionshipModule {}
