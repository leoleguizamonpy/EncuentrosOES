import { BadRequestException, Controller, Get, Inject, Param } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import { CompetitionHistoryService } from './competition-history.service.js';

@Controller()
@RequireRoles('ADMIN', 'OPERATOR', 'SUPERADMIN')
export class CompetitionHistoryController {
  public constructor(@Inject(CompetitionHistoryService) private readonly service: CompetitionHistoryService) {}

  @Get('competitions/:competitionId/history')
  public history(@Param('competitionId') competitionId: string): ReturnType<CompetitionHistoryService['history']> {
    const parsed = z.uuid().safeParse(competitionId);
    if (!parsed.success) throw new BadRequestException('Competition identifier is invalid.');
    return this.service.history(parsed.data);
  }
}
