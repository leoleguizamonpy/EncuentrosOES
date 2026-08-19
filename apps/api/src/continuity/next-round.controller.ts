import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { NextRoundService } from './next-round.service.js';

const uuidSchema = z.uuid();
const bodySchema = z.object({ expectedRevision: z.int().positive() }).strict();
const idempotencySchema = z.string().min(16).max(120).regex(/^[A-Za-z0-9._:-]+$/);

@Controller()
@RequireRoles('ADMIN', 'SUPERADMIN')
export class NextRoundController {
  public constructor(private readonly service: NextRoundService) {}

  @HttpCode(200)
  @Post('competitions/:competitionId/next-round/prepare')
  public prepare(
    @Param('competitionId') competitionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<NextRoundService['prepare']> {
    const parsedCompetitionId = uuidSchema.safeParse(competitionId);
    const parsedBody = bodySchema.safeParse(body);
    const parsedKey = idempotencySchema.safeParse(idempotencyKey);
    if (!parsedCompetitionId.success) throw new BadRequestException('Competition identifier is invalid.');
    if (!parsedBody.success) throw new BadRequestException('Competition revision is invalid.');
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return this.service.prepare({
      actorId: request.actor.id,
      actorRole: request.actor.role,
      competitionId: parsedCompetitionId.data,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      expectedRevision: parsedBody.data.expectedRevision,
      idempotencyKey: parsedKey.data,
    });
  }
}
