import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';

export interface AuditTimelineEntry {
  readonly actionCode: string;
  readonly actor: Readonly<{ displayName: string | null; id: string | null; role: string }>;
  readonly competitionId: string | null;
  readonly correlationId: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly reason: string | null;
  readonly resourceId: string;
  readonly resourceType: string;
  readonly revisionAfter: number | null;
  readonly revisionBefore: number | null;
}

@Injectable()
export class AuditService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  public async timeline(): Promise<readonly AuditTimelineEntry[]> {
    const entries = await this.prisma.auditEntry.findMany({
      include: { actor: { select: { displayName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });

    return entries.map((entry) => ({
      actionCode: entry.actionCode,
      actor: {
        displayName: entry.actor?.displayName ?? null,
        id: entry.actorId,
        role: entry.actorRole,
      },
      competitionId: entry.competitionId,
      correlationId: entry.correlationId,
      id: entry.id,
      occurredAt: entry.occurredAt.toISOString(),
      reason: entry.reason,
      resourceId: entry.resourceId,
      resourceType: entry.resourceType,
      revisionAfter: entry.revisionAfter,
      revisionBefore: entry.revisionBefore,
    }));
  }
}
