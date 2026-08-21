import { Competition } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPrismaClient, PrismaCompetitionRepository } from '../src/index.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const repository = new PrismaCompetitionRepository(client);

const ids = {
  actor: '12000000-0000-4000-8000-000000000001',
  competitionA: '22000000-0000-4000-8000-000000000001',
  competitionB: '22000000-0000-4000-8000-000000000002',
  edition: '32000000-0000-4000-8000-000000000001',
  event: '42000000-0000-4000-8000-000000000001',
  institution: '72000000-0000-4000-8000-000000000001',
  modality: '62000000-0000-4000-8000-000000000001',
  participant: '73000000-0000-4000-8000-000000000001',
  sport: '82000000-0000-4000-8000-000000000001',
} as const;
const occurredAt = new Date('2026-08-21T21:00:00.000Z');

async function seed(): Promise<void> {
  await client.user.create({
    data: {
      displayName: 'Administrador transaccional',
      emailNormalized: 'transaction-aware@example.test',
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
  await client.event.create({ data: { code: 'COLEGIALES', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({
    data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
  });
  await client.institution.create({
    data: {
      code: 'TX',
      createdById: ids.actor,
      eventId: ids.event,
      id: ids.institution,
      name: 'Equipo transaccional',
      normalizedName: 'equipo transaccional',
      updatedById: ids.actor,
    },
  });
}

function createCompetition(id: string): Competition {
  return Competition.create({
    actorId: ids.actor,
    id,
    key: {
      editionId: ids.edition,
      eventId: ids.event,
      modalityId: ids.modality,
      sportId: ids.sport,
    },
    occurredAt,
  });
}

function requireCompetition(value: Competition | null): Competition {
  if (value === null) throw new Error('Expected competition to exist inside transaction.');
  return value;
}

beforeEach(async () => {
  if (process.env.DATABASE_URL === undefined) return;
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE',
  );
  await seed();
});

afterAll(async () => client.$disconnect());

integration('PrismaCompetitionRepository transaction-aware operations', () => {
  it('rolls back an in-transaction insert when the outer transaction fails', async () => {
    const competition = createCompetition(ids.competitionA);

    await expect(
      client.$transaction(async (transaction) => {
        await repository.insertInTransaction(transaction, competition);
        expect(await repository.findByIdInTransaction(transaction, competition.id)).not.toBeNull();
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    expect(await repository.findById(ids.competitionA)).toBeNull();
  });

  it('reads and saves the same aggregate inside one outer transaction', async () => {
    const competition = createCompetition(ids.competitionB);

    await client.$transaction(async (transaction) => {
      await repository.insertInTransaction(transaction, competition);
      const persisted = requireCompetition(
        await repository.findByIdInTransaction(transaction, competition.id),
      );
      persisted.addParticipant({
        actorId: ids.actor,
        displayName: 'Equipo transaccional',
        eventId: ids.event,
        expectedRevision: 1,
        id: ids.participant,
        institutionId: ids.institution,
        occurredAt,
      });
      await repository.saveInTransaction(transaction, persisted, 1);
    });

    const current = requireCompetition(await repository.findById(ids.competitionB));
    expect(current.toSnapshot()).toMatchObject({ revision: 2 });
    expect(current.toSnapshot().participants).toHaveLength(1);
    expect(current.toSnapshot().participants[0]).toMatchObject({
      id: ids.participant,
      institutionId: ids.institution,
      status: 'ENABLED',
    });
  });
});
