import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PrismaNextRoundService, type Prisma, type PrismaClient } from '@oes/database';
import { DomainError } from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  NextRoundStoreError,
  type NextRoundStore,
  type NextRoundView,
  type PrepareNextRoundInput,
} from './next-round-store.js';

const PREPARE_NEXT_ROUND_SCOPE = 'next-round:prepare';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestDigest(input: PrepareNextRoundInput): string {
  return sha256(JSON.stringify({
    competitionId: input.competitionId,
    expectedRevision: input.expectedRevision,
  }));
}

function parseReplay(value: unknown): NextRoundView {
  if (
    !isJsonObject(value) ||
    typeof value.competitionId !== 'string' ||
    typeof value.competitionRevision !== 'number' ||
    !isJsonObject(value.configuration) ||
    typeof value.configuration.id !== 'string'
  ) {
    throw new NextRoundStoreError('IDEMPOTENCY_CONFLICT', 'The stored next-round response is invalid.');
  }
  return value as unknown as NextRoundView;
}

function authorityRole(role: PrepareNextRoundInput['actorRole']): 'ADMIN' | 'SUPERADMIN' {
  if (role === 'ADMIN' || role === 'SUPERADMIN') return role;
  throw new NextRoundStoreError('NEXT_ROUND_INVALID', 'An administrator authority is required.');
}

@Injectable()
export class PrismaNextRoundStore implements NextRoundStore {
  readonly #service: PrismaNextRoundService;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#service = new PrismaNextRoundService(client);
  }

  public async prepare(input: PrepareNextRoundInput): Promise<NextRoundView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input);
        if (replay !== null) return replay;

        const prepared = await this.#service.prepareInTransaction(transaction, {
          actorId: input.actorId,
          actorRole: authorityRole(input.actorRole),
          competitionId: input.competitionId,
          correlationId: input.correlationId,
          expectedCompetitionRevision: input.expectedRevision,
          occurredAt: new Date(),
        });
        const canonicalHash = prepared.configuration.canonicalHash;
        if (canonicalHash === null) {
          throw new NextRoundStoreError(
            'NEXT_ROUND_INVALID',
            'The frozen next-round configuration is missing its canonical hash.',
          );
        }
        const response: NextRoundView = {
          competitionId: input.competitionId,
          competitionRevision: prepared.competitionRevision,
          configuration: {
            canonicalHash,
            id: prepared.configuration.id,
            participantCount: prepared.configuration.participantCount,
            roundNumber: prepared.configuration.roundNumber,
            status: 'FROZEN',
          },
        };
        await transaction.idempotencyRecord.update({
          data: {
            completedAt: new Date(),
            resourceId: prepared.configuration.id,
            resourceType: 'DRAW_CONFIGURATION',
            responseBody: response as unknown as Prisma.InputJsonValue,
            responseStatus: 200,
            status: 'COMPLETED',
          },
          where: {
            actorId_scope_idempotencyKeyHash: {
              actorId: input.actorId,
              idempotencyKeyHash: sha256(input.idempotencyKey),
              scope: PREPARE_NEXT_ROUND_SCOPE,
            },
          },
        });
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (error instanceof NextRoundStoreError) throw error;
      if (error instanceof DomainError) {
        throw new NextRoundStoreError(
          error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : 'NEXT_ROUND_INVALID',
          error.message,
        );
      }
      if (isUniqueConstraint(error)) return this.#recoverConcurrentReplay(input);
      throw error;
    }
  }

  async #beginMutation(
    transaction: Prisma.TransactionClient,
    input: PrepareNextRoundInput,
  ): Promise<NextRoundView | null> {
    const idempotencyKeyHash = sha256(input.idempotencyKey);
    const digest = requestDigest(input);
    const existing = await transaction.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash,
          scope: PREPARE_NEXT_ROUND_SCOPE,
        },
      },
    });
    if (existing !== null) return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, digest);

    await transaction.idempotencyRecord.create({
      data: {
        actorId: input.actorId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        id: crypto.randomUUID(),
        idempotencyKeyHash,
        requestHash: digest,
        scope: PREPARE_NEXT_ROUND_SCOPE,
        status: 'PROCESSING',
      },
    });
    return null;
  }

  async #recoverConcurrentReplay(input: PrepareNextRoundInput): Promise<NextRoundView> {
    const existing = await this.client.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: sha256(input.idempotencyKey),
          scope: PREPARE_NEXT_ROUND_SCOPE,
        },
      },
    });
    if (existing === null) {
      throw new NextRoundStoreError('NEXT_ROUND_INVALID', 'Another incompatible next-round operation exists.');
    }
    return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, requestDigest(input));
  }

  #existingResponse(storedHash: string, status: string, body: unknown, expectedHash: string): NextRoundView {
    if (storedHash !== expectedHash) {
      throw new NextRoundStoreError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another request.');
    }
    if (status !== 'COMPLETED') {
      throw new NextRoundStoreError('IDEMPOTENCY_IN_PROGRESS', 'The original next-round request is still being processed.');
    }
    return parseReplay(body);
  }
}
