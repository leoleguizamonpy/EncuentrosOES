import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { GeneralChampionshipService } from './general-championship.service.js';

const uuid = z.uuid();
const idempotency = z.string().min(16).max(120).regex(/^[A-Za-z0-9._:-]+$/);
const revision = z.int().positive();
const rule = z.object({ label: z.string().trim().min(1).max(80), placement: z.int().positive(), points: z.int().nonnegative() }).strict();
const createBody = z.object({ editionId: uuid, eventId: uuid, name: z.string().trim().min(3).max(160), rules: z.array(rule).min(1).max(20).optional() }).strict();
const scoringBody = z.object({ expectedRevision: revision, rules: z.array(rule).min(1).max(20) }).strict();
const revisionBody = z.object({ expectedRevision: revision }).strict();
const specialBody = z.object({ description: z.string().trim().min(5).max(500), expectedRevision: revision, institutionId: uuid, points: z.int().positive().max(100000), title: z.string().trim().min(2).max(120) }).strict();
const placementBody = z.object({ competitionId: uuid, description: z.string().trim().min(5).max(500), expectedRevision: revision, institutionId: uuid, placement: z.int().positive().max(100) }).strict();
const contributionBody = z.object({ expectedRevision: revision }).strict();
const annulBody = z.object({ expectedRevision: revision, reason: z.string().trim().min(10).max(500) }).strict();

@Controller('general-championships')
@RequireRoles('ADMIN', 'SUPERADMIN', 'OPERATOR')
export class GeneralChampionshipController {
  public constructor(private readonly service: GeneralChampionshipService) {}

  @Get('catalog')
  public catalog(): ReturnType<GeneralChampionshipService['catalog']> {
    return this.service.catalog();
  }

  @Get('by-scope')
  public byScope(@Query('editionId') editionId: string | undefined, @Query('eventId') eventId: string | undefined): ReturnType<GeneralChampionshipService['findByScope']> {
    const parsedEdition = uuid.safeParse(editionId);
    const parsedEvent = uuid.safeParse(eventId);
    if (!parsedEdition.success || !parsedEvent.success) throw new BadRequestException('Edition and event identifiers are required.');
    return this.service.findByScope(parsedEdition.data, parsedEvent.data);
  }

  @Get(':championshipId')
  public find(@Param('championshipId') championshipId: string): ReturnType<GeneralChampionshipService['find']> {
    const parsed = uuid.safeParse(championshipId);
    if (!parsed.success) throw new BadRequestException('General championship identifier is invalid.');
    return this.service.find(parsed.data);
  }

  @HttpCode(200)
  @Post()
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public create(@Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['create']> {
    const parsed = createBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException('General championship configuration is invalid.');
    return this.service.create({ ...this.context(request, key, correlationId), ...parsed.data });
  }

  @Patch(':championshipId/scoring')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public scoring(@Param('championshipId') championshipId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['saveScoring']> {
    const id = uuid.safeParse(championshipId);
    const parsed = scoringBody.safeParse(body);
    if (!id.success || !parsed.success) throw new BadRequestException('General championship scoring request is invalid.');
    return this.service.saveScoring({ ...this.context(request, key, correlationId), championshipId: id.data, ...parsed.data });
  }

  @HttpCode(200)
  @Post(':championshipId/activate')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public activate(@Param('championshipId') championshipId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['activate']> {
    return this.revisionMutation(championshipId, body, key, correlationId, request, (input) => this.service.activate(input));
  }

  @HttpCode(200)
  @Post(':championshipId/special-contributions')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public special(@Param('championshipId') championshipId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['addSpecial']> {
    const id = uuid.safeParse(championshipId);
    const parsed = specialBody.safeParse(body);
    if (!id.success || !parsed.success) throw new BadRequestException('Special contribution is invalid.');
    return this.service.addSpecial({ ...this.context(request, key, correlationId), championshipId: id.data, ...parsed.data });
  }

  @HttpCode(200)
  @Post(':championshipId/placement-contributions')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public placement(@Param('championshipId') championshipId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['addPlacement']> {
    const id = uuid.safeParse(championshipId);
    const parsed = placementBody.safeParse(body);
    if (!id.success || !parsed.success) throw new BadRequestException('Placement contribution is invalid.');
    return this.service.addPlacement({ ...this.context(request, key, correlationId), championshipId: id.data, ...parsed.data });
  }

  @HttpCode(200)
  @Post(':championshipId/sync')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public sync(@Param('championshipId') championshipId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['syncFinalizedCompetitions']> {
    return this.revisionMutation(championshipId, body, key, correlationId, request, (input) => this.service.syncFinalizedCompetitions(input));
  }

  @HttpCode(200)
  @Post('contributions/:contributionId/confirm')
  @RequireRoles('ADMIN', 'SUPERADMIN')
  public confirm(@Param('contributionId') contributionId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['confirmContribution']> {
    const id = uuid.safeParse(contributionId);
    const parsed = contributionBody.safeParse(body);
    if (!id.success || !parsed.success) throw new BadRequestException('Contribution confirmation is invalid.');
    return this.service.confirmContribution({ ...this.context(request, key, correlationId), contributionId: id.data, ...parsed.data });
  }

  @HttpCode(200)
  @Post('contributions/:contributionId/annul')
  @RequireRoles('SUPERADMIN')
  public annul(@Param('contributionId') contributionId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['annulContribution']> {
    const id = uuid.safeParse(contributionId);
    const parsed = annulBody.safeParse(body);
    if (!id.success || !parsed.success) throw new BadRequestException('Contribution annulment is invalid.');
    return this.service.annulContribution({ ...this.context(request, key, correlationId), contributionId: id.data, ...parsed.data });
  }

  @HttpCode(200)
  @Post(':championshipId/finalize')
  @RequireRoles('SUPERADMIN')
  public finalize(@Param('championshipId') championshipId: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<GeneralChampionshipService['finalize']> {
    return this.revisionMutation(championshipId, body, key, correlationId, request, (input) => this.service.finalize(input));
  }

  private context(request: AuthenticatedRequest, key: string | undefined, correlationId: string | undefined) {
    const parsedKey = idempotency.safeParse(key);
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    if (request.actor === undefined) throw new BadRequestException('Authenticated actor is missing.');
    const parsedCorrelation = uuid.safeParse(correlationId);
    return { actorId: request.actor.id, actorRole: request.actor.role, correlationId: parsedCorrelation.success ? parsedCorrelation.data : randomUUID(), idempotencyKey: parsedKey.data } as const;
  }

  private revisionMutation(championshipId: string, body: unknown, key: string | undefined, correlationId: string | undefined, request: AuthenticatedRequest, mutation: (input: ReturnType<GeneralChampionshipController['context']> & { championshipId: string; expectedRevision: number }) => ReturnType<GeneralChampionshipService['activate']>) {
    const id = uuid.safeParse(championshipId);
    const parsed = revisionBody.safeParse(body);
    if (!id.success || !parsed.success) throw new BadRequestException('General championship revision request is invalid.');
    return mutation({ ...this.context(request, key, correlationId), championshipId: id.data, expectedRevision: parsed.data.expectedRevision });
  }
}
