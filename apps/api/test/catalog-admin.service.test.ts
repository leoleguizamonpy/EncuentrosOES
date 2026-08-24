import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CatalogAdminService } from '../src/catalog/catalog-admin.service.js';
import { CatalogAssetService } from '../src/catalog/catalog-asset.service.js';

const actorId = '20000000-0000-4000-8000-000000000001';
const correlationId = '30000000-0000-4000-8000-000000000001';

function asPrismaClient(value: object): PrismaClient {
  return value as unknown as PrismaClient;
}

function serviceFor(client: PrismaClient): CatalogAdminService {
  return new CatalogAdminService(client, new CatalogAssetService(client));
}

describe('CatalogAdminService characterization', () => {
  it('creates an edition and audit entry in the same transaction', async () => {
    const editionCreate = vi.fn().mockResolvedValue({
      createdAt: new Date('2026-08-23T00:00:00.000Z'),
      createdById: actorId,
      id: 'edition-1',
      name: 'OES 2027',
      revision: 1,
      status: 'OPEN',
      updatedAt: new Date('2026-08-23T00:00:00.000Z'),
      updatedById: actorId,
      year: 2027,
    });
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const transaction = {
      auditEntry: { create: auditCreate },
      edition: { create: editionCreate },
    };
    const client = asPrismaClient({
      $transaction: vi.fn((callback: (value: typeof transaction) => unknown) => Promise.resolve(callback(transaction))),
    });
    const service = serviceFor(client);

    const result = await service.createEdition({
      actorId,
      actorRole: 'ADMIN',
      correlationId,
      name: ' OES 2027 ',
      status: 'OPEN',
      year: 2027,
    });

    expect(editionCreate).toHaveBeenCalledWith({
      data: {
        createdById: actorId,
        name: 'OES 2027',
        status: 'OPEN',
        updatedById: actorId,
        year: 2027,
      },
    });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const auditCall = auditCreate.mock.calls[0]?.[0] as
      | { readonly data: { readonly actionCode: string; readonly actorId: string; readonly actorRole: string; readonly correlationId: string; readonly resourceId: string; readonly resourceType: string } }
      | undefined;
    expect(auditCall?.data).toMatchObject({
      actionCode: 'CATALOG_EDITION_CREATE',
      actorId,
      actorRole: 'ADMIN',
      correlationId,
      resourceId: 'edition-1',
      resourceType: 'EDITION',
    });
    expect(result).toMatchObject({ id: 'edition-1', name: 'OES 2027', year: 2027 });
  });
});
