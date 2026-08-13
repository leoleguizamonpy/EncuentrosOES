import { BadRequestException, Controller, Get, Inject, Param } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import { ResultsService } from './results.service.js';

@Controller()
@RequireRoles('ADMIN', 'OPERATOR', 'SUPERADMIN')
export class ResultsController {
  public constructor(@Inject(ResultsService) private readonly service: ResultsService) {}

  @Get('competitions/:competitionId/results-workspace')
  public workspace(@Param('competitionId') competitionId: string): ReturnType<ResultsService['workspace']> {
    const parsed = z.uuid().safeParse(competitionId);
    if (!parsed.success) throw new BadRequestException('Competition identifier is invalid.');
    return this.service.workspace(parsed.data);
  }
}
