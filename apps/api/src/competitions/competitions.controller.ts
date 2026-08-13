import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
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
const mutationSchema = z.object({ expectedRevision: z.int().positive() }).strict();
const participantSchema = mutationSchema.extend({ institutionId: z.uuid() }).strict();
const formatSchema = z.discriminatedUnion('formatCode', [
  mutationSchema.extend({ formatCode: z.literal('GROUP_STAGE'), groupCount: z.int().positive() }).strict(),
  mutationSchema.extend({ formatCode: z.literal('KNOCKOUT'), groupCount: z.null() }).strict(),
]);

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

  @Get(':id')
  public detail(@Param('id') id: string): ReturnType<CompetitionsService['detail']> {
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) throw new BadRequestException('Competition identifier is invalid.');
    return this.service.detail(parsed.data);
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


  @HttpCode(200)
  @Post(':id/participants')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public addParticipant(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CompetitionsService['addParticipant']> {
    const competitionId = uuidSchema.safeParse(id);
    const parsedBody = participantSchema.safeParse(body);
    const key = idempotencySchema.safeParse(idempotencyKey);
    if (!competitionId.success || !parsedBody.success) throw new BadRequestException('Participant selection is invalid.');
    if (!key.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return this.service.addParticipant({
      ...parsedBody.data,
      actorId: request.actor.id,
      actorRole: request.actor.role,
      competitionId: competitionId.data,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      idempotencyKey: key.data,
    });
  }

  @HttpCode(200)
  @Patch(':id/format')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public configureFormat(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CompetitionsService['configureFormat']> {
    const competitionId = uuidSchema.safeParse(id);
    const parsedBody = formatSchema.safeParse(body);
    const key = idempotencySchema.safeParse(idempotencyKey);
    if (!competitionId.success || !parsedBody.success) throw new BadRequestException('Format configuration is invalid.');
    if (!key.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelationId = uuidSchema.safeParse(correlationId);
    return this.service.configureFormat({
      ...parsedBody.data,
      actorId: request.actor.id,
      actorRole: request.actor.role,
      competitionId: competitionId.data,
      correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
      idempotencyKey: key.data,
    });
  }
}
