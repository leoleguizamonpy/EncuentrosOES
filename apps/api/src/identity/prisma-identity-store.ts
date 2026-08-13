import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import type {
  AccountRecord,
  AccountRole,
  CreateSessionRecord,
  IdentityStore,
  SessionRecord,
} from './identity-store.js';

function role(value: string): AccountRole {
  if (value === 'ADMIN' || value === 'OPERATOR' || value === 'SUPERADMIN') return value;
  throw new Error(`Unsupported persisted role: ${value}`);
}

function account(record: {
  credentialVersion: number;
  displayName: string;
  emailNormalized: string;
  failedLoginCount: number;
  id: string;
  loginBlockedUntil: Date | null;
  passwordHash: string;
  role: string;
  status: string;
}): AccountRecord {
  return { ...record, role: role(record.role) };
}

@Injectable()
export class PrismaIdentityStore implements IdentityStore {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async findAccountByEmail(emailNormalized: string): Promise<AccountRecord | null> {
    const record = await this.client.user.findUnique({ where: { emailNormalized } });
    return record === null ? null : account(record);
  }

  public async recordFailedLogin(userId: string, occurredAt: Date): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.user.findUniqueOrThrow({
        select: { failedLoginCount: true },
        where: { id: userId },
      });
      const nextCount = current.failedLoginCount + 1;
      const delaySeconds = nextCount < 5 ? 0 : Math.min(30 * 2 ** (nextCount - 5), 900);
      await transaction.user.update({
        data: {
          failedLoginCount: nextCount,
          loginBlockedUntil: delaySeconds === 0
            ? null
            : new Date(occurredAt.getTime() + delaySeconds * 1_000),
        },
        where: { id: userId },
      });
    });
  }

  public async resetFailedLogin(userId: string): Promise<void> {
    await this.client.user.update({
      data: { failedLoginCount: 0, loginBlockedUntil: null },
      where: { id: userId },
    });
  }

  public async createSession(input: CreateSessionRecord): Promise<SessionRecord> {
    const record = await this.client.userSession.create({
      data: {
        credentialVersion: input.credentialVersion,
        csrfHash: input.csrfHash,
        expiresAt: input.expiresAt,
        idleExpiresAt: input.idleExpiresAt,
        lastSeenAt: input.occurredAt,
        tokenHash: input.tokenHash,
        userId: input.userId,
      },
      include: { user: true },
    });
    return { ...record, user: account(record.user) };
  }

  public async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const record = await this.client.userSession.findUnique({
      include: { user: true },
      where: { tokenHash },
    });
    return record === null ? null : { ...record, user: account(record.user) };
  }

  public async touchSession(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void> {
    await this.client.userSession.updateMany({
      data: { idleExpiresAt, lastSeenAt, revision: { increment: 1 } },
      where: { id: sessionId, revokedAt: null },
    });
  }

  public async revokeSession(sessionId: string, occurredAt: Date): Promise<void> {
    await this.client.userSession.updateMany({
      data: { revokedAt: occurredAt, revision: { increment: 1 } },
      where: { id: sessionId, revokedAt: null },
    });
  }
}
