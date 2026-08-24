import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { CatalogAssetService } from '../src/catalog/catalog-asset.service.js';
import { CatalogQueryService } from '../src/catalog/catalog-query.service.js';

function asPrismaClient(value: object): PrismaClient {
  return value as unknown as PrismaClient;
}

describe('CatalogQueryService', () => {
  it('returns the stable catalog projection and attaches asset ids by resource', async () => {
    const client = asPrismaClient({
      edition: { findMany: vi.fn().mockResolvedValue([{ id: 'edition-1', name: 'OES 2026', status: 'OPEN', year: 2026 }]) },
      event: { findMany: vi.fn().mockResolvedValue([{ active: true, code: 'COL', id: 'event-1', name: 'Colegiales' }]) },
      sport: { findMany: vi.fn().mockResolvedValue([{ active: true, code: 'FUTSAL', id: 'sport-1', name: 'Futsal' }]) },
      modality: { findMany: vi.fn().mockResolvedValue([{ active: true, code: 'M', id: 'modality-1', name: 'Masculina' }]) },
      institution: { findMany: vi.fn().mockResolvedValue([{ active: true, code: 'CNVNV', eventId: 'event-1', id: 'institution-1', name: 'CNVNV' }]) },
      eventSportModality: {
        findMany: vi.fn().mockResolvedValue([{ active: true, eventId: 'event-1', modalityId: 'modality-1', sportId: 'sport-1' }]),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        { asset_id: 'asset-sport', resource_id: 'sport-1', resource_type: 'SPORT' },
        { asset_id: 'asset-institution', resource_id: 'institution-1', resource_type: 'INSTITUTION' },
      ]),
    });
    const service = new CatalogQueryService(client, new CatalogAssetService(client));

    const catalog = await service.catalog();

    expect(catalog.editions).toHaveLength(1);
    expect(catalog.events[0]?.code).toBe('COL');
    expect(catalog.sports[0]?.iconAssetId).toBe('asset-sport');
    expect(catalog.modalities[0]?.iconAssetId).toBeNull();
    expect(catalog.institutions[0]?.iconAssetId).toBe('asset-institution');
    expect(catalog.combinations).toHaveLength(1);
  });
});
