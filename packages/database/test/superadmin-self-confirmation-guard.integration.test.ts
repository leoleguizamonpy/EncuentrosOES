import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/index.js';
import type { Prisma } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);

const ids = {
  admin: '1a000000-0000-4000-8000-000000000001',
  superadmin: '1a000000-0000-4000-8000-000000000002',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
}

async function seedAuthorities(): Promise<void> {
  await client.user.createMany({
    data: [
      {
        displayName: 'Administrador guard',
        emailNormalized: 'guard-admin@example.test',
        id: ids.admin,
        passwordHash: 'hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        displayName: 'Superadministrador guard',
        emailNormalized: 'guard-superadmin@example.test',
        id: ids.superadmin,
        passwordHash: 'hash',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      },
    ],
  });
}

async function createProbe(transaction: Prisma.TransactionClient): Promise<void> {
  await transaction.$executeRawUnsafe(
    'CREATE TEMP TABLE authority_probe (origin_id UUID, confirm_id UUID) ON COMMIT DROP',
  );
  await transaction.$executeRawUnsafe(
    `CREATE TRIGGER authority_probe_guard
      BEFORE INSERT OR UPDATE OF origin_id, confirm_id ON authority_probe
      FOR EACH ROW EXECUTE FUNCTION enforce_superadmin_self_confirmation('origin_id', 'confirm_id')`,
  );
}

integration('SUPERADMIN database self-confirmation guard', () => {
  beforeEach(async () => {
    await clean();
    await seedAuthorities();
  });

  afterAll(async () => {
    await clean();
    await client.$disconnect();
  });

  it('allows an active SUPERADMIN to originate and confirm the same transition', async () => {
    await client.$transaction(async (transaction) => {
      await createProbe(transaction);
      const inserted = await transaction.$executeRawUnsafe(
        `INSERT INTO authority_probe (origin_id, confirm_id)
         VALUES ('${ids.superadmin}', '${ids.superadmin}')`,
      );
      expect(inserted).toBe(1);
    });
  });

  it('still rejects self-confirmation by a normal ADMIN', async () => {
    await expect(
      client.$transaction(async (transaction) => {
        await createProbe(transaction);
        await transaction.$executeRawUnsafe(
          `INSERT INTO authority_probe (origin_id, confirm_id)
           VALUES ('${ids.admin}', '${ids.admin}')`,
        );
      }),
    ).rejects.toThrow(/self-confirmation requires an active SUPERADMIN/i);
  });

  it('installs the guard on every persisted critical confirmation surface', async () => {
    const triggers = await client.$queryRawUnsafe<{ tgname: string }[]>(
      `SELECT tgname
       FROM pg_trigger
       WHERE NOT tgisinternal
         AND tgname IN (
           'official_draws_self_confirmation_guard',
           'match_results_self_confirmation_guard',
           'group_qualifications_self_confirmation_guard'
         )
       ORDER BY tgname`,
    );
    expect(triggers.map(({ tgname }) => tgname)).toEqual([
      'group_qualifications_self_confirmation_guard',
      'match_results_self_confirmation_guard',
      'official_draws_self_confirmation_guard',
    ]);

    const legacyConstraints = await client.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname
       FROM pg_constraint
       WHERE conname IN (
         'official_draws_separation_check',
         'match_results_separation_check',
         'group_qualifications_separation_check'
       )`,
    );
    expect(legacyConstraints).toHaveLength(0);
  });
});
