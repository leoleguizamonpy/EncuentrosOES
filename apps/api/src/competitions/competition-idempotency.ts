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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isCatalogItem(value: unknown): boolean {
  return isRecord(value) && isString(value.code) && isString(value.id) && isString(value.name);
}

function isEdition(value: unknown): boolean {
  return isRecord(value) && isString(value.id) && isString(value.name) && isNumber(value.year);
}

function isCompetitionStatus(value: unknown): boolean {
  return value === 'DRAFT' || value === 'FINALIZED' || value === 'LOCKED' || value === 'OPEN';
}

function isFormatCode(value: unknown): boolean {
  return value === null || value === 'GROUP_STAGE' || value === 'KNOCKOUT';
}

function isCompetitionSummary(value: unknown): value is CompetitionSummary {
  if (!isRecord(value)) return false;
  return isString(value.createdAt)
    && isEdition(value.edition)
    && isCatalogItem(value.event)
    && isFormatCode(value.formatCode)
    && isNullableNumber(value.groupCount)
    && isString(value.id)
    && isCatalogItem(value.modality)
    && isNumber(value.participantCount)
    && isNumber(value.revision)
    && isCatalogItem(value.sport)
    && isCompetitionStatus(value.status);
}

function isInstitution(value: unknown): boolean {
  return isRecord(value)
    && isString(value.code)
    && isString(value.id)
    && isString(value.name)
    && typeof value.selected === 'boolean';
}

function isParticipant(value: unknown): boolean {
  return isRecord(value)
    && isString(value.displayName)
    && isString(value.enabledAt)
    && isString(value.id)
    && isString(value.institutionId)
    && (value.status === 'ENABLED' || value.status === 'WITHDRAWN');
}

function isRuleSet(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isNumber(value.revision)
    && (value.status === 'DRAFT' || value.status === 'FROZEN' || value.status === 'REPLACED')
    && (value.resultProfile === 'SCORE_BASED' || value.resultProfile === 'SET_BASED');
}

function isCompetitionDetail(value: unknown): value is CompetitionDetail {
  if (!isCompetitionSummary(value) || !isRecord(value)) return false;
  return Array.isArray(value.institutions)
    && value.institutions.every(isInstitution)
    && Array.isArray(value.participants)
    && value.participants.every(isParticipant)
    && isRuleSet(value.ruleSet)
    && Array.isArray(value.validGroupCounts)
    && value.validGroupCounts.every(isNumber);
}

function invalidReplay(): CompetitionStoreError {
  return new CompetitionStoreError('IDEMPOTENCY_CONFLICT', 'The stored idempotent response is not valid.');
}

function parseSummaryReplay(value: unknown): CompetitionSummary {
  if (!isCompetitionSummary(value)) throw invalidReplay();
  return value;
}

function parseDetailReplay(value: unknown): CompetitionDetail {
  if (!isCompetitionDetail(value)) throw invalidReplay();
  return value;
}

function toInputJson(value: CompetitionDetail): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
        responseBody: toInputJson(response),
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
