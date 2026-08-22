import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PrismaCompetitionRepository, type Prisma, type PrismaClient } from '@oes/database';
import {
  Competition,
  CompetitionRuleSet,
  DomainError,
  type CompetitionRuleSetSnapshot,
  type MetricCode,
  type TieBreakCriterion,
} from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  CompetitionStoreError,
  type AddStoredParticipantInput,
  type CompetitionCatalog,
  type CompetitionDetail,
  type CompetitionStore,
  type CompetitionSummary,
  type ConfigureStoredFormatInput,
  type CreateStoredCompetitionInput,
  type FreezeStoredRuleSetInput,
  type SaveStoredRuleSetInput,
  type ScoreTieBreakCriterion,
  type SetTieBreakCriterion,
} from './competition-store.js';

const IDEMPOTENCY_SCOPE = 'competition:create';
const PARTICIPANT_SCOPE = 'competition:participant:add';
const FORMAT_SCOPE = 'competition:format:configure';
const RULE_SET_SAVE_SCOPE = 'competition:rules:save';
const RULE_SET_FREEZE_SCOPE = 'competition:rules:freeze';

type StoredMutationInput =
  | AddStoredParticipantInput
  | ConfigureStoredFormatInput
  | FreezeStoredRuleSetInput
  | SaveStoredRuleSetInput;

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requestDigest(input: CreateStoredCompetitionInput): string {
  return digest(JSON.stringify({
    editionId: input.editionId,
    eventId: input.eventId,
    modalityId: input.modalityId,
    sportId: input.sportId,
  }));
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function parseReplay(value: unknown): CompetitionSummary {
  if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string') {
    throw new CompetitionStoreError(
      'IDEMPOTENCY_CONFLICT',
      'The stored idempotent response is not valid.',
    );
  }
  return value as CompetitionSummary;
}

function parseDetailReplay(value: unknown): CompetitionDetail {
  return parseReplay(value) as CompetitionDetail;
}

function mutationDigest(input: StoredMutationInput): string {
  return digest(JSON.stringify({
    competitionId: input.competitionId,
    expectedRevision: input.expectedRevision,
    ...('institutionId' in input
      ? { institutionId: input.institutionId }
      : 'formatCode' in input
        ? { formatCode: input.formatCode, groupCount: input.groupCount }
        : 'resultProfile' in input
          ? input.resultProfile === 'SCORE_BASED'
            ? { allowDraws: input.allowDraws, drawPoints: input.drawPoints, lossPoints: input.lossPoints, resultProfile: input.resultProfile, tieBreakCriteria: input.tieBreakCriteria, winPoints: input.winPoints }
            : { lossPoints: input.lossPoints, resultProfile: input.resultProfile, setsToWin: input.setsToWin, tieBreakCriteria: input.tieBreakCriteria, winPoints: input.winPoints }
          : { action: 'freeze' }),
  }));
}

function storeError(error: DomainError): CompetitionStoreError {
  const code = error.code === 'CONCURRENCY_CONFLICT'
    ? 'CONCURRENCY_CONFLICT'
    : error.code === 'DUPLICATE_PARTICIPANT'
      ? 'DUPLICATE_PARTICIPANT'
      : error.code === 'COMPETITION_NOT_EDITABLE'
        ? 'COMPETITION_NOT_EDITABLE'
        : 'FORMAT_CONFIGURATION_INVALID';
  return new CompetitionStoreError(code, error.message);
}

