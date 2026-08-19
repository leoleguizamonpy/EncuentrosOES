import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { ChampionService } from './champion.service.js';

const uuidSchema = z.uuid();
const bodySchema = z.object({ expectedRevision: z.int().positive() }).strict();
const idempotencySchema = z.string().min(16).max(120).regex(/^[A-Za-z0-9._:-]+$/);

@Controller()
@RequireRoles('ADMIN', 'SUPERADMIN')
export class ChampionController {
  public constructor(private readonly service: ChampionService) {}

  @Get('competitions/:competitionId/champion')
  public find(@Param('competitionId') competitionId: string): ReturnType<ChampionService['find']> {
    const parsed = uuidSchema.safeParse(competitionId);
    if (!parsed.success) throw new BadRequestException('Competition identifier is invalid.');
    return this.service.find(parsed.data);
  }

  @HttpCode(200)
  @Post('competitions/:competitionId/champion/propose')
  public propose(
    @Param('competitionId') competitionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<ChampionService['propose']> {
    const parsedCompetitionId = uuidSchema.safeParse(competitionId);
    const parsedBody = bodySchema.safeParse(body);
    const parsedKey = idempotencySchema.safeParse(idempotencyKey);
    if (!parsedCompetitionId.success) throw new BadRequestException('Competition identifier is invalid.');
    if (!parsedBody.success) throw new BadRequestException('Competition revision is invalid.');
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return this.service.propose({
      actorId: request.actor.id,
      actorRole: request.actor.role,
      competitionId: parsedCompetitionId.data,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      expectedRevision: parsedBody.data.expectedRevision,
      idempotencyKey: parsedKey.data,
    });
  }

  @HttpCode(200)
  @Post('competitions/:competitionId/champion/:proposalId/confirm')
  public confirm(
    @Param('competitionId') competitionId: string,
    @Param('proposalId') proposalId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<ChampionService['confirm']> {
    const parsedCompetitionId = uuidSchema.safeParse(competitionId);
    const parsedProposalId = uuidSchema.safeParse(proposalId);
    const parsedBody = bodySchema.safeParse(body);
    const parsedKey = idempotencySchema.safeParse(idempotencyKey);
    if (!parsedCompetitionId.success || !parsedProposalId.success) throw new BadRequestException('Champion identifiers are invalid.');
    if (!parsedBody.success) throw new BadRequestException('Competition revision is invalid.');
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return this.service.confirm({
      actorId: request.actor.id,
      actorRole: request.actor.role,
      competitionId: parsedCompetitionId.data,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      expectedRevision: parsedBody.data.expectedRevision,
      idempotencyKey: parsedKey.data,
      proposalId: parsedProposalId.data,
    });
  }
}
