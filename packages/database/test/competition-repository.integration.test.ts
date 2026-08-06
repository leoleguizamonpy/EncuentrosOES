import {
  Competition,
  CompetitionRuleSet,
  type DomainError,
} from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaCompetitionRepository,
  PrismaCompetitionRuleSetRepository,
} from '../src/index.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const repository = new PrismaCompetitionRepository(client);
const ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);

const ids = {
  actor: '10000000-0000-4000-8000-000000000001',
  competition: '20000000-0000-4000-8000-000000000001',
  edition: '30000000-0000-4000-8000-000000000001',
  eventA: '40000000-0000-4000-8000-000000000001',
  eventB: '40000000-0000-4000-8000-000000000002',
  institutionA: '50000000-0000-4000-8000-000000000001',
  institutionB: '50000000-0000-4000-8000-000000000002',
  modality: '60000000-0000-4000-8000-000000000001',
  participantA: '70000000-0000-4000-8000-000000000001',
  participantB: '70000000-0000-4000-8000-000000000002',
  sport: '80000000-0000-4000-8000-000000000001',
  ruleSetA: '90000000-0000-4000-8000-000000000001',
  ruleSetB: '90000000-0000-4000-8000-000000000002',
} as const;
const occurredAt = new Date('2026-08-06T12:00:00.000Z');

function requireCompetition(value: Competition | null): Competition {
  if (value === null) {
    throw new Error('Expected the competition to exist');
  }

  return value;
}

function requireRuleSet(value: CompetitionRuleSet | null): CompetitionRuleSet {
  if (value === null) throw new Error('Expected the rule set to exist');
  return value;
}

