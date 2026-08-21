import { randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { RequireRoles } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { UsersAdminService } from './users-admin.service.js';

const uuidSchema = z.uuid();
const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'SUPERADMIN']);
const statusSchema = z.enum(['ACTIVE', 'DISABLED']);
const createSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254),
  password: z.string().min(12).max(256),
  role: roleSchema,
}).strict();
const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(256).optional(),
  role: roleSchema,
  status: statusSchema,
}).strict();

function context(request: AuthenticatedRequest, correlationId: string | undefined): { readonly actorId: string; readonly actorRole: 'SUPERADMIN'; readonly correlationId: string } {
  if (request.actor?.role !== 'SUPERADMIN') throw new BadRequestException('Superadministrador autenticado requerido.');
  const parsed = uuidSchema.safeParse(correlationId);
  return { actorId: request.actor.id, actorRole: 'SUPERADMIN', correlationId: parsed.success ? parsed.data : randomUUID() };
}

@Controller('admin/users')
@RequireRoles('SUPERADMIN')
export class UsersAdminController {
  public constructor(private readonly service: UsersAdminService) {}

  @Get()
  public list(): ReturnType<UsersAdminService['list']> {
    return this.service.list();
  }

  @Post()
  public create(@Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<UsersAdminService['create']> {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Los datos del usuario no son válidos.');
    return this.service.create({ ...parsed.data, ...context(request, correlationId) });
  }

  @Patch(':id')
  public update(@Param('id') id: string, @Body() body: unknown, @Headers('x-correlation-id') correlationId: string | undefined, @Req() request: AuthenticatedRequest): ReturnType<UsersAdminService['update']> {
    const userId = uuidSchema.safeParse(id);
    const parsed = updateSchema.safeParse(body);
    if (!userId.success || !parsed.success) throw new BadRequestException('Los datos del usuario no son válidos.');
    const input = {
      ...context(request, correlationId),
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      status: parsed.data.status,
      userId: userId.data,
      ...(parsed.data.password === undefined ? {} : { password: parsed.data.password }),
    };
    return this.service.update(input);
  }
}