function ruleSetStoreError(error: DomainError): CompetitionStoreError {
  return new CompetitionStoreError(
    error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : 'RULE_SET_INVALID',
    error.message,
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configuredMetrics(input: SaveStoredRuleSetInput): readonly MetricCode[] {
  if (input.resultProfile === 'SCORE_BASED') {
    return [
      'PLAYED', 'WINS', ...(input.allowDraws ? ['DRAWS' as const] : []), 'LOSSES',
      'TABLE_POINTS', 'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE',
    ];
  }
  return [
    'PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SETS_WON', 'SETS_LOST',
    'SET_DIFFERENCE', 'SPORT_POINTS_FOR', 'SPORT_POINTS_AGAINST',
    'SPORT_POINT_DIFFERENCE',
  ];
}

function createRuleSet(input: SaveStoredRuleSetInput, id: string, occurredAt: Date): CompetitionRuleSet {
  const common = {
    actorId: input.actorId,
    competitionId: input.competitionId,
    id,
    metrics: configuredMetrics(input),
    occurredAt,
    revisionNumber: 1,
    schemaVersion: 1,
    tieBreakCriteria: input.tieBreakCriteria as readonly TieBreakCriterion[],
  };
  if (input.resultProfile === 'SCORE_BASED') {
    const outcomes = [
      { code: 'WIN', description: 'Victoria', tablePoints: input.winPoints },
      { code: 'LOSS', description: 'Derrota', tablePoints: input.lossPoints },
    ];
    if (input.allowDraws) {
      if (input.drawPoints === null) {
        throw new CompetitionStoreError('RULE_SET_INVALID', 'Draw points are required when draws are allowed.');
      }
      outcomes.splice(1, 0, { code: 'DRAW', description: 'Empate', tablePoints: input.drawPoints });
    }
    return CompetitionRuleSet.create({
      ...common,
      knockoutResolutionCode: 'HIGHER_SCORE',
      outcomes,
      profileConfig: { allowDraws: input.allowDraws, profile: 'SCORE_BASED' },
      resultProfile: 'SCORE_BASED',
    });
  }
  return CompetitionRuleSet.create({
    ...common,
    knockoutResolutionCode: 'MOST_SETS_WON',
    outcomes: [
      { code: 'WIN', description: 'Victoria', tablePoints: input.winPoints },
      { code: 'LOSS', description: 'Derrota', tablePoints: input.lossPoints },
    ],
    profileConfig: { profile: 'SET_BASED', setsToWin: input.setsToWin },
    resultProfile: 'SET_BASED',
  });
}

@Injectable()
export class PrismaCompetitionStore implements CompetitionStore {
  readonly #competitionRepository: PrismaCompetitionRepository;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#competitionRepository = new PrismaCompetitionRepository(client);
  }

  public async catalog(): Promise<CompetitionCatalog> {
    const [editions, combinations] = await Promise.all([
      this.client.edition.findMany({
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, year: true },
        where: { status: 'OPEN' },
      }),
      this.client.eventSportModality.findMany({
        orderBy: [
          { event: { name: 'asc' } },
          { sport: { name: 'asc' } },
          { modality: { name: 'asc' } },
        ],
        select: {
          event: { select: { code: true, id: true, name: true } },
          modality: { select: { code: true, id: true, name: true } },
          sport: { select: { code: true, id: true, name: true } },
        },
        where: {
          active: true,
          event: { active: true },
          modality: { active: true },
          sport: { active: true },
        },
      }),
    ]);
    return { combinations, editions };
  }

  public async list(): Promise<readonly CompetitionSummary[]> {
    const records = await this.client.competition.findMany({
      include: {
        _count: { select: { participants: true } },
        combination: { include: { event: true, modality: true, sport: true } },
        edition: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map((record) => this.#summary(record));
  }

  public async detail(id: string): Promise<CompetitionDetail> {
    return this.client.$transaction((transaction) => this.#detail(transaction, id));
  }

  public async addParticipant(input: AddStoredParticipantInput): Promise<CompetitionDetail> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, PARTICIPANT_SCOPE);
        if (replay !== null) return replay;
        const aggregate = await this.#aggregate(transaction, input.competitionId);
        const institution = await transaction.institution.findFirst({
          select: { eventId: true, id: true, name: true },
          where: { active: true, id: input.institutionId },
        });
        if (institution === null || institution.eventId !== aggregate.toSnapshot().key.eventId) {
          throw new CompetitionStoreError(
            'INSTITUTION_INVALID',
            'The institution is not active or does not belong to this event.',
          );
        }
        const participantId = randomUUID();
        const occurredAt = new Date();
        try {
          aggregate.addParticipant({
            actorId: input.actorId,
            displayName: institution.name,
            eventId: institution.eventId,
            expectedRevision: input.expectedRevision,
            id: participantId,
            institutionId: institution.id,
            occurredAt,
          });
          await this.#competitionRepository.saveInTransaction(
            transaction,
            aggregate,
            input.expectedRevision,
          );
        } catch (error: unknown) {
          if (error instanceof DomainError) throw storeError(error);
          throw error;
        }
        const snapshot = aggregate.toSnapshot();
        await transaction.auditEntry.create({
          data: {
            actionCode: 'COMPETITION_PARTICIPANT_ADDED',
            actorId: input.actorId,
            actorRole: input.actorRole,
            competitionId: snapshot.id,
            correlationId: input.correlationId,
            id: randomUUID(),
            metadata: { institutionId: institution.id, participantId },
            resourceId: participantId,
            resourceType: 'COMPETITION_PARTICIPANT',
            revisionAfter: snapshot.revision,
            revisionBefore: input.expectedRevision,
          },
        });
        const response = await this.#detail(transaction, snapshot.id);
        await this.#completeMutation(transaction, input, PARTICIPANT_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (!isUniqueConstraint(error)) throw error;
      const replay = await this.#readMutationReplay(input, PARTICIPANT_SCOPE);
      if (replay !== null) return replay;
      throw new CompetitionStoreError('DUPLICATE_PARTICIPANT', 'The institution is already enabled in this competition.');
    }
  }

  public async configureFormat(input: ConfigureStoredFormatInput): Promise<CompetitionDetail> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, FORMAT_SCOPE);
        if (replay !== null) return replay;
        const aggregate = await this.#aggregate(transaction, input.competitionId);
        try {
          aggregate.configureFormat({
            actorId: input.actorId,
            expectedRevision: input.expectedRevision,
            formatCode: input.formatCode,
            groupCount: input.groupCount,
            occurredAt: new Date(),
          } as Parameters<Competition['configureFormat']>[0]);
          await this.#competitionRepository.saveInTransaction(
            transaction,
            aggregate,
            input.expectedRevision,
          );
        } catch (error: unknown) {
          if (error instanceof DomainError) throw storeError(error);
          throw error;
        }
        const snapshot = aggregate.toSnapshot();
        await transaction.auditEntry.create({
          data: {
            actionCode: 'COMPETITION_FORMAT_CONFIGURED',
            actorId: input.actorId,
            actorRole: input.actorRole,
            competitionId: snapshot.id,
            correlationId: input.correlationId,
            id: randomUUID(),
            metadata: { formatCode: snapshot.formatCode, groupCount: snapshot.groupCount },
            resourceId: snapshot.id,
            resourceType: 'COMPETITION',
            revisionAfter: snapshot.revision,
            revisionBefore: input.expectedRevision,
          },
        });
        const response = await this.#detail(transaction, snapshot.id);
        await this.#completeMutation(transaction, input, FORMAT_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (!isUniqueConstraint(error)) throw error;
      const replay = await this.#readMutationReplay(input, FORMAT_SCOPE);
      if (replay !== null) return replay;
      throw error;
    }
  }

  public async saveRuleSet(input: SaveStoredRuleSetInput): Promise<CompetitionDetail> {
    return this.client.$transaction(async (transaction) => {
      const replay = await this.#beginMutation(transaction, input, RULE_SET_SAVE_SCOPE);
      if (replay !== null) return replay;
      await this.#assertEditableCompetition(transaction, input.competitionId);
      const existing = await this.#latestRuleSet(transaction, input.competitionId);
      const occurredAt = new Date();
      let snapshot: CompetitionRuleSetSnapshot;
      try {
        if (existing === null) {
          if (input.expectedRevision !== null) {
            throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule-set revision is stale.');
          }
          const created = createRuleSet(input, randomUUID(), occurredAt);
          snapshot = created.toSnapshot();
          await transaction.competitionRuleSet.create({
            data: {
              competitionId: snapshot.competitionId,
              createdAt: snapshot.createdAt,
              createdById: snapshot.createdBy,
              id: snapshot.id,
              knockoutResolutionCode: snapshot.knockoutResolutionCode,
              metrics: { create: snapshot.metrics.map((metricCode) => ({ metricCode })) },
              outcomes: { create: snapshot.outcomes.map(({ code, description, tablePoints }) => ({ description, outcomeCode: code, tablePoints })) },
              profileConfig: { ...snapshot.profileConfig },
              resultProfile: snapshot.resultProfile,
              revision: snapshot.revision,
              revisionNumber: snapshot.revisionNumber,
              schemaVersion: snapshot.schemaVersion,
              status: snapshot.status,
              tiebreaks: { create: snapshot.tieBreakCriteria.map((criterionCode, index) => ({ criterionCode, position: index + 1 })) },
              updatedAt: snapshot.updatedAt,
              updatedById: snapshot.updatedBy,
            },
          });
        } else {
          if (input.expectedRevision === null) {
            throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule set already exists.');
          }
          const configured = createRuleSet(input, existing.toSnapshot().id, occurredAt).toSnapshot();
          existing.update({
            actorId: input.actorId,
            expectedRevision: input.expectedRevision,
            knockoutResolutionCode: configured.knockoutResolutionCode,
            metrics: configured.metrics,
            occurredAt,
            outcomes: configured.outcomes,
            profileConfig: configured.profileConfig,
            resultProfile: configured.resultProfile,
            tieBreakCriteria: configured.tieBreakCriteria,
          });
          snapshot = existing.toSnapshot();
          await transaction.ruleSetOutcome.deleteMany({ where: { ruleSetId: snapshot.id } });
          await transaction.ruleSetMetric.deleteMany({ where: { ruleSetId: snapshot.id } });
          await transaction.ruleSetTiebreak.deleteMany({ where: { ruleSetId: snapshot.id } });
          const updated = await transaction.competitionRuleSet.updateMany({
            data: {
              knockoutResolutionCode: snapshot.knockoutResolutionCode,
              profileConfig: { ...snapshot.profileConfig },
              resultProfile: snapshot.resultProfile,
              revision: snapshot.revision,
              updatedAt: snapshot.updatedAt,
              updatedById: snapshot.updatedBy,
            },
            where: { id: snapshot.id, revision: input.expectedRevision, status: 'DRAFT' },
          });
          if (updated.count !== 1) throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule-set revision is stale.');
          await transaction.ruleSetOutcome.createMany({ data: snapshot.outcomes.map(({ code, description, tablePoints }) => ({ description, outcomeCode: code, ruleSetId: snapshot.id, tablePoints })) });
          await transaction.ruleSetMetric.createMany({ data: snapshot.metrics.map((metricCode) => ({ metricCode, ruleSetId: snapshot.id })) });
          await transaction.ruleSetTiebreak.createMany({ data: snapshot.tieBreakCriteria.map((criterionCode, index) => ({ criterionCode, position: index + 1, ruleSetId: snapshot.id })) });
        }
      } catch (error: unknown) {
        if (error instanceof DomainError) throw ruleSetStoreError(error);
        throw error;
      }
      await transaction.auditEntry.create({
        data: {
          actionCode: input.expectedRevision === null ? 'COMPETITION_RULE_SET_CREATED' : 'COMPETITION_RULE_SET_UPDATED',
          actorId: input.actorId,
          actorRole: input.actorRole,
          competitionId: input.competitionId,
          correlationId: input.correlationId,
          id: randomUUID(),
          metadata: { resultProfile: snapshot.resultProfile, ruleSetId: snapshot.id },
          resourceId: snapshot.id,
          resourceType: 'COMPETITION_RULE_SET',
          revisionAfter: snapshot.revision,
          revisionBefore: input.expectedRevision,
        },
      });
      const response = await this.#detail(transaction, input.competitionId);
      await this.#completeMutation(transaction, input, RULE_SET_SAVE_SCOPE, response);
      return response;
    }, { isolationLevel: 'Serializable' });
  }

  public async freezeRuleSet(input: FreezeStoredRuleSetInput): Promise<CompetitionDetail> {
    return this.client.$transaction(async (transaction) => {
      const replay = await this.#beginMutation(transaction, input, RULE_SET_FREEZE_SCOPE);
      if (replay !== null) return replay;
      await this.#assertEditableCompetition(transaction, input.competitionId);
      const ruleSet = await this.#latestRuleSet(transaction, input.competitionId);
      if (ruleSet === null) throw new CompetitionStoreError('RULE_SET_NOT_FOUND', 'The competition has no rules to freeze.');
      try {
        ruleSet.freeze({ actorId: input.actorId, expectedRevision: input.expectedRevision, occurredAt: new Date() });
      } catch (error: unknown) {
        if (error instanceof DomainError) throw ruleSetStoreError(error);
        throw error;
      }
      const snapshot = ruleSet.toSnapshot();
      const updated = await transaction.competitionRuleSet.updateMany({
        data: {
          canonicalHash: snapshot.canonicalHash,
          frozenAt: snapshot.frozenAt,
          frozenById: snapshot.frozenBy,
          revision: snapshot.revision,
          status: snapshot.status,
          updatedAt: snapshot.updatedAt,
          updatedById: snapshot.updatedBy,
        },
        where: { id: snapshot.id, revision: input.expectedRevision, status: 'DRAFT' },
      });
      if (updated.count !== 1) throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule-set revision is stale.');
      await transaction.auditEntry.create({
        data: {
          actionCode: 'COMPETITION_RULE_SET_FROZEN',
          actorId: input.actorId,
          actorRole: input.actorRole,
          competitionId: input.competitionId,
          correlationId: input.correlationId,
          id: randomUUID(),
          metadata: { canonicalHash: snapshot.canonicalHash, ruleSetId: snapshot.id },
          resourceId: snapshot.id,
          resourceType: 'COMPETITION_RULE_SET',
          revisionAfter: snapshot.revision,
          revisionBefore: input.expectedRevision,
        },
      });
      const response = await this.#detail(transaction, input.competitionId);
      await this.#completeMutation(transaction, input, RULE_SET_FREEZE_SCOPE, response);
      return response;
    }, { isolationLevel: 'Serializable' });
  }

  public async create(input: CreateStoredCompetitionInput): Promise<CompetitionSummary> {
    try {
      return await this.#createTransaction(input);
    } catch (error: unknown) {
      if (!isUniqueConstraint(error)) throw error;
      const replay = await this.#readReplay(input);
      if (replay !== null) return replay;
      throw new CompetitionStoreError(
        'COMPETITION_ALREADY_EXISTS',
        'A competition already exists for the selected edition, event, sport and modality.',
      );
    }
  }

  async #createTransaction(input: CreateStoredCompetitionInput): Promise<CompetitionSummary> {
    const keyHash = digest(input.idempotencyKey);
    const bodyHash = requestDigest(input);
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.idempotencyRecord.findUnique({
        where: {
          actorId_scope_idempotencyKeyHash: {
            actorId: input.actorId,
            idempotencyKeyHash: keyHash,
            scope: IDEMPOTENCY_SCOPE,
          },
        },
      });
      if (existing !== null) return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, bodyHash);

      const [edition, combination] = await Promise.all([
        transaction.edition.findFirst({
          select: { id: true },
          where: { id: input.editionId, status: 'OPEN' },
        }),
        transaction.eventSportModality.findFirst({
          select: { eventId: true },
          where: {
            active: true,
            event: { active: true },
            eventId: input.eventId,
            modality: { active: true },
            modalityId: input.modalityId,
            sport: { active: true },
            sportId: input.sportId,
          },
        }),
      ]);
      if (edition === null || combination === null) {
        throw new CompetitionStoreError(
          'CATALOG_SELECTION_INVALID',
          'The selected edition, event, sport or modality is not available.',
        );
      }

      const occurredAt = new Date();
      const id = randomUUID();
      const competition = Competition.create({
        actorId: input.actorId,
        id,
        key: {
          editionId: input.editionId,
          eventId: input.eventId,
          modalityId: input.modalityId,
          sportId: input.sportId,
        },
        occurredAt,
      }).toSnapshot();
      await transaction.idempotencyRecord.create({
        data: {
          actorId: input.actorId,
          expiresAt: new Date(occurredAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          id: randomUUID(),
          idempotencyKeyHash: keyHash,
          requestHash: bodyHash,
          scope: IDEMPOTENCY_SCOPE,
          status: 'PROCESSING',
        },
      });
      const created = await transaction.competition.create({
        data: {
          createdAt: competition.createdAt,
          createdById: competition.createdBy,
          editionId: competition.key.editionId,
          eventId: competition.key.eventId,
          formatCode: competition.formatCode,
          groupCount: competition.groupCount,
          id: competition.id,
          modalityId: competition.key.modalityId,
          revision: competition.revision,
          sportId: competition.key.sportId,
          status: competition.status,
          updatedAt: competition.updatedAt,
          updatedById: competition.updatedBy,
        },
        include: {
          _count: { select: { participants: true } },
          combination: { include: { event: true, modality: true, sport: true } },
          edition: true,
        },
      });
      const response = this.#summary(created);
      await transaction.auditEntry.create({
        data: {
          actionCode: 'COMPETITION_CREATED',
          actorId: input.actorId,
          actorRole: input.actorRole,
          competitionId: id,
          correlationId: input.correlationId,
          id: randomUUID(),
          metadata: {
            editionId: input.editionId,
            eventId: input.eventId,
            modalityId: input.modalityId,
            sportId: input.sportId,
          },
          resourceId: id,
          resourceType: 'COMPETITION',
          revisionAfter: 1,
        },
      });
      await transaction.idempotencyRecord.update({
        data: {
          completedAt: new Date(),
          resourceId: id,
          resourceType: 'COMPETITION',
          responseBody: response as unknown as Prisma.InputJsonValue,
          responseStatus: 201,
          status: 'COMPLETED',
        },
        where: {
          actorId_scope_idempotencyKeyHash: {
            actorId: input.actorId,
            idempotencyKeyHash: keyHash,
            scope: IDEMPOTENCY_SCOPE,
          },
        },
      });
      return response;
    }, { isolationLevel: 'Serializable' });
  }

  async #readReplay(input: CreateStoredCompetitionInput): Promise<CompetitionSummary | null> {
    const existing = await this.client.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: digest(input.idempotencyKey),
          scope: IDEMPOTENCY_SCOPE,
        },
      },
    });
    if (existing === null) return null;
    return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, requestDigest(input));
  }

  #existingResponse(
    storedRequestHash: string,
    status: string,
    responseBody: unknown,
    requestHash: string,
  ): CompetitionSummary {
    if (storedRequestHash !== requestHash) {
      throw new CompetitionStoreError(
        'IDEMPOTENCY_CONFLICT',
        'The idempotency key was already used for another request.',
      );
    }
    if (status !== 'COMPLETED') {
      throw new CompetitionStoreError(
        'IDEMPOTENCY_IN_PROGRESS',
        'The original request is still being processed.',
      );
    }
    return parseReplay(responseBody);
  }

  #summary(record: {
    readonly _count: { readonly participants: number };
    readonly combination: {
      readonly event: { readonly code: string; readonly id: string; readonly name: string };
      readonly modality: { readonly code: string; readonly id: string; readonly name: string };
      readonly sport: { readonly code: string; readonly id: string; readonly name: string };
    };
    readonly createdAt: Date;
    readonly edition: { readonly id: string; readonly name: string; readonly year: number };
    readonly formatCode: string | null;
    readonly groupCount: number | null;
    readonly id: string;
    readonly revision: number;
    readonly status: string;
  }): CompetitionSummary {
    return {
      createdAt: record.createdAt.toISOString(),
      edition: record.edition,
      event: record.combination.event,
      formatCode: record.formatCode as CompetitionSummary['formatCode'],
      groupCount: record.groupCount,
      id: record.id,
      modality: record.combination.modality,
      participantCount: record._count.participants,
      revision: record.revision,
      sport: record.combination.sport,
      status: record.status as CompetitionSummary['status'],
    };
  }

  async #aggregate(transaction: Prisma.TransactionClient, id: string): Promise<Competition> {
    const aggregate = await this.#competitionRepository.findByIdInTransaction(transaction, id);
    if (aggregate === null) {
      throw new CompetitionStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    }
    return aggregate;
  }

  async #detail(transaction: Prisma.TransactionClient, id: string): Promise<CompetitionDetail> {
    const record = await transaction.competition.findUnique({
      include: {
        _count: { select: { participants: true } },
        combination: { include: { event: true, modality: true, sport: true } },
        edition: true,
        participants: { orderBy: { displayName: 'asc' } },
      },
      where: { id },
    });
    if (record === null) throw new CompetitionStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    const [institutions, ruleSet] = await Promise.all([
      transaction.institution.findMany({
        orderBy: { name: 'asc' },
        select: { code: true, id: true, name: true },
        where: { active: true, eventId: record.eventId },
      }),
      this.#latestRuleSet(transaction, id),
    ]);
    const selected = new Set(record.participants.map(({ institutionId }) => institutionId));
    const participantCount = record.participants.filter(({ status }) => status === 'ENABLED').length;
    const validGroupCounts = Array.from({ length: Math.floor(participantCount / 3) }, (_, index) => index + 1)
      .filter((count) => participantCount >= count * 3 && participantCount <= count * 4);
    return {
      ...this.#summary(record),
      institutions: institutions.map((institution) => ({ ...institution, selected: selected.has(institution.id) })),
      participants: record.participants.map((participant) => ({
        displayName: participant.displayName,
        enabledAt: participant.enabledAt.toISOString(),
        id: participant.id,
        institutionId: participant.institutionId,
        status: participant.status as 'ENABLED' | 'WITHDRAWN',
      })),
      ruleSet: ruleSet === null ? null : this.#ruleSetView(ruleSet.toSnapshot()),
      validGroupCounts,
    };
  }

  async #assertEditableCompetition(transaction: Prisma.TransactionClient, id: string): Promise<void> {
    const competition = await transaction.competition.findUnique({ select: { status: true }, where: { id } });
    if (competition === null) throw new CompetitionStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    if (competition.status !== 'DRAFT' && competition.status !== 'OPEN') {
      throw new CompetitionStoreError('COMPETITION_NOT_EDITABLE', 'Rules can only change while the competition is draft or open.');
    }
  }

  async #latestRuleSet(transaction: Prisma.TransactionClient, competitionId: string): Promise<CompetitionRuleSet | null> {
    const record = await transaction.competitionRuleSet.findFirst({
      include: {
        metrics: { orderBy: { metricCode: 'asc' } },
        outcomes: { orderBy: { outcomeCode: 'asc' } },
        tiebreaks: { orderBy: { position: 'asc' } },
      },
      orderBy: { revisionNumber: 'desc' },
      where: { competitionId },
    });
    if (record === null) return null;
    if (!isJsonObject(record.profileConfig)) {
      throw new CompetitionStoreError('RULE_SET_INVALID', 'Persisted rule profile is invalid.');
    }
    const profileConfig = record.profileConfig;
    const parsedProfile = profileConfig.profile === 'SCORE_BASED' && typeof profileConfig.allowDraws === 'boolean'
      ? { allowDraws: profileConfig.allowDraws, profile: 'SCORE_BASED' as const }
      : profileConfig.profile === 'SET_BASED' && typeof profileConfig.setsToWin === 'number'
        ? { profile: 'SET_BASED' as const, setsToWin: profileConfig.setsToWin }
        : null;
    if (parsedProfile === null) throw new CompetitionStoreError('RULE_SET_INVALID', 'Persisted rule profile is invalid.');
    try {
      return CompetitionRuleSet.rehydrate({
        canonicalHash: record.canonicalHash,
        competitionId: record.competitionId,
        createdAt: record.createdAt,
        createdBy: record.createdById,
        frozenAt: record.frozenAt,
        frozenBy: record.frozenById,
        id: record.id,
        knockoutResolutionCode: record.knockoutResolutionCode as CompetitionRuleSetSnapshot['knockoutResolutionCode'],
        metrics: record.metrics.map(({ metricCode }) => metricCode as MetricCode),
        outcomes: record.outcomes.map(({ description, outcomeCode, tablePoints }) => ({ code: outcomeCode, description, tablePoints })),
        profileConfig: parsedProfile,
        resultProfile: record.resultProfile as CompetitionRuleSetSnapshot['resultProfile'],
        revision: record.revision,
        revisionNumber: record.revisionNumber,
        schemaVersion: record.schemaVersion,
        status: record.status as CompetitionRuleSetSnapshot['status'],
        tieBreakCriteria: record.tiebreaks.map(({ criterionCode }) => criterionCode as TieBreakCriterion),
        updatedAt: record.updatedAt,
        updatedBy: record.updatedById,
      });
    } catch (error: unknown) {
      if (error instanceof DomainError) throw new CompetitionStoreError('RULE_SET_INVALID', error.message);
      throw error;
    }
  }

  #ruleSetView(snapshot: CompetitionRuleSetSnapshot): NonNullable<CompetitionDetail['ruleSet']> {
    const winPoints = snapshot.outcomes.find(({ code }) => code === 'WIN')?.tablePoints;
    const lossPoints = snapshot.outcomes.find(({ code }) => code === 'LOSS')?.tablePoints;
    if (winPoints === undefined || lossPoints === undefined) throw new CompetitionStoreError('RULE_SET_INVALID', 'Base rule outcomes are missing.');
    const evidence = {
      canonicalHash: snapshot.canonicalHash,
      frozenAt: snapshot.frozenAt?.toISOString() ?? null,
      id: snapshot.id,
      revision: snapshot.revision,
      status: snapshot.status,
    };
    if (snapshot.profileConfig.profile === 'SCORE_BASED') {
      return {
        ...evidence,
        allowDraws: snapshot.profileConfig.allowDraws,
        drawPoints: snapshot.outcomes.find(({ code }) => code === 'DRAW')?.tablePoints ?? null,
        lossPoints,
        resultProfile: 'SCORE_BASED',
        tieBreakCriteria: snapshot.tieBreakCriteria as readonly ScoreTieBreakCriterion[],
        winPoints,
      };
    }
    return {
      ...evidence,
      lossPoints,
      resultProfile: 'SET_BASED',
      setsToWin: snapshot.profileConfig.setsToWin,
      tieBreakCriteria: snapshot.tieBreakCriteria as readonly SetTieBreakCriterion[],
      winPoints,
    };
  }

  async #beginMutation(
    transaction: Prisma.TransactionClient,
    input: StoredMutationInput,
    scope: string,
  ): Promise<CompetitionDetail | null> {
    const keyHash = digest(input.idempotencyKey);
    const requestHash = mutationDigest(input);
    const existing = await transaction.idempotencyRecord.findUnique({
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: keyHash, scope } },
    });
    if (existing !== null) return this.#existingDetail(existing.requestHash, existing.status, existing.responseBody, requestHash);
    await transaction.idempotencyRecord.create({
      data: {
        actorId: input.actorId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        id: randomUUID(),
        idempotencyKeyHash: keyHash,
        requestHash,
        scope,
        status: 'PROCESSING',
      },
    });
    return null;
  }

  async #completeMutation(
    transaction: Prisma.TransactionClient,
    input: StoredMutationInput,
    scope: string,
    response: CompetitionDetail,
  ): Promise<void> {
    await transaction.idempotencyRecord.update({
      data: {
        completedAt: new Date(),
        resourceId: input.competitionId,
        resourceType: 'COMPETITION',
        responseBody: response as unknown as Prisma.InputJsonValue,
        responseStatus: 200,
        status: 'COMPLETED',
      },
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: digest(input.idempotencyKey), scope } },
    });
  }

  async #readMutationReplay(
    input: StoredMutationInput,
    scope: string,
  ): Promise<CompetitionDetail | null> {
    const existing = await this.client.idempotencyRecord.findUnique({
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: digest(input.idempotencyKey), scope } },
    });
    if (existing === null) return null;
    return this.#existingDetail(existing.requestHash, existing.status, existing.responseBody, mutationDigest(input));
  }

  #existingDetail(storedHash: string, status: string, body: unknown, requestHash: string): CompetitionDetail {
    if (storedHash !== requestHash) throw new CompetitionStoreError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another request.');
    if (status !== 'COMPLETED') throw new CompetitionStoreError('IDEMPOTENCY_IN_PROGRESS', 'The original request is still being processed.');
    return parseDetailReplay(body);
  }
}
