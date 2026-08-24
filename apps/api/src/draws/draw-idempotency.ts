import { createHash, randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from '@oes/database';

import {
  DrawStoreError,
  type AnnulDrawInput,
  type ConfirmDrawInput,
  type DrawWorkspace,
  type ExecuteDrawInput,
  type PrepareDrawInput,
  type PublishDrawInput,
} from './draw-store.js';

export const PREPARE_SCOPE = 'draw:prepare';
export const EXECUTE_SCOPE = 'draw:execute';
export const CONFIRM_SCOPE = 'draw:confirm';
export const ANNUL_SCOPE = 'draw:annul';
export const PUBLISH_SCOPE = 'draw:publish';

export type DrawMutationInput =
  | PrepareDrawInput
  | ExecuteDrawInput
  | ConfirmDrawInput
  | AnnulDrawInput
  | PublishDrawInput;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function mutationDigest(input: DrawMutationInput): string {
  return sha256(JSON.stringify({
    expectedRevision: input.expectedRevision,
    ...('reason' in input ? { reason: input.reason.trim() } : {}),
    ...('competitionId' in input
      ? { competitionId: input.competitionId }
      : 'configurationId' in input
        ? { configurationId: input.configurationId }
        : { executionId: input.executionId }),
  }));
}

function parseReplay(value: unknown): DrawWorkspace {
  if (typeof value !== 'object' || value === null || !('competitionId' in value) || typeof value.competitionId !== 'string') {
    throw new DrawStoreError('IDEMPOTENCY_CONFLICT', 'The stored draw response is invalid.');
  }
  return value as unknown as DrawWorkspace;
}

export class DrawIdempotencyCoordinator {
  public constructor(private readonly client: PrismaClient) {}

  public async begin(
    transaction: Prisma.TransactionClient,
    input: DrawMutationInput,
    scope: string,
  ): Promise<DrawWorkspace | null> {
    const keyHash = sha256(input.idempotencyKey);
    const requestHash = mutationDigest(input);
    const existing = await transaction.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: keyHash,
          scope,
        },
      },
    });
    if (existing !== null) {
      return this.existingResponse(existing.requestHash, existing.status, existing.responseBody, requestHash);
    }
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

  public async complete(
    transaction: Prisma.TransactionClient,
    input: DrawMutationInput,
    scope: string,
    response: DrawWorkspace,
  ): Promise<void> {
    await transaction.idempotencyRecord.update({
      data: {
        completedAt: new Date(),
        resourceId: response.competitionId,
        resourceType: 'COMPETITION',
        responseBody: response as unknown as Prisma.InputJsonValue,
        responseStatus: 200,
        status: 'COMPLETED',
      },
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: sha256(input.idempotencyKey),
          scope,
        },
      },
    });
  }

  public async recover(
    error: unknown,
    input: DrawMutationInput,
    scope: string,
    fallback:
      | 'DRAW_ANNULMENT_INVALID'
      | 'DRAW_CONFIGURATION_INVALID'
      | 'DRAW_CONFIRMATION_INVALID'
      | 'DRAW_EXECUTION_INVALID',
  ): Promise<DrawWorkspace> {
    if (!this.isUniqueConstraint(error)) throw error;
    const existing = await this.client.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: sha256(input.idempotencyKey),
          scope,
        },
      },
    });
    if (existing !== null) {
      return this.existingResponse(
        existing.requestHash,
        existing.status,
        existing.responseBody,
        mutationDigest(input),
      );
    }
    throw new DrawStoreError(fallback, 'Another incompatible draw operation already exists.');
  }

  public requestHash(input: DrawMutationInput): string {
    return mutationDigest(input);
  }

  public keyHash(idempotencyKey: string): string {
    return sha256(idempotencyKey);
  }

  public existingResponse(storedHash: string, status: string, body: unknown, requestHash: string): DrawWorkspace {
    if (storedHash !== requestHash) {
      throw new DrawStoreError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another request.');
    }
    if (status !== 'COMPLETED') {
      throw new DrawStoreError('IDEMPOTENCY_IN_PROGRESS', 'The original draw request is still being processed.');
    }
    return parseReplay(body);
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
