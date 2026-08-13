import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, type PrismaClient } from '@oes/database';
import { Competition, DomainError } from '@oes/domain';

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
} from './competition-store.js';

const IDEMPOTENCY_SCOPE = 'competition:create';
const PARTICIPANT_SCOPE = 'competition:participant:add';
const FORMAT_SCOPE = 'competition:format:configure';

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

function mutationDigest(input: AddStoredParticipantInput | ConfigureStoredFormatInput): string {
  return digest(JSON.stringify({
    competitionId: input.competitionId,
    expectedRevision: input.expectedRevision,
    ...('institutionId' in input
      ? { institutionId: input.institutionId }
      : { formatCode: input.formatCode, groupCount: input.groupCount }),
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

@Injectable()
export class PrismaCompetitionStore implements CompetitionStore {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

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
        } catch (error: unknown) {
          if (error instanceof DomainError) throw storeError(error);
          throw error;
        }
        const snapshot = aggregate.toSnapshot();
        const updated = await transaction.competition.updateMany({
          data: {
            formatCode: snapshot.formatCode,
            groupCount: snapshot.groupCount,
            revision: snapshot.revision,
            updatedAt: snapshot.updatedAt,
            updatedById: snapshot.updatedBy,
          },
          where: { id: snapshot.id, revision: input.expectedRevision },
        });
        if (updated.count !== 1) {
          throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The competition was modified by another operation.');
        }
        const participant = snapshot.participants.find(({ id }) => id === participantId);
        if (participant === undefined) throw new Error('Participant mutation did not produce a snapshot.');
        await transaction.competitionParticipant.create({
          data: {
            competitionId: snapshot.id,
            displayName: participant.displayName,
            enabledAt: participant.enabledAt,
            enabledById: participant.enabledBy,
            eventId: participant.eventId,
            id: participant.id,
            institutionId: participant.institutionId,
            revision: participant.revision,
            status: participant.status,
          },
        });
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
        } catch (error: unknown) {
          if (error instanceof DomainError) throw storeError(error);
          throw error;
        }
        const snapshot = aggregate.toSnapshot();
        const updated = await transaction.competition.updateMany({
          data: {
            formatCode: snapshot.formatCode,
            groupCount: snapshot.groupCount,
            revision: snapshot.revision,
            updatedAt: snapshot.updatedAt,
            updatedById: snapshot.updatedBy,
          },
          where: { id: snapshot.id, revision: input.expectedRevision },
        });
        if (updated.count !== 1) {
          throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The competition was modified by another operation.');
        }
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
    const record = await transaction.competition.findUnique({
      include: { participants: { orderBy: { id: 'asc' } } },
      where: { id },
    });
    if (record === null) throw new CompetitionStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    return Competition.rehydrate({
      createdAt: record.createdAt,
      createdBy: record.createdById,
      formatCode: record.formatCode as CompetitionSummary['formatCode'],
      groupCount: record.groupCount,
      id: record.id,
      key: { editionId: record.editionId, eventId: record.eventId, modalityId: record.modalityId, sportId: record.sportId },
      lockedAt: record.lockedAt,
      lockedBy: record.lockedById,
      participants: record.participants.map((participant) => ({
        displayName: participant.displayName,
        enabledAt: participant.enabledAt,
        enabledBy: participant.enabledById,
        eventId: participant.eventId,
        id: participant.id,
        institutionId: participant.institutionId,
        revision: participant.revision,
        status: participant.status as 'ENABLED' | 'WITHDRAWN',
      })),
      revision: record.revision,
      status: record.status as CompetitionSummary['status'],
      updatedAt: record.updatedAt,
      updatedBy: record.updatedById,
    });
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
    const institutions = await transaction.institution.findMany({
      orderBy: { name: 'asc' },
      select: { code: true, id: true, name: true },
      where: { active: true, eventId: record.eventId },
    });
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
      validGroupCounts,
    };
  }

  async #beginMutation(
    transaction: Prisma.TransactionClient,
    input: AddStoredParticipantInput | ConfigureStoredFormatInput,
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
    input: AddStoredParticipantInput | ConfigureStoredFormatInput,
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
    input: AddStoredParticipantInput | ConfigureStoredFormatInput,
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
