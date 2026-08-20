import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { z } from 'zod';

import { Public } from '../security/metadata.js';
import { PublicDrawHistoryService } from './public-draw-history.service.js';

const uuidSchema = z.uuid();

@Controller()
export class PublicDrawHistoryController {
  public constructor(private readonly service: PublicDrawHistoryService) {}

  @Get('public/competitions/:competitionId/draw-publications')
  @Public()
  public history(@Param('competitionId') competitionId: string): ReturnType<PublicDrawHistoryService['history']> {
    const parsed = uuidSchema.safeParse(competitionId);
    if (!parsed.success) throw new BadRequestException('Competition identifier is invalid.');
    return this.service.history(parsed.data);
  }
}
