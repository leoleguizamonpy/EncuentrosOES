import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import type { AccountRole } from './identity-store.js';
import { hashPassword } from './password.js';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface ManagedUser {
  readonly createdAt: string;
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly lastLoginAt: string | null;
  readonly role: AccountRole;
  readonly status: UserStatus;
  readonly updatedAt: string;
}

interface MutationContext {
  readonly actorId: string;
  readonly actorRole: 'SUPERADMIN';
  readonly correlationId: string;
}

interface CreateUserInput extends MutationContext {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly role: AccountRole;
}

interface UpdateUserInput extends MutationContext {
  readonly displayName: string;
  readonly password?: string;
  readonly role: AccountRole;
  readonly status: UserStatus;
  readonly userId: string;
}

function view(user: {
  readonly createdAt: Date;
  readonly displayName: string;
  readonly emailNormalized: string;
  readonly id: string;
  readonly lastLoginAt: Date | null;
  readonly role: string;
  readonly status: string;
  readonly updatedAt: Date;
}): ManagedUser {
  return {
    createdAt: user.createdAt.toISOString(),
    displayName: user.displayName,
    email: user.emailNormalized,
    id: user.id,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    role: user.role as AccountRole,
    status: user.status as UserStatus,
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class UsersAdminService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  public async list(): Promise<readonly ManagedUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: [{ status: 'asc' }, { displayName: 'asc' }] });
    return users.map(view);
  }

  public async create(input: CreateUserInput): Promise<ManagedUser> {
    const passwordHash = await hashPassword(input.password);
    const emailNormalized = input.email.trim().toLocaleLowerCase('en-US');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: {
        displayName: input.displayName.trim(),
        emailNormalized,
        passwordHash,
        role: input.role,
        status: 'ACTIVE',
      } });
      await tx.auditEntry.create({ data: {
        actionCode: 'USER_CREATED',
        actorId: input.actorId,
        actorRole: input.actorRole,
        correlationId: input.correlationId,
        metadata: { createdRole: input.role, email: emailNormalized },
        resourceId: user.id,
        resourceType: 'USER',
        revisionAfter: user.credentialVersion,
      } });
      return view(user);
    });
  }

  public async update(input: UpdateUserInput): Promise<ManagedUser> {
    if (input.userId === input.actorId && (input.role !== 'SUPERADMIN' || input.status !== 'ACTIVE')) {
      throw new BadRequestException('No puedes quitarte el rol SUPERADMIN ni desactivar tu propia cuenta.');
    }
    const passwordHash = input.password === undefined ? undefined : await hashPassword(input.password);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: input.userId } });
      if (current === null) throw new BadRequestException('El usuario no existe.');
      const invalidateCredentials = passwordHash !== undefined || current.role !== input.role || current.status !== input.status;
      const user = await tx.user.update({
        data: {
          credentialVersion: invalidateCredentials ? { increment: 1 } : undefined,
          displayName: input.displayName.trim(),
          passwordHash,
          role: input.role,
          status: input.status,
        },
        where: { id: input.userId },
      });
      await tx.auditEntry.create({ data: {
        actionCode: 'USER_UPDATED',
        actorId: input.actorId,
        actorRole: input.actorRole,
        correlationId: input.correlationId,
        metadata: {
          credentialInvalidated: invalidateCredentials,
          roleAfter: input.role,
          roleBefore: current.role,
          statusAfter: input.status,
          statusBefore: current.status,
        },
        resourceId: user.id,
        resourceType: 'USER',
        revisionAfter: user.credentialVersion,
        revisionBefore: current.credentialVersion,
      } });
      return view(user);
    });
  }
}
