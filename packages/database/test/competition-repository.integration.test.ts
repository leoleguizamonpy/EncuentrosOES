import {
  Competition,
  CompetitionRuleSet,
  DrawConfiguration,
  type DomainError,
} from '@oes/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaCompetitionRepository,
  PrismaCompetitionLockService,
  PrismaCompetitionRuleSetRepository,
  PrismaDrawConfigurationRepository,
  PrismaGroupQualificationService,
  PrismaOfficialDrawService,
  PrismaMatchResultService,
} from '../src/index.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const repository = new PrismaCompetitionRepository(client);
const lockService = new PrismaCompetitionLockService(client);
const ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
const drawRepository = new PrismaDrawConfigurationRepository(client);
const officialDrawService = new PrismaOfficialDrawService(client);
const matchResultService = new PrismaMatchResultService(client);
const qualificationService = new PrismaGroupQualificationService(client);

const ids = {
  actor: '10000000-0000-4000-8000-000000000001',
  confirmer: '10000000-0000-4000-8000-000000000002',
  competition: '20000000-0000-4000-8000-000000000001',
  edition: '30000000-0000-4000-8000-000000000001',
  eventA: '40000000-0000-4000-8000-000000000001',
  eventB: '40000000-0000-4000-8000-000000000002',
  institutionA: '50000000-0000-4000-8000-000000000001',
  institutionB: '50000000-0000-4000-8000-000000000002',
  institutionC: '50000000-0000-4000-8000-000000000003',
  institutionD: '50000000-0000-4000-8000-000000000004',
  modality: '60000000-0000-4000-8000-000000000001',
  participantA: '70000000-0000-4000-8000-000000000001',
  participantB: '70000000-0000-4000-8000-000000000002',
  participantC: '70000000-0000-4000-8000-000000000003',
  participantD: '70000000-0000-4000-8000-000000000004',
  sport: '80000000-0000-4000-8000-000000000001',
  ruleSetA: '90000000-0000-4000-8000-000000000001',
  ruleSetB: '90000000-0000-4000-8000-000000000002',
  drawA: 'a0000000-0000-4000-8000-000000000001',
  drawB: 'a0000000-0000-4000-8000-000000000002',
  executionA: 'b0000000-0000-4000-8000-000000000001',
  resultA: 'c0000000-0000-4000-8000-000000000001',
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
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE',
  );
}