const ruleSetConfiguration = {
  knockoutResolutionCode: 'HIGHER_SCORE' as const,
  metrics: ['PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'TABLE_POINTS', 'SCORE_DIFFERENCE'] as const,
  outcomes: [
    { code: 'WIN', description: 'Victoria', tablePoints: 3 },
    { code: 'DRAW', description: 'Empate', tablePoints: 1 },
    { code: 'LOSS', description: 'Derrota', tablePoints: 0 },
  ],
  profileConfig: { allowDraws: true, profile: 'SCORE_BASED' as const },
  resultProfile: 'SCORE_BASED' as const,
  tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'] as const,
};

async function cleanDatabase(): Promise<void> {
  await client.ruleSetTiebreak.deleteMany();
  await client.ruleSetMetric.deleteMany();
  await client.ruleSetOutcome.deleteMany();
  await client.competitionRuleSet.deleteMany();
  await client.competitionParticipant.deleteMany();
  await client.competition.deleteMany();
  await client.eventSportModality.deleteMany();
  await client.institution.deleteMany();
  await client.edition.deleteMany();
  await client.event.deleteMany();
  await client.sport.deleteMany();
  await client.modality.deleteMany();
  await client.user.deleteMany();
}

async function seedCatalog(): Promise<void> {
  await client.user.create({
    data: {
      displayName: 'Administrador de prueba',
      emailNormalized: 'admin@example.test',
      id: ids.actor,
      passwordHash: 'not-a-real-password-hash',
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
  await client.event.createMany({
    data: [
      { code: 'COLEGIALES', id: ids.eventA, name: 'Colegiales' },
      { code: 'UNIVERSITARIOS', id: ids.eventB, name: 'Universitarios' },
    ],
  });
  await client.sport.create({
    data: { code: 'FUTSAL', id: ids.sport, name: 'Futsal' },
  });
  await client.modality.create({
    data: { code: 'MALE', id: ids.modality, name: 'Masculina' },
  });
  await client.eventSportModality.create({
    data: {
      eventId: ids.eventA,
      modalityId: ids.modality,
      sportId: ids.sport,
    },
  });
  await client.institution.createMany({
    data: [
      {
        code: 'COL-1',
        createdById: ids.actor,
        eventId: ids.eventA,
        id: ids.institutionA,
        name: 'Colegio Uno',
        normalizedName: 'colegio uno',
        updatedById: ids.actor,
      },
      {
        code: 'UNI-1',
        createdById: ids.actor,
        eventId: ids.eventB,
        id: ids.institutionB,
        name: 'Universidad Uno',
        normalizedName: 'universidad uno',
        updatedById: ids.actor,
      },
    ],
  });
}

function createCompetition(): Competition {
  return Competition.create({
    actorId: ids.actor,
    id: ids.competition,
    key: {
      editionId: ids.edition,
      eventId: ids.eventA,
      modalityId: ids.modality,
      sportId: ids.sport,
    },
    occurredAt,
  });
}

function createRuleSet(id: string = ids.ruleSetA, revisionNumber = 1): CompetitionRuleSet {
  return CompetitionRuleSet.create({
    ...ruleSetConfiguration,
    actorId: ids.actor,
    competitionId: ids.competition,
    id,
    occurredAt,
    revisionNumber,
    schemaVersion: 1,
  });
}

integration('PrismaCompetitionRepository', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await seedCatalog();
  });

  afterAll(async () => {
    await cleanDatabase();
    await client.$disconnect();
  });

  it('persists and restores a competition with participants', async () => {
    await repository.insert(createCompetition());
    const restored = await repository.findById(ids.competition);

    expect(restored).not.toBeNull();
    const existingCompetition = requireCompetition(restored);
    existingCompetition.addParticipant({
      actorId: ids.actor,
      displayName: 'Colegio Uno',
      eventId: ids.eventA,
      expectedRevision: 1,
      id: ids.participantA,
      institutionId: ids.institutionA,
      occurredAt,
    });
    await repository.save(existingCompetition, 1);

    expect((await repository.findById(ids.competition))?.toSnapshot()).toMatchObject({
      participants: [
        {
          displayName: 'Colegio Uno',
          institutionId: ids.institutionA,
          status: 'ENABLED',
        },
      ],
      revision: 2,
      status: 'DRAFT',
    });
  });

  it('returns null for an unknown competition', async () => {
    expect(
      await repository.findById('20000000-0000-4000-8000-000000000099'),
    ).toBeNull();
  });

  it('rejects a stale save and preserves the first transition', async () => {
    await repository.insert(createCompetition());
    const first = await repository.findById(ids.competition);
    const stale = await repository.findById(ids.competition);

    expect(first).not.toBeNull();
    expect(stale).not.toBeNull();
    const firstVersion = requireCompetition(first);
    const staleVersion = requireCompetition(stale);
    firstVersion.open({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    staleVersion.open({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await repository.save(firstVersion, 1);

    await expect(repository.save(staleVersion, 1)).rejects.toMatchObject({
      code: 'CONCURRENCY_CONFLICT',
    } satisfies Partial<DomainError>);
    expect((await repository.findById(ids.competition))?.toSnapshot()).toMatchObject({
      revision: 2,
      status: 'OPEN',
    });
  });

  it('enforces event isolation through composite foreign keys', async () => {
    await repository.insert(createCompetition());

    await expect(
      client.competitionParticipant.create({
        data: {
          competitionId: ids.competition,
          displayName: 'Universidad Uno',
          enabledAt: occurredAt,
          enabledById: ids.actor,
          eventId: ids.eventA,
          id: ids.participantA,
          institutionId: ids.institutionB,
        },
      }),
    ).rejects.toThrow();
    expect(await client.competitionParticipant.count()).toBe(0);
  });

  it('enforces one institution per competition', async () => {
    const competition = createCompetition();
    competition.addParticipant({
      actorId: ids.actor,
      displayName: 'Colegio Uno',
      eventId: ids.eventA,
      expectedRevision: 1,
      id: ids.participantA,
      institutionId: ids.institutionA,
      occurredAt,
    });
    await repository.insert(competition);

    await expect(
      client.competitionParticipant.create({
        data: {
          competitionId: ids.competition,
          displayName: 'Colegio duplicado',
          enabledAt: occurredAt,
          enabledById: ids.actor,
          eventId: ids.eventA,
          id: ids.participantB,
          institutionId: ids.institutionA,
        },
      }),
    ).rejects.toThrow();
    expect(await client.competitionParticipant.count()).toBe(1);
  });

  it('persists, updates and restores an ordered rule set', async () => {
    await repository.insert(createCompetition());
    await ruleSetRepository.insert(createRuleSet());
    const restored = requireRuleSet(await ruleSetRepository.findById(ids.ruleSetA));

    restored.update({
      ...ruleSetConfiguration,
      actorId: ids.actor,
      expectedRevision: 1,
      occurredAt,
      outcomes: ruleSetConfiguration.outcomes.map((outcome) =>
        outcome.code === 'WIN' ? { ...outcome, tablePoints: 2 } : outcome,
      ),
    });
    await ruleSetRepository.save(restored, 1);

    const snapshot = requireRuleSet(
      await ruleSetRepository.findById(ids.ruleSetA),
    ).toSnapshot();
    expect(snapshot.outcomes).toContainEqual({
      code: 'WIN',
      description: 'Victoria',
      tablePoints: 2,
    });
    expect(snapshot.revision).toBe(2);
    expect(snapshot.tieBreakCriteria).toEqual([
      'TABLE_POINTS',
      'WINS',
      'SCORE_DIFFERENCE',
    ]);
  });

  it('freezes a rule set and enforces child immutability in PostgreSQL', async () => {
    await repository.insert(createCompetition());
    const ruleSet = createRuleSet();
    await ruleSetRepository.insert(ruleSet);
    ruleSet.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.save(ruleSet, 1);

    await expect(
      client.ruleSetOutcome.update({
        data: { tablePoints: 99 },
        where: {
          ruleSetId_outcomeCode: { outcomeCode: 'WIN', ruleSetId: ids.ruleSetA },
        },
      }),
    ).rejects.toThrow();
    const snapshot = requireRuleSet(
      await ruleSetRepository.findById(ids.ruleSetA),
    ).toSnapshot();
    expect(snapshot.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.status).toBe('FROZEN');
  });

  it('allows only one frozen rule set per competition', async () => {
    await repository.insert(createCompetition());
    const first = createRuleSet();
    first.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.insert(first);
    const second = createRuleSet(ids.ruleSetB, 2);
    second.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });

    await expect(ruleSetRepository.insert(second)).rejects.toThrow();
    expect(await client.competitionRuleSet.count()).toBe(1);
  });
});
