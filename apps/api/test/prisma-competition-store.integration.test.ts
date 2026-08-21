import { createPrismaClient, PrismaCompetitionRepository } from '@oes/database';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { CompetitionStoreError } from '../src/competitions/competition-store.js';
import { PrismaCompetitionStore } from '../src/competitions/prisma-competition-store.js';
import type { DrawStoreError } from '../src/draws/draw-store.js';
import { PrismaDrawStore } from '../src/draws/prisma-draw-store.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://oes:oes@localhost:5432/oes?schema=public';
const integration = process.env.DATABASE_URL === undefined ? describe.skip : describe;
const client = createPrismaClient(databaseUrl);
const store = new PrismaCompetitionStore(client);
const repository = new PrismaCompetitionRepository(client);
const drawStore = new PrismaDrawStore(client);

const ids = {
  actor: '10000000-0000-4000-8000-000000000091',
  confirmer: '10000000-0000-4000-8000-000000000092',
  edition: '30000000-0000-4000-8000-000000000091',
  event: '40000000-0000-4000-8000-000000000091',
  institutionA: '70000000-0000-4000-8000-000000000091',
  institutionB: '70000000-0000-4000-8000-000000000092',
  institutionC: '70000000-0000-4000-8000-000000000093',
  modality: '60000000-0000-4000-8000-000000000091',
  sport: '80000000-0000-4000-8000-000000000091',
};

