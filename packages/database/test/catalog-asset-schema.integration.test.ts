import { afterAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);

integration('CatalogAsset Prisma mapping', () => {
  afterAll(async () => {
    await client.$disconnect();
  });

  it('maps the catalog_assets table created by the deployed migration', async () => {
    const count = await client.catalogAsset.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });
});
