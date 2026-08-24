import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PrismaCompetitionRepository, type Prisma, type PrismaClient } from '@oes/database';
import { Competition, DomainError } from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  CompetitionIdempotencyCoordinator,
  COMPETITION_CREATE_SCOPE,
  FORMAT_SCOPE,
  PARTICIPANT_SCOPE,
  RULE_SET_FREEZE_SCOPE,
  RULE_SET_SAVE_SCOPE,
} from './competition-idempotency.js';
import { CompetitionRuleSetPersistence } from './competition-rule-set-persistence.js';
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
} from './competition-store.js';

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
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

@Injectable()
export class PrismaCompetitionStore implements CompetitionStore {
  readonly #competitionRepository: PrismaCompetitionRepository;
  readonly #idempotency: CompetitionIdempotencyCoordinator;
  readonly #ruleSets: CompetitionRuleSetPersistence;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#competitionRepository = new PrismaCompetitionRepository(client);
    this.#idempotency = new CompetitionIdempotencyCoordinator(client);
    this.#ruleSets = new CompetitionRuleSetPersistence();
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
        const replay = await this.#idempotency.begin(transaction, input, PARTICIPANT_SCOPE);
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
        await this.#idempotency.complete(transaction, input, PARTICIPANT_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (!isUniqueConstraint(error)) throw error;
      const replay = await this.#idempotency.readMutationReplay(input, PARTICIPANT_SCOPE);
      if (replay !== null) return replay;
      throw new CompetitionStoreError('DUPLICATE_PARTICIPANT', 'The institution is already enabled in this competition.');
    }
  }

  public async configureFormat(input: ConfigureStoredFormatInput): Promise<CompetitionDetail> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#idempotency.begin(transaction, input, FORMAT_SCOPE);
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
        await this.#idempotency.complete(transaction, input, FORMAT_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (!isUniqueConstraint(error)) throw error;
      const replay = await this.#idempotency.readMutationReplay(input, FORMAT_SCOPE);
      if (replay !== null) return replay;
      throw error;
    }
  }

  public async saveRuleSet(input: SaveStoredRuleSetInput): Promise<CompetitionDetail> {
    return this.client.$transaction(async (transaction) => {
      const replay = await this.#idempotency.begin(transaction, input, RULE_SET_SAVE_SCOPE);
      if (replay !== null) return replay;
      const snapshot = await this.#ruleSets.save(transaction, input);
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
      await this.#idempotency.complete(transaction, input, RULE_SET_SAVE_SCOPE, response);
      return response;
    }, { isolationLevel: 'Serializable' });
  }

  public async freezeRuleSet(input: FreezeStoredRuleSetInput): Promise<CompetitionDetail> {
    return this.client.$transaction(async (transaction) => {
      const replay = await this.#idempotency.begin(transaction, input, RULE_SET_FREEZE_SCOPE);
      if (replay !== null) return replay;
      const snapshot = await this.#ruleSets.freeze(transaction, input);
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
      await this.#idempotency.complete(transaction, input, RULE_SET_FREEZE_SCOPE, response);
      return response;
    }, { isolationLevel: 'Serializable' });
  }

  public async create(input: CreateStoredCompetitionInput): Promise<CompetitionSummary> {
    try {
      return await this.#createTransaction(input);
    } catch (error: unknown) {
      if (!isUniqueConstraint(error)) throw error;
      const replay = await this.#idempotency.readCreateReplay(input);
      if (replay !== null) return replay;
      throw new CompetitionStoreError(
        'COMPETITION_ALREADY_EXISTS',
        'A competition already exists for the selected edition, event, sport and modality.',
      );
    }
  }

  async #createTransaction(input: CreateStoredCompetitionInput): Promise<CompetitionSummary> {
    const keyHash = this.#idempotency.keyHash(input.idempotencyKey);
    const bodyHash = this.#idempotency.createRequestHash(input);
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.idempotencyRecord.findUnique({
        where: {
          actorId_scope_idempotencyKeyHash: {
            actorId: input.actorId,
            idempotencyKeyHash: keyHash,
            scope: COMPETITION_CREATE_SCOPE,
          },
        },
      });
      if (existing !== null) {
        return this.#idempotency.summaryResponse(
          existing.requestHash,
          existing.status,
          existing.responseBody,
          bodyHash,
        );
      }

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
      });
      await transaction.idempotencyRecord.create({
        data: {
          actorId: input.actorId,
          expiresAt: new Date(occurredAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          id: randomUUID(),
          idempotencyKeyHash: keyHash,
          requestHash: bodyHash,
          scope: COMPETITION_CREATE_SCOPE,
          status: 'PROCESSING',
        },
      });
      await this.#competitionRepository.insertInTransaction(transaction, competition);
      const created = await transaction.competition.findUnique({
        include: {
          _count: { select: { participants: true } },
          combination: { include: { event: true, modality: true, sport: true } },
          edition: true,
        },
        where: { id },
      });
      if (created === null) throw new Error('Competition repository insert did not persist aggregate.');
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
            scope: COMPETITION_CREATE_SCOPE,
          },
        },
      });
      return response;
    }, { isolationLevel: 'Serializable' });
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
      this.#ruleSets.latest(transaction, id),
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
      ruleSet: ruleSet === null ? null : this.#ruleSets.view(ruleSet.toSnapshot()),
      validGroupCounts,
    };
  }
}
