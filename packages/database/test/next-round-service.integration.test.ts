import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPrismaClient, PrismaNextRoundService } from '../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const service = new PrismaNextRoundService(client);
const occurredAt = new Date('2026-08-19T16:00:00.000Z');
const hash = 'a'.repeat(64);

const ids = {
  actor: '11000000-0000-4000-8000-000000000001',
  confirmer: '11000000-0000-4000-8000-000000000002',
  competition: '21000000-0000-4000-8000-000000000001',
  edition: '31000000-0000-4000-8000-000000000001',
  event: '41000000-0000-4000-8000-000000000001',
  sport: '51000000-0000-4000-8000-000000000001',
  modality: '61000000-0000-4000-8000-000000000001',
  institutionA: '71000000-0000-4000-8000-000000000001',
  institutionB: '71000000-0000-4000-8000-000000000002',
  institutionC: '71000000-0000-4000-8000-000000000003',
  participantA: '81000000-0000-4000-8000-000000000001',
  participantB: '81000000-0000-4000-8000-000000000002',
  participantC: '81000000-0000-4000-8000-000000000003',
  ruleSet: '91000000-0000-4000-8000-000000000001',
  configuration: 'a1000000-0000-4000-8000-000000000001',
  execution: 'b1000000-0000-4000-8000-000000000001',
  group: 'c1000000-0000-4000-8000-000000000001',
  qualification: 'd1000000-0000-4000-8000-000000000001',
  correlation: 'e1000000-0000-4000-8000-000000000001',
} as const;

async function clean(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
}

