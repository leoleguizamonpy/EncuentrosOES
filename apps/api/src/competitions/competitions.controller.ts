import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { CompetitionsService } from './competitions.service.js';

const createSchema = z.object({
  editionId: z.uuid(),
  eventId: z.uuid(),
  modalityId: z.uuid(),
  sportId: z.uuid(),
}).strict();
const idempotencySchema = z.string().min(16).max(120).regex(/^[A-Za-z0-9._:-]+$/);
const uuidSchema = z.uuid();

@Controller('competitions')
@RequireRoles('ADMIN', 'OPERATOR', 'SUPERADMIN')
export class CompetitionsController {
  public constructor(
    @Inject(CompetitionsService) private readonly service: CompetitionsService,
  ) {}

  @Get('catalog')
  public catalog(): ReturnType<CompetitionsService['catalog']> {
    return this.service.catalog();
  }

  @Get()
  public list(): ReturnType<CompetitionsService['list']> {
    return this.service.list();
  }

  @HttpCode(201)
  @Post()
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CompetitionsService['create']> {
    const parsedBody = createSchema.safeParse(body);
    const parsedKey = idempotencySchema.safeParse(idempotencyKey);
    if (!parsedBody.success) throw new BadRequestException('Competition selection is invalid.');
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return this.service.create({
      ...parsedBody.data,
      actorId: request.actor.id,
      actorRole: request.actor.role,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      idempotencyKey: parsedKey.data,
    });
  }
}
