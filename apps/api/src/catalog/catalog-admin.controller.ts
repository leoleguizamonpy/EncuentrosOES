import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { Public, RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { CatalogAdminService, type CatalogMutationContext } from './catalog-admin.service.js';

const uuidSchema = z.uuid();
const codeSchema = z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/);
const nameSchema = z.string().trim().min(2).max(160);
const iconSchema = z.object({
  base64: z.string().min(4).max(2_200_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
}).strict();
const editionSchema = z.object({
  name: nameSchema,
  status: z.enum(['CLOSED', 'OPEN']).default('OPEN'),
  year: z.int().min(2020).max(2100),
}).strict();
const namedSchema = z.object({ code: codeSchema, name: nameSchema }).strict();
const visualNamedSchema = namedSchema.extend({ icon: iconSchema.nullable().default(null) }).strict();
const institutionSchema = visualNamedSchema.extend({ eventId: uuidSchema }).strict();
const combinationSchema = z.object({ eventId: uuidSchema, modalityId: uuidSchema, sportId: uuidSchema }).strict();

function mutationContext(request: AuthenticatedRequest, correlationId: string | undefined): CatalogMutationContext {
  if (request.actor === undefined || request.actor.role === 'OPERATOR') {
    throw new BadRequestException('Authenticated catalog administrator is missing.');
  }
  const parsedCorrelationId = uuidSchema.safeParse(correlationId);
  return {
    actorId: request.actor.id,
    actorRole: request.actor.role,
    correlationId: parsedCorrelationId.success ? parsedCorrelationId.data : randomUUID(),
  };
}

@Controller('admin/catalog')
@RequireRoles('ADMIN', 'SUPERADMIN')
export class CatalogAdminController {
  public constructor(private readonly service: CatalogAdminService) {}

  @Get()
  public catalog(): ReturnType<CatalogAdminService['catalog']> {
    return this.service.catalog();
  }

  @HttpCode(201)
  @Post('editions')
  public createEdition(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CatalogAdminService['createEdition']> {
    const parsed = editionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la edición no son válidos.');
    return this.service.createEdition({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('events')
  public createEvent(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CatalogAdminService['createEvent']> {
    const parsed = namedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del evento no son válidos.');
    return this.service.createEvent({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('sports')
  public createSport(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CatalogAdminService['createSport']> {
    const parsed = visualNamedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del deporte no son válidos.');
    return this.service.createSport({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('modalities')
  public createModality(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CatalogAdminService['createModality']> {
    const parsed = visualNamedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la modalidad no son válidos.');
    return this.service.createModality({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('institutions')
  public createInstitution(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CatalogAdminService['createInstitution']> {
    const parsed = institutionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la institución no son válidos.');
    return this.service.createInstitution({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('combinations')
  public createCombination(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<CatalogAdminService['createCombination']> {
    const parsed = combinationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('La combinación seleccionada no es válida.');
    return this.service.createCombination({ ...parsed.data, ...mutationContext(request, correlationId) });
  }
}

@Controller('public/assets')
export class CatalogAssetController {
  public constructor(private readonly service: CatalogAdminService) {}

  @Public()
  @Get(':id')
  public async asset(@Param('id') id: string, @Res() response: Response): Promise<void> {
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) throw new BadRequestException('El identificador del recurso gráfico no es válido.');
    const asset = await this.service.asset(parsed.data);
    response
      .status(200)
      .set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(asset.size_bytes),
        'Content-Type': asset.mime_type,
        'X-Content-Type-Options': 'nosniff',
      })
      .send(Buffer.from(asset.content));
  }
}
