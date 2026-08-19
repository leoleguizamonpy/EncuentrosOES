import { CompetitionRuleSet, DrawConfiguration } from '@oes/domain';
import { afterAll, describe, expect, it } from 'vitest';

import {
  createPrismaClient,
  PrismaChampionFinalizationService,
  PrismaCompetitionRepository,
  PrismaCompetitionRuleSetRepository,
  PrismaDrawConfigurationRepository,
  PrismaMatchResultService,
  PrismaNextRoundService,
  PrismaOfficialDrawService,
} from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const occurredAt = new Date('2026-08-19T21:00:00.000Z');
const hash = 'a'.repeat(64);

const ids = {
  actor: '15000000-0000-4000-8000-000000000001',
  confirmer: '15000000-0000-4000-8000-000000000002',
  competition: '25000000-0000-4000-8000-000000000001',
  edition: '35000000-0000-4000-8000-000000000001',
  event: '45000000-0000-4000-8000-000000000001',
  sport: '55000000-0000-4000-8000-000000000001',
  modality: '65000000-0000-4000-8000-000000000001',
  institutions: [
    '75000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000002',
  ],
  participants: [
    '85000000-0000-4000-8000-000000000001',
    '85000000-0000-4000-8000-000000000002',
  ],
  ruleSet: '95000000-0000-4000-8000-000000000001',
  groupConfiguration: 'a5000000-0000-4000-8000-000000000001',
  groupExecution: 'b5000000-0000-4000-8000-000000000001',
  group: 'c5000000-0000-4000-8000-000000000001',
  qualification: 'd5000000-0000-4000-8000-000000000001',
  nextRoundCorrelation: 'e5000000-0000-4000-8000-000000000001',
  finalExecution: 'b5000000-0000-4000-8000-000000000002',
  finalResult: 'f5000000-0000-4000-8000-000000000001',
  championProposalCorrelation: 'e5000000-0000-4000-8000-000000000002',
  championConfirmCorrelation: 'e5000000-0000-4000-8000-000000000003',
} as const;

async function clean(): Promise<void> {
  const cleanup = createPrismaClient(databaseUrl);
  try {
    await cleanup.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE',
    );
  } finally {
    await cleanup.$disconnect();
  }
}

