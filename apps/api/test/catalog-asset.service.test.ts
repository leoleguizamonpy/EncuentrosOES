import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CatalogAssetService } from '../src/catalog/catalog-asset.service.js';

function asPrismaClient(value: object): PrismaClient {
  return value as unknown as PrismaClient;
}

function asTransaction(value: object): Prisma.TransactionClient {
  return value as unknown as Prisma.TransactionClient;
}

describe('CatalogAssetService', () => {
  it('returns the persisted asset payload without changing its bytes or metadata', async () => {
    const content = new Uint8Array([1, 2, 3, 4]);
    const client = asPrismaClient({
      $queryRaw: vi.fn().mockResolvedValue([
        {
          content,
          file_name: 'futsal.webp',
          mime_type: 'image/webp',
          size_bytes: content.length,
        },
      ]),
    });
    const service = new CatalogAssetService(client);

    await expect(service.getById('10000000-0000-4000-8000-000000000001')).resolves.toEqual({
      content,
      file_name: 'futsal.webp',
      mime_type: 'image/webp',
      size_bytes: 4,
    });
  });

  it('fails explicitly when the requested asset does not exist', async () => {
    const client = asPrismaClient({ $queryRaw: vi.fn().mockResolvedValue([]) });
    const service = new CatalogAssetService(client);

    await expect(service.getById('10000000-0000-4000-8000-000000000002')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves the current asset when sync receives undefined', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'asset-current' }]);
    const executeRaw = vi.fn();
    const transaction = asTransaction({ $executeRaw: executeRaw, $queryRaw: queryRaw });
    const service = new CatalogAssetService(asPrismaClient({}));

    await expect(service.sync(transaction, 'SPORT', 'sport-1', undefined, 'actor-1')).resolves.toBe('asset-current');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('removes the current asset when sync receives null', async () => {
    const queryRaw = vi.fn();
    const executeRaw = vi.fn().mockResolvedValue(1);
    const transaction = asTransaction({ $executeRaw: executeRaw, $queryRaw: queryRaw });
    const service = new CatalogAssetService(asPrismaClient({}));

    await expect(service.sync(transaction, 'MODALITY', 'modality-1', null, 'actor-1')).resolves.toBeNull();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('replaces an asset inside the provided transaction', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'asset-new' }]);
    const executeRaw = vi.fn().mockResolvedValue(1);
    const transaction = asTransaction({ $executeRaw: executeRaw, $queryRaw: queryRaw });
    const service = new CatalogAssetService(asPrismaClient({}));

    await expect(service.replace(transaction, 'INSTITUTION', 'institution-1', {
      base64: Buffer.from('icon').toString('base64'),
      fileName: 'institution.png',
      mimeType: 'image/png',
    }, 'actor-1')).resolves.toBe('asset-new');

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty asset before touching persistence', async () => {
    const queryRaw = vi.fn();
    const executeRaw = vi.fn();
    const transaction = asTransaction({ $executeRaw: executeRaw, $queryRaw: queryRaw });
    const service = new CatalogAssetService(asPrismaClient({}));

    await expect(service.replace(transaction, 'SPORT', 'sport-1', {
      base64: '',
      fileName: 'empty.png',
      mimeType: 'image/png',
    }, 'actor-1')).rejects.toBeInstanceOf(ConflictException);

    expect(executeRaw).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
