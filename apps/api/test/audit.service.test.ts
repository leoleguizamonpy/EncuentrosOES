import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { AuditService } from '../src/audit/audit.service.js';

describe('AuditService', () => {
  it('returns the newest persisted audit entries with actor and revision evidence', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      actionCode: 'MATCH_RESULT_CONFIRMED',
      actor: { displayName: 'Admin B' },
      actorId: '10000000-0000-4000-8000-000000000002',
      actorRole: 'ADMIN',
      competitionId: '20000000-0000-4000-8000-000000000001',
      correlationId: '30000000-0000-4000-8000-000000000001',
      id: '40000000-0000-4000-8000-000000000001',
      occurredAt: new Date('2026-08-21T14:30:00.000Z'),
      reason: null,
      resourceId: '50000000-0000-4000-8000-000000000001',
      resourceType: 'MATCH_RESULT',
      revisionAfter: 3,
      revisionBefore: 2,
    }]);
    const service = new AuditService({ auditEntry: { findMany } } as unknown as PrismaClient);

    await expect(service.timeline()).resolves.toEqual([{
      actionCode: 'MATCH_RESULT_CONFIRMED',
      actor: { displayName: 'Admin B', id: '10000000-0000-4000-8000-000000000002', role: 'ADMIN' },
      competitionId: '20000000-0000-4000-8000-000000000001',
      correlationId: '30000000-0000-4000-8000-000000000001',
      id: '40000000-0000-4000-8000-000000000001',
      occurredAt: '2026-08-21T14:30:00.000Z',
      reason: null,
      resourceId: '50000000-0000-4000-8000-000000000001',
      resourceType: 'MATCH_RESULT',
      revisionAfter: 3,
      revisionBefore: 2,
    }]);
    expect(findMany).toHaveBeenCalledWith({ include: { actor: { select: { displayName: true } } }, orderBy: { occurredAt: 'desc' }, take: 200 });
  });
});
