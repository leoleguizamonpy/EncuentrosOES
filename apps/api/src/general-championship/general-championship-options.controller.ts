import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import { GeneralChampionshipOptionsService } from './general-championship-options.service.js';

const uuid = z.uuid();

@Controller('general-championships')
@RequireRoles('ADMIN', 'SUPERADMIN', 'OPERATOR')
export class GeneralChampionshipOptionsController {
  public constructor(private readonly service: GeneralChampionshipOptionsService) {}

  @Get(':championshipId/options')
  public find(@Param('championshipId') championshipId: string): ReturnType<GeneralChampionshipOptionsService['find']> {
    const parsed = uuid.safeParse(championshipId);
    if (!parsed.success) throw new BadRequestException('General championship identifier is invalid.');
    return this.service.find(parsed.data);
  }
}
