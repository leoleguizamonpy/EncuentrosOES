import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { UsersAdminService } from '../src/identity/users-admin.service.js';

const actorId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const correlationId = '20000000-0000-4000-8000-000000000001';

function user(overrides: Record<string, unknown> = {}) {
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
    const tx = {
      auditEntry: { create: vi.fn().mockResolvedValue({}) },
      user: {
        findUnique: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaClient;
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

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ credentialVersion: { increment: 1 }, role: 'ADMIN' }),
    }));
    expect(tx.auditEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actionCode: 'USER_UPDATED',
      actorId,
      resourceId: userId,
      revisionBefore: 2,
      revisionAfter: 3,
    }) });
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
