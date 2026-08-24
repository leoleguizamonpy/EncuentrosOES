import { afterAll, describe, expect, it } from 'vitest';

import { createPrismaClient, PrismaChampionFinalizationService } from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const service = new PrismaChampionFinalizationService(client);
const warningMessage = 'Calling client.query() when the client is already executing a query';

integration('Prisma champion runtime warnings', () => {
  afterAll(async () => { await client.$disconnect(); });

  it('does not issue pg concurrent-query deprecation warnings while reading champion state', async () => {
    const warnings: string[] = [];
    const onWarning = (warning: Error): void => {
      if (warning.message.includes(warningMessage)) warnings.push(warning.message);
    };

    process.on('warning', onWarning);
    try {
      await service.find('ffffffff-ffff-4fff-8fff-ffffffffffff');
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      process.off('warning', onWarning);
    }

    expect(warnings).toEqual([]);
  });
});
