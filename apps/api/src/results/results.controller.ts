import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { ResultsService } from './results.service.js';

const penalties = z.object({ method: z.literal('PENALTIES'), scoreA: z.int().nonnegative().max(1_000_000), scoreB: z.int().nonnegative().max(1_000_000) }).strict();
const administrativeOutcome = z.enum(['ABANDONED_A', 'ABANDONED_B', 'NO_SHOW_A', 'NO_SHOW_B', 'NO_SHOW_BOTH', 'WITHDRAWN_A', 'WITHDRAWN_B']);

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
      z.object({ profile: z.literal('SCORE_BASED'), scoreA: z.int().nonnegative().max(1_000_000), scoreB: z.int().nonnegative().max(1_000_000), tieBreak: penalties.optional() }).strict(),
      z.object({ profile: z.literal('SET_BASED'), sets: z.array(z.object({ pointsA: z.int().nonnegative().max(1_000_000), pointsB: z.int().nonnegative().max(1_000_000) }).strict()).min(1).max(9) }).strict(),
      z.object({ profile: z.literal('ADMINISTRATIVE'), outcome: administrativeOutcome }).strict(),
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

  @HttpCode(200)
  @Post('group-qualifications/:qualificationId/confirm')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public confirmQualification(
    @Param('qualificationId') qualificationId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<ResultsService['confirmQualification']> {
    const parsed = z.object({ expectedRevision: z.int().positive() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException('The qualification revision is invalid.');
    return this.service.confirmQualification({
      ...this.#mutation(qualificationId, idempotencyKey, correlationId, request),
      expectedRevision: parsed.data.expectedRevision,
      qualificationId,
    });
  }

  @HttpCode(200)
  @Post('results/:resultId/annul')
  @RequireRoles('SUPERADMIN')
  public annul(
    @Param('resultId') resultId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<ResultsService['annul']> {
    const parsed = z.object({ expectedRevision: z.int().positive(), reason: z.string().trim().min(10).max(500) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException('An annulment reason between 10 and 500 characters is required.');
    return this.service.annul({
      ...this.#mutation(resultId, idempotencyKey, correlationId, request),
      expectedRevision: parsed.data.expectedRevision,
      reason: parsed.data.reason,
      resultId,
    });
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
