import { createPrismaClient, PrismaCompetitionRepository } from '@oes/database';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { CompetitionStoreError } from '../src/competitions/competition-store.js';
import { PrismaCompetitionStore } from '../src/competitions/prisma-competition-store.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const repository = new PrismaCompetitionRepository(client);
const store = new PrismaCompetitionStore(client);

const ids = {
  actor: '13000000-0000-4000-8000-000000000001',
  edition: '33000000-0000-4000-8000-000000000001',
  event: '43000000-0000-4000-8000-000000000001',
  modality: '63000000-0000-4000-8000-000000000001',
  sport: '83000000-0000-4000-8000-000000000001',
} as const;

async function seed(): Promise<void> {
  await client.user.create({
    data: {
      displayName: 'Administrador create-equivalence',
      emailNormalized: 'create-equivalence@example.test',
      id: ids.actor,
      passwordHash: 'not-a-real-password-hash',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  await client.edition.create({
    data: {
      createdById: ids.actor,
      id: ids.edition,
      name: 'OES 2026',
      status: 'OPEN',
      updatedById: ids.actor,
      year: 2026,
    },
  });
  await client.event.create({
    data: { code: 'COLEGIALES', id: ids.event, name: 'Colegiales' },
  });
  await client.sport.create({
    data: { code: 'FUTSAL', id: ids.sport, name: 'Futsal' },
  });
  await client.modality.create({
    data: { code: 'MALE', id: ids.modality, name: 'Masculina' },
  });
  await client.eventSportModality.create({
    data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
  });
}

beforeEach(async () => {
  if (process.env.DATABASE_URL === undefined) return;
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE',
  );
  await seed();
});

afterAll(async () => client.$disconnect());

integration('competition create persistence equivalence', () => {
  it('keeps aggregate, projection, audit and idempotent replay equivalent at creation', async () => {
    const input = {
      actorId: ids.actor,
      actorRole: 'ADMIN' as const,
      correlationId: '93000000-0000-4000-8000-000000000001',
      editionId: ids.edition,
      eventId: ids.event,
      idempotencyKey: 'create-equivalence-0001',
      modalityId: ids.modality,
      sportId: ids.sport,
    };

    const created = await store.create(input);
    const aggregate = await repository.findById(created.id);
    expect(aggregate).not.toBeNull();
    expect(aggregate?.toSnapshot()).toMatchObject({
      formatCode: null,
      groupCount: null,
      id: created.id,
      key: {
        editionId: created.edition.id,
        eventId: created.event.id,
        modalityId: created.modality.id,
        sportId: created.sport.id,
      },
      participants: [],
      revision: created.revision,
      status: created.status,
    });

    expect(created).toMatchObject({
      formatCode: null,
      groupCount: null,
      participantCount: 0,
      revision: 1,
      status: 'DRAFT',
    });

    const audit = await client.auditEntry.findMany({ where: { competitionId: created.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actionCode: 'COMPETITION_CREATED',
      actorId: ids.actor,
      competitionId: created.id,
      correlationId: input.correlationId,
      resourceId: created.id,
      resourceType: 'COMPETITION',
      revisionAfter: 1,
    });

    const replay = await store.create(input);
    expect(replay).toEqual(created);
    expect(await client.competition.count()).toBe(1);
    expect(await client.auditEntry.count()).toBe(1);
    expect(await client.idempotencyRecord.count()).toBe(1);

    await expect(
      store.create({ ...input, sportId: '83000000-0000-4000-8000-000000000099' }),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    } satisfies Partial<CompetitionStoreError>);
  });
});
