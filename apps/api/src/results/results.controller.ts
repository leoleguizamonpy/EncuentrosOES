import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
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

  @HttpCode(200)
  @Post('matches/:matchId/results')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public record(
    @Param('matchId') matchId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<ResultsService['record']> {
    const detail = z.discriminatedUnion('profile', [
      z.object({ profile: z.literal('SCORE_BASED'), scoreA: z.int().nonnegative().max(1_000_000), scoreB: z.int().nonnegative().max(1_000_000) }).strict(),
      z.object({ profile: z.literal('SET_BASED'), sets: z.array(z.object({ pointsA: z.int().nonnegative().max(1_000_000), pointsB: z.int().nonnegative().max(1_000_000) }).strict()).min(1).max(9) }).strict(),
    ]).safeParse(body);
    if (!detail.success) throw new BadRequestException('The result detail is invalid.');
    return this.service.record({ ...this.#mutation(matchId, idempotencyKey, correlationId, request), detail: detail.data, matchId });
  }

  @HttpCode(200)
  @Post('results/:resultId/confirm')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public confirm(
    @Param('resultId') resultId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<ResultsService['confirm']> {
    const parsed = z.object({ expectedRevision: z.int().positive() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException('The result revision is invalid.');
    return this.service.confirm({ ...this.#mutation(resultId, idempotencyKey, correlationId, request), expectedRevision: parsed.data.expectedRevision, resultId });
  }

  #mutation(identifier: string, idempotencyKey: string | undefined, correlationId: string | undefined, request: AuthenticatedRequest) {
    const parsedIdentifier = z.uuid().safeParse(identifier);
    const parsedKey = z.string().min(16).max(120).regex(/^[A-Za-z0-9._:-]+$/).safeParse(idempotencyKey);
    if (!parsedIdentifier.success) throw new BadRequestException('Result identifier is invalid.');
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelation = z.uuid().safeParse(correlationId);
    return { actorId: request.actor.id, correlationId: parsedCorrelation.success ? parsedCorrelation.data : randomUUID(), idempotencyKey: parsedKey.data };
  }
}
