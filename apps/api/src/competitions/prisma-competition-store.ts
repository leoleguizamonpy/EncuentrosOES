import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, type PrismaClient } from '@oes/database';
import { Competition } from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  CompetitionStoreError,
  type CompetitionCatalog,
  type CompetitionStore,
  type CompetitionSummary,
  type CreateStoredCompetitionInput,
} from './competition-store.js';

const IDEMPOTENCY_SCOPE = 'competition:create';

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
    readonly id: string;
    readonly revision: number;
    readonly status: string;
  }): CompetitionSummary {
    return {
      createdAt: record.createdAt.toISOString(),
      edition: record.edition,
      event: record.combination.event,
      formatCode: record.formatCode as CompetitionSummary['formatCode'],
      id: record.id,
      modality: record.combination.modality,
      participantCount: record._count.participants,
      revision: record.revision,
      sport: record.combination.sport,
      status: record.status as CompetitionSummary['status'],
    };
  }
}
