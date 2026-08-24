import { createHash, randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from '@oes/database';

import {
  CompetitionStoreError,
  type AddStoredParticipantInput,
  type CompetitionDetail,
  type CompetitionSummary,
  type ConfigureStoredFormatInput,
  type CreateStoredCompetitionInput,
  type FreezeStoredRuleSetInput,
  type SaveStoredRuleSetInput,
} from './competition-store.js';

export const COMPETITION_CREATE_SCOPE = 'competition:create';
export const PARTICIPANT_SCOPE = 'competition:participant:add';
export const FORMAT_SCOPE = 'competition:format:configure';
export const RULE_SET_SAVE_SCOPE = 'competition:rules:save';
export const RULE_SET_FREEZE_SCOPE = 'competition:rules:freeze';

export type StoredCompetitionMutationInput =
  | AddStoredParticipantInput
  | ConfigureStoredFormatInput
  | FreezeStoredRuleSetInput
  | SaveStoredRuleSetInput;

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function parseSummaryReplay(value: unknown): CompetitionSummary {
  if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string') {
    throw new CompetitionStoreError('IDEMPOTENCY_CONFLICT', 'The stored idempotent response is not valid.');
  }
  return value as CompetitionSummary;
}

function parseDetailReplay(value: unknown): CompetitionDetail {
  return parseSummaryReplay(value) as CompetitionDetail;
}

export class CompetitionIdempotencyCoordinator {
  public constructor(private readonly client: PrismaClient) {}

  public keyHash(idempotencyKey: string): string {
    return digest(idempotencyKey);
  }

  public createRequestHash(input: CreateStoredCompetitionInput): string {
    return digest(JSON.stringify({
      editionId: input.editionId,
      eventId: input.eventId,
      modalityId: input.modalityId,
      sportId: input.sportId,
    }));
  }

  public mutationRequestHash(input: StoredCompetitionMutationInput): string {
    return digest(JSON.stringify({
      competitionId: input.competitionId,
      expectedRevision: input.expectedRevision,
      ...('institutionId' in input
        ? { institutionId: input.institutionId }
        : 'formatCode' in input
          ? { formatCode: input.formatCode, groupCount: input.groupCount }
          : 'resultProfile' in input
            ? input.resultProfile === 'SCORE_BASED'
              ? {
                  allowDraws: input.allowDraws,
                  drawPoints: input.drawPoints,
                  lossPoints: input.lossPoints,
                  resultProfile: input.resultProfile,
                  tieBreakCriteria: input.tieBreakCriteria,
                  winPoints: input.winPoints,
                }
              : {
                  lossPoints: input.lossPoints,
                  resultProfile: input.resultProfile,
                  setsToWin: input.setsToWin,
                  tieBreakCriteria: input.tieBreakCriteria,
                  winPoints: input.winPoints,
                }
            : { action: 'freeze' }),
    }));
  }

  public summaryResponse(
    storedRequestHash: string,
    status: string,
    responseBody: unknown,
    requestHash: string,
  ): CompetitionSummary {
    this.assertReplay(storedRequestHash, status, requestHash);
    return parseSummaryReplay(responseBody);
  }

  public detailResponse(
    storedRequestHash: string,
    status: string,
    responseBody: unknown,
    requestHash: string,
  ): CompetitionDetail {
    this.assertReplay(storedRequestHash, status, requestHash);
    return parseDetailReplay(responseBody);
  }

  public async begin(
    transaction: Prisma.TransactionClient,
    input: StoredCompetitionMutationInput,
    scope: string,
  ): Promise<CompetitionDetail | null> {
    const keyHash = this.keyHash(input.idempotencyKey);
    const requestHash = this.mutationRequestHash(input);
    const existing = await transaction.idempotencyRecord.findUnique({
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: keyHash, scope } },
    });
    if (existing !== null) {
      return this.detailResponse(existing.requestHash, existing.status, existing.responseBody, requestHash);
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
    input: StoredCompetitionMutationInput,
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
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: this.keyHash(input.idempotencyKey),
          scope,
        },
      },
    });
  }

  public async readMutationReplay(
    input: StoredCompetitionMutationInput,
    scope: string,
  ): Promise<CompetitionDetail | null> {
    const existing = await this.client.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: this.keyHash(input.idempotencyKey),
          scope,
        },
      },
    });
    if (existing === null) return null;
    return this.detailResponse(
      existing.requestHash,
      existing.status,
      existing.responseBody,
      this.mutationRequestHash(input),
    );
  }

  public async readCreateReplay(input: CreateStoredCompetitionInput): Promise<CompetitionSummary | null> {
    const existing = await this.client.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: this.keyHash(input.idempotencyKey),
          scope: COMPETITION_CREATE_SCOPE,
        },
      },
    });
    if (existing === null) return null;
    return this.summaryResponse(
      existing.requestHash,
      existing.status,
      existing.responseBody,
      this.createRequestHash(input),
    );
  }

  private assertReplay(storedRequestHash: string, status: string, requestHash: string): void {
    if (storedRequestHash !== requestHash) {
      throw new CompetitionStoreError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another request.');
    }
    if (status !== 'COMPLETED') {
      throw new CompetitionStoreError('IDEMPOTENCY_IN_PROGRESS', 'The original request is still being processed.');
    }
  }
}
