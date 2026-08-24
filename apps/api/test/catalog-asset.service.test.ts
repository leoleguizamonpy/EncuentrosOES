import { NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CatalogAssetService } from '../src/catalog/catalog-asset.service.js';

function asPrismaClient(value: object): PrismaClient {
  return value as unknown as PrismaClient;
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
});