async function seed(): Promise<void> {
  await client.user.createMany({
    data: [
      { displayName: 'Administrador de integración', emailNormalized: 'competition-store@example.test', id: ids.actor, passwordHash: 'not-a-real-password-hash', role: 'ADMIN', status: 'ACTIVE' },
      { displayName: 'Confirmador de integración', emailNormalized: 'competition-confirmer@example.test', id: ids.confirmer, passwordHash: 'not-a-real-password-hash', role: 'ADMIN', status: 'ACTIVE' },
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
  await client.event.create({ data: { code: 'COLEGIALES', id: ids.event, name: 'Colegiales' } });
  await client.sport.create({ data: { code: 'FUTSAL', id: ids.sport, name: 'Futsal' } });
  await client.modality.create({ data: { code: 'MALE', id: ids.modality, name: 'Masculina' } });
  await client.eventSportModality.create({
    data: { eventId: ids.event, modalityId: ids.modality, sportId: ids.sport },
  });
  await client.institution.createMany({
    data: [
      { code: 'CA', createdById: ids.actor, eventId: ids.event, id: ids.institutionA, name: 'Colegio A', normalizedName: 'colegio a', updatedById: ids.actor },
      { code: 'CB', createdById: ids.actor, eventId: ids.event, id: ids.institutionB, name: 'Colegio B', normalizedName: 'colegio b', updatedById: ids.actor },
      { code: 'CC', createdById: ids.actor, eventId: ids.event, id: ids.institutionC, name: 'Colegio C', normalizedName: 'colegio c', updatedById: ids.actor },
    ],
  });
}

beforeEach(async () => {
  if (process.env.DATABASE_URL === undefined) return;
  await client.$executeRawUnsafe('TRUNCATE TABLE "users", "events", "sports", "modalities" RESTART IDENTITY CASCADE');
  await seed();
});

afterAll(async () => client.$disconnect());

integration('PrismaCompetitionStore', () => {
  it('persists one audited competition and replays the same idempotent response', async () => {
    const input = {
      actorId: ids.actor,
      actorRole: 'ADMIN' as const,
      correlationId: '90000000-0000-4000-8000-000000000091',
      editionId: ids.edition,
      eventId: ids.event,
      idempotencyKey: 'integration-competition-0001',
      modalityId: ids.modality,
      sportId: ids.sport,
    };
    const first = await store.create(input);
    const replay = await store.create(input);
    expect(replay).toEqual(first);
    await expect(store.create({ ...input, sportId: '80000000-0000-4000-8000-000000000099' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    } satisfies Partial<CompetitionStoreError>);
    expect(await client.competition.count()).toBe(1);
    expect(await client.auditEntry.count()).toBe(1);
    expect(await client.idempotencyRecord.count()).toBe(1);
  });

  it('rehydrates store-written aggregate state through the shared competition repository', async () => {
    const created = await store.create({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      correlationId: '90500000-0000-4000-8000-000000000001',
      editionId: ids.edition,
      eventId: ids.event,
      idempotencyKey: 'equivalence-create-0001',
      modalityId: ids.modality,
      sportId: ids.sport,
    });

    let revision = created.revision;
    for (const [index, institutionId] of [ids.institutionA, ids.institutionB, ids.institutionC].entries()) {
      const updated = await store.addParticipant({
        actorId: ids.actor,
        actorRole: 'ADMIN',
        competitionId: created.id,
        correlationId: `90500000-0000-4000-8000-00000000000${String(index + 2)}`,
        expectedRevision: revision,
        idempotencyKey: `equivalence-participant-000${String(index + 1)}`,
        institutionId,
      });
      revision = updated.revision;
    }

    const detail = await store.configureFormat({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: created.id,
      correlationId: '90500000-0000-4000-8000-000000000005',
      expectedRevision: revision,
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      idempotencyKey: 'equivalence-format-0001',
    });

    const aggregate = await repository.findById(created.id);
    expect(aggregate).not.toBeNull();
    const snapshot = aggregate?.toSnapshot();
    expect(snapshot).toMatchObject({
      formatCode: detail.formatCode,
      groupCount: detail.groupCount,
      id: detail.id,
      key: {
        editionId: detail.edition.id,
        eventId: detail.event.id,
        modalityId: detail.modality.id,
        sportId: detail.sport.id,
      },
      revision: detail.revision,
      status: detail.status,
    });

    const persistedParticipants = [...(snapshot?.participants ?? [])]
      .map(({ displayName, institutionId, status }) => ({ displayName, institutionId, status }))
      .sort((left, right) => left.institutionId.localeCompare(right.institutionId));
    const projectedParticipants = [...detail.participants]
      .map(({ displayName, institutionId, status }) => ({ displayName, institutionId, status }))
      .sort((left, right) => left.institutionId.localeCompare(right.institutionId));
    expect(persistedParticipants).toEqual(projectedParticipants);
  });

  it('persists participant loading and a validated group-stage setup', async () => {
    const created = await store.create({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      correlationId: '90000000-0000-4000-8000-000000000092',
      editionId: ids.edition,
      eventId: ids.event,
      idempotencyKey: 'integration-setup-create-0001',
      modalityId: ids.modality,
      sportId: ids.sport,
    });
    let revision = created.revision;
    for (const [index, institutionId] of [ids.institutionA, ids.institutionB, ids.institutionC].entries()) {
      const response = await store.addParticipant({
        actorId: ids.actor,
        actorRole: 'ADMIN',
        competitionId: created.id,
        correlationId: `90000000-0000-4000-8000-00000000009${String(index + 3)}`,
        expectedRevision: revision,
        idempotencyKey: `integration-participant-000${String(index + 1)}`,
        institutionId,
      });
      revision = response.revision;
    }
    const configured = await store.configureFormat({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: created.id,
      correlationId: '90000000-0000-4000-8000-000000000096',
      expectedRevision: revision,
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      idempotencyKey: 'integration-format-0001',
    });

    expect(configured).toMatchObject({ formatCode: 'GROUP_STAGE', groupCount: 1, participantCount: 3, revision: 5 });
    expect(configured.participants.map(({ displayName }) => displayName)).toEqual(['Colegio A', 'Colegio B', 'Colegio C']);
    expect(configured.validGroupCounts).toEqual([1]);
    expect(await client.auditEntry.count()).toBe(5);
    expect(await client.idempotencyRecord.count()).toBe(5);
  });

  it('persists, replays and irreversibly freezes a scoring template', async () => {
    const created = await store.create({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      correlationId: '90000000-0000-4000-8000-000000000097',
      editionId: ids.edition,
      eventId: ids.event,
      idempotencyKey: 'integration-rules-create-0001',
      modalityId: ids.modality,
      sportId: ids.sport,
    });
    const saveInput = {
      actorId: ids.actor,
      actorRole: 'ADMIN' as const,
      allowDraws: true,
      competitionId: created.id,
      correlationId: '90000000-0000-4000-8000-000000000098',
      drawPoints: 1,
      expectedRevision: null,
      idempotencyKey: 'integration-rules-save-0001',
      lossPoints: 0,
      resultProfile: 'SCORE_BASED' as const,
      tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'] as const,
      winPoints: 3,
    };
    const saved = await store.saveRuleSet(saveInput);
    const replay = await store.saveRuleSet(saveInput);
    expect(replay).toEqual(saved);
    expect(saved.ruleSet).toMatchObject({ canonicalHash: null, revision: 1, status: 'DRAFT' });

    const frozen = await store.freezeRuleSet({
      actorId: ids.actor,
      actorRole: 'ADMIN',
      competitionId: created.id,
      correlationId: '90000000-0000-4000-8000-000000000099',
      expectedRevision: 1,
      idempotencyKey: 'integration-rules-freeze-0001',
    });
    expect(frozen.ruleSet).toMatchObject({ revision: 2, status: 'FROZEN' });
    expect(frozen.ruleSet?.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(store.saveRuleSet({
      ...saveInput,
      correlationId: '90000000-0000-4000-8000-000000000100',
      expectedRevision: 2,
      idempotencyKey: 'integration-rules-save-0002',
    })).rejects.toMatchObject({ code: 'RULE_SET_INVALID' } satisfies Partial<CompetitionStoreError>);
    expect(await client.competitionRuleSet.count()).toBe(1);
    expect(await client.auditEntry.count()).toBe(3);
    expect(await client.idempotencyRecord.count()).toBe(3);
  });

  it('locks, executes and confirms a group draw while creating every match exactly once', async () => {
    const created = await store.create({ actorId: ids.actor, actorRole: 'ADMIN', correlationId: '91000000-0000-4000-8000-000000000001', editionId: ids.edition, eventId: ids.event, idempotencyKey: 'draw-flow-create-0001', modalityId: ids.modality, sportId: ids.sport });
    let revision = created.revision;
    for (const [index, institutionId] of [ids.institutionA, ids.institutionB, ids.institutionC].entries()) {
      const updated = await store.addParticipant({ actorId: ids.actor, actorRole: 'ADMIN', competitionId: created.id, correlationId: `91000000-0000-4000-8000-00000000000${String(index + 2)}`, expectedRevision: revision, idempotencyKey: `draw-flow-participant-000${String(index + 1)}`, institutionId });
      revision = updated.revision;
    }
    const formatted = await store.configureFormat({ actorId: ids.actor, actorRole: 'ADMIN', competitionId: created.id, correlationId: '91000000-0000-4000-8000-000000000005', expectedRevision: revision, formatCode: 'GROUP_STAGE', groupCount: 1, idempotencyKey: 'draw-flow-format-0001' });
    const rules = await store.saveRuleSet({ actorId: ids.actor, actorRole: 'ADMIN', allowDraws: true, competitionId: created.id, correlationId: '91000000-0000-4000-8000-000000000006', drawPoints: 1, expectedRevision: null, idempotencyKey: 'draw-flow-rules-0001', lossPoints: 0, resultProfile: 'SCORE_BASED', tieBreakCriteria: ['TABLE_POINTS', 'WINS'], winPoints: 3 });
    await store.freezeRuleSet({ actorId: ids.actor, actorRole: 'ADMIN', competitionId: created.id, correlationId: '91000000-0000-4000-8000-000000000007', expectedRevision: rules.ruleSet?.revision ?? 0, idempotencyKey: 'draw-flow-rules-freeze-0001' });

    const prepared = await drawStore.prepare({ actorId: ids.actor, actorRole: 'ADMIN', competitionId: created.id, correlationId: '91000000-0000-4000-8000-000000000008', expectedRevision: formatted.revision, idempotencyKey: 'draw-flow-prepare-0001' });
    expect(prepared).toMatchObject({ competitionStatus: 'LOCKED', configuration: { participantCount: 3, status: 'FROZEN' } });
    const executed = await drawStore.execute({ actorId: ids.actor, actorRole: 'ADMIN', configurationId: prepared.configuration?.id ?? '', correlationId: '91000000-0000-4000-8000-000000000009', expectedRevision: 2, idempotencyKey: 'draw-flow-execute-0001' });
    expect(executed.execution).toMatchObject({ seedHex: null, status: 'PENDING_CONFIRMATION' });
    await expect(drawStore.confirm({ actorId: ids.actor, actorRole: 'ADMIN', correlationId: '91000000-0000-4000-8000-000000000010', executionId: executed.execution?.id ?? '', expectedRevision: 1, idempotencyKey: 'draw-flow-confirm-invalid-0001' })).rejects.toMatchObject({ code: 'DRAW_CONFIRMATION_INVALID' } satisfies Partial<DrawStoreError>);
    const confirmed = await drawStore.confirm({ actorId: ids.confirmer, actorRole: 'ADMIN', correlationId: '91000000-0000-4000-8000-000000000011', executionId: executed.execution?.id ?? '', expectedRevision: 1, idempotencyKey: 'draw-flow-confirm-0001' });
    expect(confirmed.execution).toMatchObject({ matchCount: 3, status: 'CONFIRMED' });
    expect(confirmed.execution?.seedHex).toMatch(/^[a-f0-9]{64}$/);
    expect(await client.logicalMatch.count()).toBe(3);
    expect(await client.drawGroupMember.count()).toBe(3);
  });
});