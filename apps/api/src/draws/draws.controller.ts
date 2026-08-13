import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { DrawsService } from './draws.service.js';

const uuidSchema = z.uuid();
const idempotencySchema = z.string().min(16).max(120).regex(/^[A-Za-z0-9._:-]+$/);
const revisionSchema = z.object({ expectedRevision: z.int().positive() }).strict();
const annulmentSchema = z.object({ expectedRevision: z.int().positive(), reason: z.string().trim().min(10).max(500) }).strict();

@Controller()
@RequireRoles('ADMIN', 'OPERATOR', 'SUPERADMIN')
export class DrawsController {
  public constructor(@Inject(DrawsService) private readonly service: DrawsService) {}

  @Get('competitions/:competitionId/draw-workspace')
  public workspace(@Param('competitionId') competitionId: string): ReturnType<DrawsService['workspace']> {
    const parsed = uuidSchema.safeParse(competitionId);
    if (!parsed.success) throw new BadRequestException('Competition identifier is invalid.');
    return this.service.workspace(parsed.data);
  }

  @HttpCode(200)
  @Post('competitions/:competitionId/draw-workspace/prepare')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public prepare(
    @Param('competitionId') competitionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<DrawsService['prepare']> {
    return this.service.prepare({
      ...this.#mutation(competitionId, body, idempotencyKey, correlationId, request),
      competitionId,
    });
  }

  @HttpCode(200)
  @Post('draw-configurations/:configurationId/execute')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public execute(
    @Param('configurationId') configurationId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<DrawsService['execute']> {
    return this.service.execute({
      ...this.#mutation(configurationId, body, idempotencyKey, correlationId, request),
      configurationId,
    });
  }

  @HttpCode(200)
  @Post('official-draws/:executionId/confirm')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public confirm(
    @Param('executionId') executionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<DrawsService['confirm']> {
    return this.service.confirm({
      ...this.#mutation(executionId, body, idempotencyKey, correlationId, request),
      executionId,
    });
  }

  @HttpCode(200)
  @Post('official-draws/:executionId/annul')
  @RequireRoles('SUPERADMIN')
  public annul(
    @Param('executionId') executionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<DrawsService['annul']> {
    const parsedBody = annulmentSchema.safeParse(body);
    if (!parsedBody.success) throw new BadRequestException('An annulment reason between 10 and 500 characters is required.');
    const mutation = this.#mutation(
      executionId,
      { expectedRevision: parsedBody.data.expectedRevision },
      idempotencyKey,
      correlationId,
      request,
    );
    return this.service.annul({ ...mutation, executionId, reason: parsedBody.data.reason });
  }

  #mutation(
    identifier: string,
    body: unknown,
    idempotencyKey: string | undefined,
    correlationId: string | undefined,
    request: AuthenticatedRequest,
  ) {
    const parsedIdentifier = uuidSchema.safeParse(identifier);
    const parsedBody = revisionSchema.safeParse(body);
    const parsedKey = idempotencySchema.safeParse(idempotencyKey);
    if (!parsedIdentifier.success || !parsedBody.success) throw new BadRequestException('Draw revision is invalid.');
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return {
      ...parsedBody.data,
      actorId: request.actor.id,
      actorRole: request.actor.role,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      idempotencyKey: parsedKey.data,
    };
  }
}
