import { createPrismaClient, PrismaCompetitionRepository } from '@oes/database';
import { Competition, type DomainError } from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaCompetitionStore } from '../src/competitions/prisma-competition-store.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const repository = new PrismaCompetitionRepository(client);
const store = new PrismaCompetitionStore(client);

const ids = {
  actor: '11000000-0000-4000-8000-000000000001',
  competitionA: '21000000-0000-4000-8000-000000000001',
  competitionB: '21000000-0000-4000-8000-000000000002',
  edition: '31000000-0000-4000-8000-000000000001',
  event: '41000000-0000-4000-8000-000000000001',
  institutionA: '71000000-0000-4000-8000-000000000001',
  institutionB: '71000000-0000-4000-8000-000000000002',
  institutionC: '71000000-0000-4000-8000-000000000003',
  modality: '61000000-0000-4000-8000-000000000001',
  participantA: '72000000-0000-4000-8000-000000000001',
  participantB: '72000000-0000-4000-8000-000000000002',
  participantC: '72000000-0000-4000-8000-000000000003',
  sport: '81000000-0000-4000-8000-000000000001',
} as const;

const occurredAt = new Date('2026-08-21T20:00:00.000Z');

async function seed(): Promise<void> {
  await client.user.create({
    data: {
      displayName: 'Administrador equivalencia',
      emailNormalized: 'persistence-equivalence@example.test',
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
  await client.institution.createMany({
    data: [
      {
        code: 'EA',
        createdById: ids.actor,
        eventId: ids.event,
        id: ids.institutionA,
        name: 'Equipo A',
        normalizedName: 'equipo a',
        updatedById: ids.actor,
      },
      {
        code: 'EB',
        createdById: ids.actor,
        eventId: ids.event,
        id: ids.institutionB,
        name: 'Equipo B',
        normalizedName: 'equipo b',
        updatedById: ids.actor,
      },
      {
        code: 'EC',
        createdById: ids.actor,
        eventId: ids.event,
        id: ids.institutionC,
        name: 'Equipo C',
        normalizedName: 'equipo c',
        updatedById: ids.actor,
      },
    ],
  });
}

function createAggregate(id: string): Competition {
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
  if (value === null) throw new Error('Expected persisted competition to exist.');
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

integration('competition persistence equivalence', () => {
  it('projects repository-written aggregate state through PrismaCompetitionStore', async () => {
    const aggregate = createAggregate(ids.competitionA);
    const participants = [
      [ids.participantA, ids.institutionA, 'Equipo A'],
      [ids.participantB, ids.institutionB, 'Equipo B'],
      [ids.participantC, ids.institutionC, 'Equipo C'],
    ] as const;

    for (const [index, [id, institutionId, displayName]] of participants.entries()) {
      aggregate.addParticipant({
        actorId: ids.actor,
        displayName,
        eventId: ids.event,
        expectedRevision: index + 1,
        id,
        institutionId,
        occurredAt,
      });
    }
    aggregate.configureFormat({
      actorId: ids.actor,
      expectedRevision: 4,
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      occurredAt,
    });
    await repository.insert(aggregate);

    const detail = await store.detail(ids.competitionA);
    const snapshot = aggregate.toSnapshot();

    expect(detail).toMatchObject({
      formatCode: snapshot.formatCode,
      groupCount: snapshot.groupCount,
      id: snapshot.id,
      participantCount: snapshot.participants.length,
      revision: snapshot.revision,
      status: snapshot.status,
    });
    expect(detail.participants.map(({ institutionId }) => institutionId).sort()).toEqual(
      snapshot.participants.map(({ institutionId }) => institutionId).sort(),
    );
  });

  it('preserves optimistic concurrency when store and repository write the same competition', async () => {
    const aggregate = createAggregate(ids.competitionB);
    await repository.insert(aggregate);

    const stale = requireCompetition(await repository.findById(ids.competitionB));

    await store.addParticipant({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competitionB,
      correlationId: '92000000-0000-4000-8000-000000000001',
      expectedRevision: 1,
      idempotencyKey: 'equivalence-concurrency-store-0001',
      institutionId: ids.institutionA,
    });

    stale.addParticipant({
      actorId: ids.actor,
      displayName: 'Equipo B',
      eventId: ids.event,
      expectedRevision: 1,
      id: ids.participantB,
      institutionId: ids.institutionB,
      occurredAt,
    });

    await expect(repository.save(stale, 1)).rejects.toMatchObject({
      code: 'CONCURRENCY_CONFLICT',
    } satisfies Partial<DomainError>);

    const current = await repository.findById(ids.competitionB);
    expect(current?.toSnapshot()).toMatchObject({ revision: 2 });
    expect(current?.toSnapshot().participants.map(({ institutionId }) => institutionId)).toEqual([
      ids.institutionA,
    ]);
  });
});