async function seedConfirmedGroup(): Promise<void> {
  await client.user.createMany({
    data: [
      { displayName: 'Administrador Uno', emailNormalized: 'next-admin@example.test', id: ids.actor, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
      { displayName: 'Administrador Dos', emailNormalized: 'next-confirmer@example.test', id: ids.confirmer, passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' },
    ],
  });
  await client.edition.create({ data: { createdById: ids.actor, id: ids.edition, name: 'OES 2026', status: 'OPEN', updatedById: ids.actor, year: 2026 } });
  await client.event.create({ data: { code: 'COLEGIALES_NEXT', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'FUTSAL_NEXT', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'MALE_NEXT', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({ data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport } });
  await client.institution.createMany({
    data: [
      { code: 'NEXT-A', createdById: ids.actor, eventId: ids.event, id: ids.institutionA, name: 'Colegio A', normalizedName: 'colegio a', updatedById: ids.actor },
      { code: 'NEXT-B', createdById: ids.actor, eventId: ids.event, id: ids.institutionB, name: 'Colegio B', normalizedName: 'colegio b', updatedById: ids.actor },
      { code: 'NEXT-C', createdById: ids.actor, eventId: ids.event, id: ids.institutionC, name: 'Colegio C', normalizedName: 'colegio c', updatedById: ids.actor },
    ],
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
    data: [
      { competitionId: ids.competition, displayName: 'Colegio A', enabledAt: occurredAt, enabledById: ids.actor, eventId: ids.event, id: ids.participantA, institutionId: ids.institutionA },
      { competitionId: ids.competition, displayName: 'Colegio B', enabledAt: occurredAt, enabledById: ids.actor, eventId: ids.event, id: ids.participantB, institutionId: ids.institutionB },
      { competitionId: ids.competition, displayName: 'Colegio C', enabledAt: occurredAt, enabledById: ids.actor, eventId: ids.event, id: ids.participantC, institutionId: ids.institutionC },
    ],
  });
  await client.competitionRuleSet.create({
    data: {
      canonicalHash: hash,
      competitionId: ids.competition,
      createdById: ids.actor,
      frozenAt: occurredAt,
      frozenById: ids.actor,
      id: ids.ruleSet,
      knockoutResolutionCode: 'HIGHER_SCORE',
      profileConfig: { allowDraws: false, profile: 'SCORE_BASED' },
      resultProfile: 'SCORE_BASED',
      revisionNumber: 1,
      schemaVersion: 1,
      status: 'FROZEN',
      updatedById: ids.actor,
    },
  });
  await client.drawConfiguration.create({
    data: {
      canonicalHash: hash,
      competitionId: ids.competition,
      createdById: ids.actor,
      formatCode: 'GROUP_STAGE',
      frozenAt: occurredAt,
      frozenById: ids.actor,
      groupCount: 1,
      id: ids.configuration,
      participantCount: 3,
      revision: 2,
      roundNumber: 0,
      ruleSetId: ids.ruleSet,
      status: 'FROZEN',
      updatedById: ids.actor,
    },
  });
  await client.officialDraw.create({
    data: {
      algorithmVersion: 'oes-draw-v1',
      competitionId: ids.competition,
      configurationId: ids.configuration,
      confirmedAt: occurredAt,
      confirmedById: ids.confirmer,
      evidenceHash: hash,
      evidenceJson: { result: { formatCode: 'GROUP_STAGE', groups: [] } },
      executedAt: occurredAt,
      executedById: ids.actor,
      id: ids.execution,
      resultHash: hash,
      revision: 2,
      seedCommitment: hash,
      seedHex: hash,
      status: 'CONFIRMED',
    },
  });
  await client.drawGroup.create({ data: { competitionId: ids.competition, executionId: ids.execution, id: ids.group, label: 'A', ordinal: 1 } });
  await client.groupQualification.create({
    data: {
      competitionId: ids.competition,
      confirmedAt: occurredAt,
      confirmedById: ids.confirmer,
      firstParticipantId: ids.participantA,
      groupId: ids.group,
      id: ids.qualification,
      proposedAt: occurredAt,
      proposedById: ids.actor,
      revision: 2,
      secondParticipantId: ids.participantB,
      sourceRuleSetId: ids.ruleSet,
      status: 'CONFIRMED',
    },
  });
}

integration('PrismaNextRoundService', () => {
  beforeEach(async () => {
    await clean();
    await seedConfirmedGroup();
  });

  afterAll(async () => {
    await clean();
    await client.$disconnect();
  });

  it('freezes round one only from the confirmed group qualifiers', async () => {
    const prepared = await service.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: ids.correlation,
      expectedCompetitionRevision: 6,
      occurredAt: new Date('2026-08-19T16:10:00.000Z'),
    });

    expect(prepared.competitionRevision).toBe(7);
    expect(prepared.configuration).toMatchObject({
      competitionId: ids.competition,
      formatCode: 'KNOCKOUT',
      groupCount: null,
      participantCount: 2,
      roundNumber: 1,
      ruleSetId: ids.ruleSet,
      status: 'FROZEN',
    });
    expect(prepared.configuration.participants.map(({ id }) => id)).toEqual([ids.participantA, ids.participantB]);
    expect(await client.competition.findUnique({ where: { id: ids.competition } })).toMatchObject({ revision: 7, status: 'LOCKED' });
    expect(await client.auditEntry.findFirst({ where: { actionCode: 'NEXT_ROUND_CONFIGURATION_FROZEN', competitionId: ids.competition } })).toMatchObject({
      actorId: ids.actor,
      resourceId: prepared.configuration.id,
    });
    expect(await client.drawConfiguration.count({ where: { competitionId: ids.competition, formatCode: 'KNOCKOUT', roundNumber: 1, status: 'FROZEN' } })).toBe(1);
  });

  it('does not create the round while qualification is pending', async () => {
    await client.groupQualification.update({
      data: { confirmedAt: null, confirmedById: null, revision: 1, status: 'PENDING_CONFIRMATION' },
      where: { id: ids.qualification },
    });

    await expect(service.prepare({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: ids.competition,
      correlationId: ids.correlation,
      expectedCompetitionRevision: 6,
      occurredAt: new Date('2026-08-19T16:10:00.000Z'),
    })).rejects.toMatchObject({ code: 'DRAW_CONFIGURATION_INCOMPATIBLE' });
    expect(await client.drawConfiguration.count({ where: { competitionId: ids.competition, formatCode: 'KNOCKOUT' } })).toBe(0);
    expect(await client.competition.findUnique({ where: { id: ids.competition } })).toMatchObject({ revision: 6 });
  });
});
