import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { UsersAdminService } from '../src/identity/users-admin.service.js';

const actorId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const correlationId = '20000000-0000-4000-8000-000000000001';

interface UserRecord {
  readonly createdAt: Date;
  readonly credentialVersion: number;
  readonly displayName: string;
  readonly emailNormalized: string;
  readonly id: string;
  readonly lastLoginAt: Date | null;
  readonly passwordHash: string;
  readonly role: string;
  readonly status: string;
  readonly updatedAt: Date;
}

interface UpdateArgs {
  readonly data: {
    readonly credentialVersion?: { readonly increment: number };
    readonly displayName?: string;
    readonly passwordHash?: string;
    readonly role?: string;
    readonly status?: string;
  };
  readonly where: { readonly id: string };
}

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    createdAt: new Date('2026-08-21T12:00:00.000Z'),
    credentialVersion: 2,
    displayName: 'Operador Uno',
    emailNormalized: 'operador@oes.test',
    id: userId,
    lastLoginAt: null,
    passwordHash: 'hash',
    role: 'OPERATOR',
    status: 'ACTIVE',
    updatedAt: new Date('2026-08-21T12:00:00.000Z'),
    ...overrides,
  };
}

describe('UsersAdminService', () => {
  it('increments credentialVersion and audits a sensitive role change', async () => {
    const current = user();
    const updated = user({ credentialVersion: 3, role: 'ADMIN' });
    const auditCreate = vi.fn(() => Promise.resolve({}));
    const updateUser = vi.fn((input: UpdateArgs): Promise<UserRecord> => {
      void input;
      return Promise.resolve(updated);
    });
    const tx = {
      auditEntry: { create: auditCreate },
      user: {
        findUnique: vi.fn(() => Promise.resolve(current)),
        update: updateUser,
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>): Promise<unknown> => callback(tx)),
    } as unknown as PrismaClient;
    const service = new UsersAdminService(prisma);

    const result = await service.update({
      actorId,
      actorRole: 'SUPERADMIN',
      correlationId,
      displayName: 'Operador Uno',
      role: 'ADMIN',
      status: 'ACTIVE',
      userId,
    });

    expect(updateUser).toHaveBeenCalledWith({
      data: {
        credentialVersion: { increment: 1 },
        displayName: 'Operador Uno',
        passwordHash: undefined,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      where: { id: userId },
    });
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(result.role).toBe('ADMIN');
  });

  it('does not allow the acting superadministrator to demote or disable itself', async () => {
    const service = new UsersAdminService({} as PrismaClient);

    await expect(service.update({
      actorId,
      actorRole: 'SUPERADMIN',
      correlationId,
      displayName: 'Super OES',
      role: 'ADMIN',
      status: 'ACTIVE',
      userId: actorId,
    })).rejects.toThrow(/quitarte el rol SUPERADMIN/i);
  });
});