async function seedCatalog(): Promise<void> {
  await client.user.createMany({
    data: [
      {
        displayName: 'Administrador de prueba',
        emailNormalized: 'admin@example.test',
        id: ids.actor,
        passwordHash: 'not-a-real-password-hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        displayName: 'Superadministrador de prueba',
        emailNormalized: 'superadmin@example.test',
        id: ids.confirmer,
        passwordHash: 'not-a-real-password-hash',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      },
    ],
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
      {
        code: 'COL-2',
        createdById: ids.actor,
        eventId: ids.eventA,
        id: ids.institutionC,
        name: 'Colegio Dos',
        normalizedName: 'colegio dos',
        updatedById: ids.actor,
      },
      {
        code: 'COL-3',
        createdById: ids.actor,
        eventId: ids.eventA,
        id: ids.institutionD,
        name: 'Colegio Tres',
        normalizedName: 'colegio tres',
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

function createCompetitionWithThreeParticipants(open = false): Competition {
  const competition = createCompetition();
  const participants = [
    [ids.participantA, ids.institutionA, 'Colegio Uno'],
    [ids.participantC, ids.institutionC, 'Colegio Dos'],
    [ids.participantD, ids.institutionD, 'Colegio Tres'],
  ] as const;
  for (const [index, [id, institutionId, displayName]] of participants.entries()) {
    competition.addParticipant({
      actorId: ids.actor,
      displayName,
      eventId: ids.eventA,
      expectedRevision: index + 1,
      id,
      institutionId,
      occurredAt,
    });
  }
  if (open) competition.open({ actorId: ids.actor, expectedRevision: 4, occurredAt });
  return competition;
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

function createDraw(
  id: string = ids.drawA,
  formatCode: 'GROUP_STAGE' | 'KNOCKOUT' = 'GROUP_STAGE',
): DrawConfiguration {
  const common = {
    actorId: ids.actor,
    competitionId: ids.competition,
    id,
    occurredAt,
    participants: [
      { byeCount: 0, displayName: 'Colegio Uno', id: ids.participantA },
      { byeCount: 0, displayName: 'Colegio Dos', id: ids.participantC },
      { byeCount: 0, displayName: 'Colegio Tres', id: ids.participantD },
    ],
    ruleSetId: ids.ruleSetA,
  } as const;
  return formatCode === 'GROUP_STAGE'
    ? DrawConfiguration.create({
        ...common,
        formatCode: 'GROUP_STAGE',
        groupCount: 1,
        roundNumber: 0,
      })
    : DrawConfiguration.create({
        ...common,
        formatCode: 'KNOCKOUT',
        groupCount: null,
        roundNumber: 1,
      });
}

async function prepareLockedDraw(
  formatCode: 'GROUP_STAGE' | 'KNOCKOUT' = 'GROUP_STAGE',
): Promise<void> {
  const competition = createCompetitionWithThreeParticipants(true);
  await repository.insert(competition);
  const ruleSet = createRuleSet();
  ruleSet.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await ruleSetRepository.insert(ruleSet);
  const draw = createDraw(ids.drawA, formatCode);
  draw.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
  await drawRepository.insert(draw);
  await lockService.lock({
    actorId: ids.actor,
    competitionId: ids.competition,
    drawConfigurationId: ids.drawA,
    expectedRevision: 5,
    occurredAt,
    ruleSetId: ids.ruleSetA,
  });
}

async function prepareConfirmedDraw(
  formatCode: 'GROUP_STAGE' | 'KNOCKOUT' = 'GROUP_STAGE',
): Promise<void> {
  await prepareLockedDraw(formatCode);
  await officialDrawService.execute({
    actorId: ids.actor,
    configurationId: ids.drawA,
    executionId: ids.executionA,
    occurredAt,
    seed: Uint8Array.from({ length: 32 }, (_, index) => index),
  });
  await officialDrawService.confirm({
    actorId: ids.confirmer,
    executionId: ids.executionA,
    expectedRevision: 1,
    occurredAt,
  });
}

async function completeGroup(): Promise<readonly string[]> {
  await prepareConfirmedDraw();
  const matches = await client.logicalMatch.findMany({ orderBy: { ordinal: 'asc' } });
  const resultIds = [
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
  ] as const;
  for (const [index, match] of matches.entries()) {
    const participantAWins = match.participantAId.localeCompare(match.participantBId) < 0;
    const resultId = resultIds[index];
    if (resultId === undefined) throw new Error('Unexpected group match count');
    await matchResultService.record({
      actorId: ids.actor,
      detail: {
        profile: 'SCORE_BASED',
        scoreA: participantAWins ? 1 : 0,
        scoreB: participantAWins ? 0 : 1,
      },
      matchId: match.id,
      occurredAt,
      resultId,
    });
    await matchResultService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt,
      resultId,
    });
  }
  return resultIds;
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

  it('persists and restores a frozen draw configuration', async () => {
    await repository.insert(createCompetitionWithThreeParticipants());
    const ruleSet = createRuleSet();
    ruleSet.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.insert(ruleSet);
    const draw = createDraw();
    await drawRepository.insert(draw);
    draw.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await drawRepository.save(draw, 1);

    const snapshot = (await drawRepository.findById(ids.drawA))?.toSnapshot();
    expect(snapshot?.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot).toMatchObject({
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      participantCount: 3,
      status: 'FROZEN',
    });
    expect(snapshot?.participants.map(({ id }) => id)).toEqual([
      ids.participantA,
      ids.participantC,
      ids.participantD,
    ]);
    await expect(
      client.drawConfigurationParticipant.update({
        data: { byeCountSnapshot: 99 },
        where: {
          drawConfigurationId_competitionParticipantId: {
            competitionParticipantId: ids.participantA,
            drawConfigurationId: ids.drawA,
          },
        },
      }),
    ).rejects.toThrow();
  });

  it('allows only one frozen draw configuration per competition round', async () => {
    await repository.insert(createCompetitionWithThreeParticipants());
    const ruleSet = createRuleSet();
    ruleSet.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.insert(ruleSet);
    const first = createDraw();
    first.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await drawRepository.insert(first);
    const second = createDraw(ids.drawB);
    second.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });

    await expect(drawRepository.insert(second)).rejects.toThrow();
    expect(await client.drawConfiguration.count()).toBe(1);
  });

  it('persists a locked competition only with matching frozen dependencies', async () => {
    const competition = createCompetitionWithThreeParticipants(true);
    await repository.insert(competition);
    const ruleSet = createRuleSet();
    ruleSet.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.insert(ruleSet);
    const draw = createDraw();
    draw.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await drawRepository.insert(draw);

    competition.lock({
      actorId: ids.actor,
      drawConfiguration: draw.toSnapshot(),
      expectedRevision: 5,
      occurredAt,
      ruleSet: ruleSet.toSnapshot(),
    });
    await lockService.lock({
      actorId: ids.actor,
      competitionId: ids.competition,
      drawConfigurationId: ids.drawA,
      expectedRevision: 5,
      occurredAt,
      ruleSetId: ids.ruleSetA,
    });

    expect((await repository.findById(ids.competition))?.toSnapshot()).toMatchObject({
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      lockedBy: ids.actor,
      revision: 6,
      status: 'LOCKED',
    });
  });

  it('rejects persisted locking while the competition is not open', async () => {
    await repository.insert(createCompetitionWithThreeParticipants());
    const ruleSet = createRuleSet();
    ruleSet.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.insert(ruleSet);
    const draw = createDraw();
    draw.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await drawRepository.insert(draw);

    await expect(
      lockService.lock({
        actorId: ids.actor,
        competitionId: ids.competition,
        drawConfigurationId: ids.drawA,
        expectedRevision: 1,
        occurredAt,
        ruleSetId: ids.ruleSetA,
      }),
    ).rejects.toMatchObject({ code: 'LOCK_PRECONDITION_FAILED' } satisfies Partial<DomainError>);
    expect((await repository.findById(ids.competition))?.toSnapshot().status).toBe('DRAFT');
  });

  it('persists an official execution without materializing unconfirmed structures', async () => {
    await prepareLockedDraw();
    const execution = await officialDrawService.execute({
      actorId: ids.actor,
      configurationId: ids.drawA,
      executionId: ids.executionA,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index),
    });

    expect(execution.toSnapshot()).toMatchObject({
      executedBy: ids.actor,
      revision: 1,
      status: 'PENDING_CONFIRMATION',
    });
    expect(await client.drawGroup.count()).toBe(0);
    expect(await client.logicalMatch.count()).toBe(0);
  });

  it('confirms with another authority and atomically creates group matches once', async () => {
    await prepareLockedDraw();
    await officialDrawService.execute({
      actorId: ids.actor,
      configurationId: ids.drawA,
      executionId: ids.executionA,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index),
    });
    await expect(
      officialDrawService.confirm({
        actorId: ids.actor,
        executionId: ids.executionA,
        expectedRevision: 1,
        occurredAt,
      }),
    ).rejects.toMatchObject({ code: 'DRAW_CONFIRMATION_INVALID' } satisfies Partial<DomainError>);

    const confirmed = await officialDrawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.executionA,
      expectedRevision: 1,
      occurredAt,
    });
    expect(confirmed.toSnapshot()).toMatchObject({
      confirmedBy: ids.confirmer,
      revision: 2,
      status: 'CONFIRMED',
    });
    expect(await client.drawGroup.count()).toBe(1);
    expect(await client.drawGroupMember.count()).toBe(3);
    expect(await client.logicalMatch.count()).toBe(3);
    await expect(
      officialDrawService.confirm({
        actorId: ids.confirmer,
        executionId: ids.executionA,
        expectedRevision: 1,
        occurredAt,
      }),
    ).rejects.toThrow();
    expect(await client.logicalMatch.count()).toBe(3);
  });

  it('materializes knockout pairings, an explicit bye and only playable matches', async () => {
    await prepareLockedDraw('KNOCKOUT');
    await officialDrawService.execute({
      actorId: ids.actor,
      configurationId: ids.drawA,
      executionId: ids.executionA,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index),
    });
    await officialDrawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.executionA,
      expectedRevision: 1,
      occurredAt,
    });

    expect(await client.drawPairing.count()).toBe(2);
    expect(await client.drawPairing.count({ where: { pairingType: 'BYE' } })).toBe(1);
    expect(await client.logicalMatch.count()).toBe(1);
  });

  it('allows only a superadministrator to annul while retaining audit structures', async () => {
    await prepareLockedDraw();
    await officialDrawService.execute({
      actorId: ids.actor,
      configurationId: ids.drawA,
      executionId: ids.executionA,
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index),
    });
    await officialDrawService.confirm({
      actorId: ids.confirmer,
      executionId: ids.executionA,
      expectedRevision: 1,
      occurredAt,
    });
    const annulled = await officialDrawService.annul({
      actorId: ids.confirmer,
      executionId: ids.executionA,
      expectedRevision: 2,
      occurredAt,
      reason: 'Error formal en el acta',
    });

    expect(annulled.toSnapshot()).toMatchObject({
      annulledBy: ids.confirmer,
      status: 'ANNULLED',
    });
    expect(await client.logicalMatch.count()).toBe(3);
  });

  it('records a pending group result and recalculates standings only after dual confirmation', async () => {
    await prepareConfirmedDraw();
    const match = await client.logicalMatch.findFirstOrThrow({ orderBy: { ordinal: 'asc' } });
    const result = await matchResultService.record({
      actorId: ids.actor,
      correlationId: 'd0000000-0000-4000-8000-000000000001',
      detail: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 },
      idempotencyKey: 'result-record-integration-0001',
      matchId: match.id,
      occurredAt,
      resultId: ids.resultA,
    });
    expect(result.toSnapshot().status).toBe('PENDING_CONFIRMATION');
    const replayed = await matchResultService.record({
      actorId: ids.actor,
      correlationId: 'd0000000-0000-4000-8000-000000000001',
      detail: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 },
      idempotencyKey: 'result-record-integration-0001',
      matchId: match.id,
      occurredAt,
      resultId: 'c0000000-0000-4000-8000-000000000099',
    });
    expect(replayed.toSnapshot().id).toBe(ids.resultA);
    expect(await client.matchResult.count()).toBe(1);
    expect(await client.groupStanding.count()).toBe(0);
    await expect(
      matchResultService.confirm({
        actorId: ids.actor,
        expectedRevision: 1,
        occurredAt,
        resultId: ids.resultA,
      }),
    ).rejects.toMatchObject({ code: 'RESULT_CONFIRMATION_INVALID' } satisfies Partial<DomainError>);

    await matchResultService.confirm({
      actorId: ids.confirmer,
      correlationId: 'd0000000-0000-4000-8000-000000000002',
      expectedRevision: 1,
      idempotencyKey: 'result-confirm-integration-0001',
      occurredAt,
      resultId: ids.resultA,
    });
    await matchResultService.confirm({
      actorId: ids.confirmer,
      correlationId: 'd0000000-0000-4000-8000-000000000002',
      expectedRevision: 1,
      idempotencyKey: 'result-confirm-integration-0001',
      occurredAt,
      resultId: ids.resultA,
    });
    expect(await client.auditEntry.count({ where: { resourceId: ids.resultA } })).toBe(2);
    expect(await client.groupStanding.count()).toBe(3);
    expect(await client.groupStanding.findFirst({ orderBy: { position: 'asc' } })).toMatchObject({
      participantId: match.participantAId,
      played: 1,
      tablePoints: 3,
      wins: 1,
    });
    expect(await client.logicalMatch.findUnique({ where: { id: match.id } })).toMatchObject({
      status: 'RESULT_CONFIRMED',
      winnerParticipantId: match.participantAId,
    });
  });

  it('annuls a confirmed result, clears its winner and recalculates the group from confirmed data', async () => {
    await prepareConfirmedDraw();
    const match = await client.logicalMatch.findFirstOrThrow({ orderBy: { ordinal: 'asc' } });
    await matchResultService.record({
      actorId: ids.actor,
      detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 },
      matchId: match.id,
      occurredAt,
      resultId: ids.resultA,
    });
    await matchResultService.confirm({ actorId: ids.confirmer, expectedRevision: 1, occurredAt, resultId: ids.resultA });
    await matchResultService.annul({
      actorId: ids.confirmer,
      expectedRevision: 2,
      occurredAt,
      reason: 'Error formal de mesa',
      resultId: ids.resultA,
    });

    expect(await client.logicalMatch.findUnique({ where: { id: match.id } })).toMatchObject({
      status: 'PENDING_RESULT',
      winnerParticipantId: null,
    });
    expect(await client.groupStanding.findMany()).toEqual(
      expect.arrayContaining([expect.objectContaining({ played: 0, tablePoints: 0 })]),
    );
  });

  it('creates and independently confirms two qualifiers only when the group is complete', async () => {
    await completeGroup();
    const proposal = await client.groupQualification.findFirstOrThrow({
      include: { sources: true },
    });
    expect(proposal).toMatchObject({
      proposedById: ids.actor,
      status: 'PENDING_CONFIRMATION',
      revision: 1,
    });
    expect(proposal.sources).toHaveLength(3);
    await expect(qualificationService.confirm({
      actorId: ids.actor,
      expectedRevision: 1,
      occurredAt,
      qualificationId: proposal.id,
    })).rejects.toMatchObject({
      code: 'QUALIFICATION_CONFIRMATION_INVALID',
    } satisfies Partial<DomainError>);
    const confirmed = await qualificationService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt,
      qualificationId: proposal.id,
    });
    expect(confirmed.toSnapshot()).toMatchObject({
      confirmedBy: ids.confirmer,
      status: 'CONFIRMED',
      revision: 2,
    });
  });

  it('invalidates a qualification when one of its source results is annulled', async () => {
    const [resultId] = await completeGroup();
    const proposal = await client.groupQualification.findFirstOrThrow();
    await qualificationService.confirm({
      actorId: ids.confirmer,
      expectedRevision: 1,
      occurredAt,
      qualificationId: proposal.id,
    });
    if (resultId === undefined) throw new Error('Expected a result source');
    await matchResultService.annul({
      actorId: ids.confirmer,
      expectedRevision: 2,
      occurredAt,
      reason: 'Corrección oficial',
      resultId,
    });
    expect(await client.groupQualification.findUnique({ where: { id: proposal.id } })).toMatchObject({
      invalidatedById: ids.confirmer,
      status: 'INVALIDATED',
      revision: 3,
    });
  });

  it('requires a winner in knockout and persists the confirmed winner', async () => {
    await prepareConfirmedDraw('KNOCKOUT');
    const match = await client.logicalMatch.findFirstOrThrow();
    await expect(
      matchResultService.record({
        actorId: ids.actor,
        detail: { profile: 'SCORE_BASED', scoreA: 1, scoreB: 1 },
        matchId: match.id,
        occurredAt,
        resultId: ids.resultA,
      }),
    ).rejects.toMatchObject({ code: 'RESULT_DETAIL_INVALID' } satisfies Partial<DomainError>);
    await matchResultService.record({
      actorId: ids.actor,
      detail: { profile: 'SCORE_BASED', scoreA: 1, scoreB: 2 },
      matchId: match.id,
      occurredAt,
      resultId: ids.resultA,
    });
    await matchResultService.confirm({ actorId: ids.confirmer, expectedRevision: 1, occurredAt, resultId: ids.resultA });
    expect(await client.logicalMatch.findUnique({ where: { id: match.id } })).toMatchObject({
      status: 'RESULT_CONFIRMED',
      winnerParticipantId: match.participantBId,
    });
    expect(await client.groupStanding.count()).toBe(0);
  });
});