async function seedBeforeRestart(): Promise<{ configurationId: string }> {
  const client = createPrismaClient(databaseUrl);
  try {
    await client.user.createMany({
      data: [
        {
          displayName: 'Administrador Uno',
          emailNormalized: 'restart-admin@example.test',
          id: ids.actor,
          passwordHash: 'hash',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        {
          displayName: 'Administrador Dos',
          emailNormalized: 'restart-confirmer@example.test',
          id: ids.confirmer,
          passwordHash: 'hash',
          role: 'ADMIN',
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
    await client.event.create({ data: { code: 'RESTART_EVENT', id: ids.event, name: 'Colegiales' } });
    await client.sport.create({ data: { code: 'RESTART_FUTSAL', id: ids.sport, name: 'Futsal' } });
    await client.modality.create({ data: { code: 'RESTART_MALE', id: ids.modality, name: 'Masculina' } });
    await client.eventSportModality.create({
      data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
    });
    await client.institution.createMany({
      data: ids.institutions.map((id, index) => ({
        code: `RESTART-${String(index + 1)}`,
        createdById: ids.actor,
        eventId: ids.event,
        id,
        name: `Colegio ${String(index + 1)}`,
        normalizedName: `colegio ${String(index + 1)}`,
        updatedById: ids.actor,
      })),
    });
    await client.competition.create({
      data: {
        createdById: ids.actor,
        editionId: ids.edition,
        eventId: ids.event,
        formatCode: 'GROUP_STAGE',
        groupCount: 1,
        id: ids.competition,
        lockedAt: occurredAt,
        lockedById: ids.actor,
        modalityId: ids.modality,
        revision: 6,
        sportId: ids.sport,
        status: 'LOCKED',
        updatedById: ids.actor,
      },
    });
    await client.competitionParticipant.createMany({
      data: ids.participants.map((id, index) => ({
        competitionId: ids.competition,
        displayName: `Colegio ${String(index + 1)}`,
        enabledAt: occurredAt,
        enabledById: ids.actor,
        eventId: ids.event,
        id,
        institutionId: ids.institutions[index] ?? ids.institutions[0],
      })),
    });

    const ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
    const rules = CompetitionRuleSet.create({
      actorId: ids.actor,
      competitionId: ids.competition,
      id: ids.ruleSet,
      knockoutResolutionCode: 'HIGHER_SCORE',
      metrics: ['PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SCORE_DIFFERENCE'],
      occurredAt,
      outcomes: [
        { code: 'WIN', description: 'Victoria', tablePoints: 3 },
        { code: 'LOSS', description: 'Derrota', tablePoints: 0 },
      ],
      profileConfig: { allowDraws: false, profile: 'SCORE_BASED' },
      resultProfile: 'SCORE_BASED',
      revisionNumber: 1,
      schemaVersion: 1,
      tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'],
    });
    rules.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await ruleSetRepository.insert(rules);

    const drawRepository = new PrismaDrawConfigurationRepository(client);
    const groupConfiguration = DrawConfiguration.create({
      actorId: ids.actor,
      competitionId: ids.competition,
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      id: ids.groupConfiguration,
      occurredAt,
      participants: ids.participants.map((id, index) => ({
        byeCount: 0,
        displayName: `Colegio ${String(index + 1)}`,
        id,
      })),
      roundNumber: 0,
      ruleSetId: ids.ruleSet,
    });
    groupConfiguration.freeze({ actorId: ids.actor, expectedRevision: 1, occurredAt });
    await drawRepository.insert(groupConfiguration);

    await client.officialDraw.create({
      data: {
        algorithmVersion: 'oes-draw-v1',
        competitionId: ids.competition,
        configurationId: ids.groupConfiguration,
        confirmedAt: occurredAt,
        confirmedById: ids.confirmer,
        evidenceHash: hash,
        evidenceJson: { result: { formatCode: 'GROUP_STAGE', groups: [] } },
        executedAt: occurredAt,
        executedById: ids.actor,
        id: ids.groupExecution,
        resultHash: hash,
        revision: 2,
        seedCommitment: hash,
        seedHex: hash,
        status: 'CONFIRMED',
      },
    });
    await client.drawGroup.create({
      data: {
        competitionId: ids.competition,
        executionId: ids.groupExecution,
        id: ids.group,
        label: 'A',
        ordinal: 1,
      },
    });
    await client.groupQualification.create({
      data: {
        competitionId: ids.competition,
        confirmedAt: occurredAt,
        confirmedById: ids.confirmer,
        firstParticipantId: ids.participants[0],
        groupId: ids.group,
        id: ids.qualification,
        proposedAt: occurredAt,
        proposedById: ids.actor,
        revision: 2,
        secondParticipantId: ids.participants[1],
        sourceRuleSetId: ids.ruleSet,
        status: 'CONFIRMED',
      },
    });

    const firstProcessNextRound = new PrismaNextRoundService(client);
    const prepared = await firstProcessNextRound.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: ids.nextRoundCorrelation,
      expectedCompetitionRevision: 6,
      occurredAt: new Date(occurredAt.getTime() + 60_000),
    });
    return { configurationId: prepared.configuration.id };
  } finally {
    await client.$disconnect();
  }
}

integration('restart recovery', () => {
  afterAll(async () => {
    await clean();
  });

  it('continues to a finalized champion using only a fresh process and persisted PostgreSQL state', async () => {
    await clean();
    const { configurationId } = await seedBeforeRestart();

    const restartedClient = createPrismaClient(databaseUrl);
    try {
      const competitionRepository = new PrismaCompetitionRepository(restartedClient);
      const drawRepository = new PrismaDrawConfigurationRepository(restartedClient);
      const drawService = new PrismaOfficialDrawService(restartedClient);
      const resultService = new PrismaMatchResultService(restartedClient);
      const championService = new PrismaChampionFinalizationService(restartedClient);

      const restoredCompetition = await competitionRepository.findById(ids.competition);
      expect(restoredCompetition?.toSnapshot()).toMatchObject({ revision: 7, status: 'LOCKED' });

      const restoredFinalConfiguration = await drawRepository.findById(configurationId);
      expect(restoredFinalConfiguration?.toSnapshot()).toMatchObject({
        competitionId: ids.competition,
        formatCode: 'KNOCKOUT',
        participantCount: 2,
        roundNumber: 1,
        status: 'FROZEN',
      });
      expect(restoredFinalConfiguration?.toSnapshot().participants.map(({ id }) => id).sort()).toEqual(
        [...ids.participants].sort(),
      );

      await drawService.execute({
        actorId: ids.actor,
        configurationId,
        executionId: ids.finalExecution,
        occurredAt: new Date(occurredAt.getTime() + 2 * 60_000),
        seed: Uint8Array.from({ length: 32 }, (_, index) => index),
      });
      await drawService.confirm({
        actorId: ids.confirmer,
        executionId: ids.finalExecution,
        expectedRevision: 1,
        occurredAt: new Date(occurredAt.getTime() + 3 * 60_000),
      });

      const finalMatch = await restartedClient.logicalMatch.findFirstOrThrow({
        where: { executionId: ids.finalExecution },
      });
      await resultService.record({
        actorId: ids.actor,
        detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 },
        matchId: finalMatch.id,
        occurredAt: new Date(occurredAt.getTime() + 4 * 60_000),
        resultId: ids.finalResult,
      });
      await resultService.confirm({
        actorId: ids.confirmer,
        expectedRevision: 1,
        occurredAt: new Date(occurredAt.getTime() + 5 * 60_000),
        resultId: ids.finalResult,
      });

      const proposal = await championService.propose({
        actorId: ids.actor,
        actorRole: 'ADMIN',
        competitionId: ids.competition,
        correlationId: ids.championProposalCorrelation,
        expectedCompetitionRevision: 7,
        occurredAt: new Date(occurredAt.getTime() + 6 * 60_000),
      });
      const champion = await championService.confirm({
        actorId: ids.confirmer,
        actorRole: 'ADMIN',
        competitionId: ids.competition,
        correlationId: ids.championConfirmCorrelation,
        expectedCompetitionRevision: 8,
        occurredAt: new Date(occurredAt.getTime() + 7 * 60_000),
        proposalId: proposal.proposalId,
      });

      expect(champion).toMatchObject({
        competitionRevision: 9,
        participantId: finalMatch.participantAId,
        status: 'CONFIRMED',
      });
      expect((await competitionRepository.findById(ids.competition))?.toSnapshot()).toMatchObject({
        finalizedBy: ids.confirmer,
        revision: 9,
        status: 'FINALIZED',
      });
      expect(await championService.find(ids.competition)).toMatchObject({
        participantId: finalMatch.participantAId,
        sourceExecutionId: ids.finalExecution,
        sourceMatchId: finalMatch.id,
        sourceResultId: ids.finalResult,
        status: 'CONFIRMED',
      });
    } finally {
      await restartedClient.$disconnect();
    }
  });
});
