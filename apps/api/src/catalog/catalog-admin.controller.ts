import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { Public, RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { CatalogAdminService, type CatalogMutationContext } from './catalog-admin.service.js';
import { CatalogAssetService } from './catalog-asset.service.js';

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
const activeNamedSchema = namedSchema.extend({ active: z.boolean() }).strict();
const visualNamedSchema = namedSchema.extend({ icon: iconSchema.nullable().default(null) }).strict();
const visualUpdateSchema = activeNamedSchema.extend({ icon: iconSchema.nullable().optional() }).strict();
const institutionSchema = visualNamedSchema.extend({ eventId: uuidSchema }).strict();
const institutionUpdateSchema = visualUpdateSchema.extend({ eventId: uuidSchema }).strict();
const combinationSchema = z.object({ eventId: uuidSchema, modalityId: uuidSchema, sportId: uuidSchema }).strict();
const combinationUpdateSchema = combinationSchema.extend({ active: z.boolean() }).strict();

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

function resourceId(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('El identificador del catálogo no es válido.');
  return parsed.data;
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
  public createEdition(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['createEdition']> {
    const parsed = editionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la edición no son válidos.');
    return this.service.createEdition({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @Patch('editions/:id')
  public updateEdition(@Param('id') id: string, @Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['updateEdition']> {
    const parsed = editionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la edición no son válidos.');
    return this.service.updateEdition(resourceId(id), { ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('events')
  public createEvent(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['createEvent']> {
    const parsed = namedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del evento no son válidos.');
    return this.service.createEvent({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @Patch('events/:id')
  public updateEvent(@Param('id') id: string, @Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['updateEvent']> {
    const parsed = activeNamedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del evento no son válidos.');
    return this.service.updateEvent(resourceId(id), { ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @HttpCode(201)
  @Post('sports')
  public createSport(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['createSport']> {
    const parsed = visualNamedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del deporte no son válidos.');
    return this.service.createSport({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @Patch('sports/:id')
  public updateSport(@Param('id') id: string, @Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['updateSport']> {
    const parsed = visualUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del deporte no son válidos.');
    const context = mutationContext(request, correlationId);
    const input = { active: parsed.data.active, code: parsed.data.code, name: parsed.data.name, ...context };
    return parsed.data.icon === undefined
      ? this.service.updateSport(resourceId(id), input)
      : this.service.updateSport(resourceId(id), { ...input, icon: parsed.data.icon });
  }

  @HttpCode(201)
  @Post('modalities')
  public createModality(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['createModality']> {
    const parsed = visualNamedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la modalidad no son válidos.');
    return this.service.createModality({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @Patch('modalities/:id')
  public updateModality(@Param('id') id: string, @Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['updateModality']> {
    const parsed = visualUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la modalidad no son válidos.');
    const context = mutationContext(request, correlationId);
    const input = { active: parsed.data.active, code: parsed.data.code, name: parsed.data.name, ...context };
    return parsed.data.icon === undefined
      ? this.service.updateModality(resourceId(id), input)
      : this.service.updateModality(resourceId(id), { ...input, icon: parsed.data.icon });
  }

  @HttpCode(201)
  @Post('institutions')
  public createInstitution(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['createInstitution']> {
    const parsed = institutionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la institución no son válidos.');
    return this.service.createInstitution({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @Patch('institutions/:id')
  public updateInstitution(@Param('id') id: string, @Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['updateInstitution']> {
    const parsed = institutionUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos de la institución no son válidos.');
    const context = mutationContext(request, correlationId);
    const input = {
      active: parsed.data.active,
      code: parsed.data.code,
      eventId: parsed.data.eventId,
      name: parsed.data.name,
      ...context,
    };
    return parsed.data.icon === undefined
      ? this.service.updateInstitution(resourceId(id), input)
      : this.service.updateInstitution(resourceId(id), { ...input, icon: parsed.data.icon });
  }

  @HttpCode(201)
  @Post('combinations')
  public createCombination(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['createCombination']> {
    const parsed = combinationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('La combinación seleccionada no es válida.');
    return this.service.createCombination({ ...parsed.data, ...mutationContext(request, correlationId) });
  }

  @Patch('combinations')
  public updateCombination(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<CatalogAdminService['updateCombination']> {
    const parsed = combinationUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('La combinación seleccionada no es válida.');
    return this.service.updateCombination({ ...parsed.data, ...mutationContext(request, correlationId) });
  }
}

@Controller('public/assets')
export class CatalogAssetController {
  public constructor(private readonly service: CatalogAssetService) {}

  @Public()
  @Get(':id')
  public async asset(@Param('id') id: string, @Res() response: Response): Promise<void> {
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) throw new BadRequestException('El identificador del recurso gráfico no es válido.');
    const asset = await this.service.getById(parsed.data);
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
