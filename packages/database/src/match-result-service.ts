import { createHash, randomUUID } from 'node:crypto';

import {
  DomainError,
  GroupQualification,
  MatchResult,
  calculateGroupTable,
  type AuthorityRole,
  type MatchResultSnapshot,
  type MatchResultStatus,
  type ResolvedResult,
  type ResultDetail,
} from '@oes/domain';

import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { PrismaCompetitionRuleSetRepository } from './competition-rule-set-repository.js';

export interface RecordPersistedMatchResultInput {
  readonly actorId: string;
  readonly correlationId?: string;
  readonly detail: ResultDetail;
  readonly idempotencyKey?: string;
  readonly matchId: string;
  readonly occurredAt: Date;
  readonly resultId: string;
}

export interface ConfirmPersistedMatchResultInput {
  readonly actorId: string;
  readonly correlationId?: string;
  readonly expectedRevision: number;
  readonly idempotencyKey?: string;
  readonly occurredAt: Date;
  readonly resultId: string;
}

export interface AnnulPersistedMatchResultInput extends ConfirmPersistedMatchResultInput {
  readonly reason: string;
}

type ResultMutationInput = RecordPersistedMatchResultInput | ConfirmPersistedMatchResultInput | AnnulPersistedMatchResultInput;

function parseRole(role: string, status: string): AuthorityRole {
  if (status === 'ACTIVE' && (role === 'ADMIN' || role === 'SUPERADMIN')) return role;
  throw new DomainError('RESULT_AUTHORITY_INVALID', 'An active result authority is required.');
}

function parseStatus(status: string): MatchResultStatus {
  if (status === 'PENDING_CONFIRMATION' || status === 'CONFIRMED' || status === 'ANNULLED') {
    return status;
  }
  throw new DomainError('RESULT_DETAIL_INVALID', `Unknown persisted result status: ${status}.`);
}

function json(value: ResultDetail | ResolvedResult): Prisma.InputJsonValue {
  return structuredClone(value) as unknown as Prisma.InputJsonValue;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function mutationRequest(input: ResultMutationInput): unknown {
  if ('detail' in input) return { detail: input.detail, matchId: input.matchId };
  return { expectedRevision: input.expectedRevision, ...('reason' in input ? { reason: input.reason.trim() } : {}), resultId: input.resultId };
}

export class PrismaMatchResultService {
  readonly #client: PrismaClient;
  readonly #ruleSetRepository: PrismaCompetitionRuleSetRepository;

  public constructor(client: PrismaClient) {
    this.#client = client;
    this.#ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
  }

  public async record(input: RecordPersistedMatchResultInput): Promise<MatchResult> {
    const replay = await this.#replay(input, 'result:record');
    if (replay !== null) return replay;
    const [match, actor] = await Promise.all([
      this.#client.logicalMatch.findUnique({
        include: { execution: { include: { configuration: true } } },
        where: { id: input.matchId },
      }),
      this.#client.user.findUnique({ select: { role: true, status: true }, where: { id: input.actorId } }),
    ]);
    if (match === null || actor === null || match.execution.status !== 'CONFIRMED') {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Confirmed match dependencies are missing.');
    }
    const ruleSet = await this.#ruleSetRepository.findById(match.execution.configuration.ruleSetId);
    if (ruleSet === null) throw new DomainError('RESULT_DETAIL_INVALID', 'Frozen match rules are missing.');
    const result = MatchResult.record({
      actorId: input.actorId,
      actorRole: parseRole(actor.role, actor.status),
      detail: input.detail,
      id: input.resultId,
      matchId: input.matchId,
      occurredAt: input.occurredAt,
      participantAId: match.participantAId,
      participantBId: match.participantBId,
      ruleSet: ruleSet.toSnapshot(),
    });
    if (match.pairingId !== null && result.toSnapshot().resolved.winnerParticipantId === null) {
      throw new DomainError('RESULT_DETAIL_INVALID', 'Knockout matches require a winner.');
    }
    const snapshot = result.toSnapshot();
    const actorRole = parseRole(actor.role, actor.status);
    try {
      await this.#client.$transaction(async (transaction) => {
      await this.#beginMutation(transaction, input, 'result:record');
      const changed = await transaction.logicalMatch.updateMany({
        data: { status: 'RESULT_PENDING_CONFIRMATION' },
        where: { id: match.id, status: 'PENDING_RESULT' },
      });
      if (changed.count !== 1) {
        throw new DomainError('CONCURRENCY_CONFLICT', 'The match already has an active result.');
      }
      await transaction.matchResult.create({
        data: {
          competitionId: match.competitionId,
          detailJson: json(snapshot.detail),
          id: snapshot.id,
          matchId: snapshot.matchId,
          participantAId: snapshot.participantAId,
          participantBId: snapshot.participantBId,
          recordedAt: snapshot.recordedAt,
          recordedById: snapshot.recordedBy,
          resolvedJson: json(snapshot.resolved),
          revision: snapshot.revision,
          ruleSetId: snapshot.ruleSetId,
          status: snapshot.status,
          winnerParticipantId: snapshot.resolved.winnerParticipantId,
        },
      });
      await transaction.auditEntry.create({ data: {
        actionCode: 'MATCH_RESULT_RECORDED', actorId: input.actorId, actorRole,
        competitionId: match.competitionId, correlationId: input.correlationId ?? randomUUID(), id: randomUUID(),
        metadata: { matchId: input.matchId, profile: snapshot.detail.profile }, resourceId: snapshot.id,
        resourceType: 'MATCH_RESULT', revisionAfter: snapshot.revision,
      } });
      await this.#completeMutation(transaction, input, 'result:record', snapshot.id);
      });
    } catch (error: unknown) {
      const recovered = await this.#recover(error, input, 'result:record');
      if (recovered !== null) return recovered;
      throw error;
    }
    return result;
  }

  public async findById(id: string): Promise<MatchResult | null> {
    const record = await this.#client.matchResult.findUnique({ where: { id } });
    if (record === null) return null;
    const ruleSet = await this.#ruleSetRepository.findById(record.ruleSetId);
    if (ruleSet === null) throw new DomainError('RESULT_DETAIL_INVALID', 'Persisted result rules are missing.');
    return MatchResult.rehydrate(this.#snapshot(record), ruleSet.toSnapshot());
  }

  public async confirm(input: ConfirmPersistedMatchResultInput): Promise<MatchResult> {
    const replay = await this.#replay(input, 'result:confirm');
    if (replay !== null) return replay;
    const [result, actor, record] = await Promise.all([
      this.findById(input.resultId),
      this.#client.user.findUnique({ select: { role: true, status: true }, where: { id: input.actorId } }),
      this.#client.matchResult.findUnique({ include: { match: true }, where: { id: input.resultId } }),
    ]);
    if (result === null || actor === null || record === null) {
      throw new DomainError('RESULT_CONFIRMATION_INVALID', 'Result confirmation dependencies are missing.');
    }
    const actorRole = parseRole(actor.role, actor.status);
    result.confirm({ actorId: input.actorId, actorRole, expectedRevision: input.expectedRevision, occurredAt: input.occurredAt });
    const snapshot = result.toSnapshot();
    try {
      await this.#client.$transaction(async (transaction) => {
      await this.#beginMutation(transaction, input, 'result:confirm');
      const changed = await transaction.matchResult.updateMany({
        data: { confirmedAt: snapshot.confirmedAt, confirmedById: snapshot.confirmedBy, revision: snapshot.revision, status: snapshot.status },
        where: { id: snapshot.id, revision: input.expectedRevision, status: 'PENDING_CONFIRMATION' },
      });
      if (changed.count !== 1) throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted result revision is stale.');
      await transaction.logicalMatch.update({
        data: { status: 'RESULT_CONFIRMED', winnerParticipantId: snapshot.resolved.winnerParticipantId },
        where: { id: snapshot.matchId },
      });
      if (record.match.groupId !== null) {
        await this.#recalculateGroup(
          record.match.groupId,
          input.occurredAt,
          record.recordedById,
          actorRole,
          transaction,
        );
      }
      await transaction.auditEntry.create({ data: {
        actionCode: 'MATCH_RESULT_CONFIRMED', actorId: input.actorId, actorRole,
        competitionId: record.competitionId, correlationId: input.correlationId ?? randomUUID(), id: randomUUID(),
        metadata: { matchId: snapshot.matchId, winnerParticipantId: snapshot.resolved.winnerParticipantId },
        resourceId: snapshot.id, resourceType: 'MATCH_RESULT', revisionAfter: snapshot.revision,
        revisionBefore: input.expectedRevision,
      } });
      await this.#completeMutation(transaction, input, 'result:confirm', snapshot.id);
      });
    } catch (error: unknown) {
      const recovered = await this.#recover(error, input, 'result:confirm');
      if (recovered !== null) return recovered;
      throw error;
    }
    return result;
  }

  public async annul(input: AnnulPersistedMatchResultInput): Promise<MatchResult> {
    const replay = await this.#replay(input, 'result:annul');
    if (replay !== null) return replay;
    const [result, actor, record] = await Promise.all([
      this.findById(input.resultId),
      this.#client.user.findUnique({ select: { role: true, status: true }, where: { id: input.actorId } }),
      this.#client.matchResult.findUnique({ include: { match: true }, where: { id: input.resultId } }),
    ]);
    if (result === null || actor === null || record === null) {
      throw new DomainError('RESULT_ANNULMENT_INVALID', 'Result annulment dependencies are missing.');
    }
    const actorRole = parseRole(actor.role, actor.status);
    result.annul({ actorId: input.actorId, actorRole, expectedRevision: input.expectedRevision, occurredAt: input.occurredAt, reason: input.reason });
    const snapshot = result.toSnapshot();
    try {
      await this.#client.$transaction(async (transaction) => {
      await this.#beginMutation(transaction, input, 'result:annul');
      const changed = await transaction.matchResult.updateMany({
        data: { annulledAt: snapshot.annulledAt, annulledById: snapshot.annulledBy, annulmentReason: snapshot.annulmentReason, revision: snapshot.revision, status: snapshot.status },
        where: { id: snapshot.id, revision: input.expectedRevision, status: 'CONFIRMED' },
      });
      if (changed.count !== 1) throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted result revision is stale.');
      await transaction.logicalMatch.update({ data: { status: 'PENDING_RESULT', winnerParticipantId: null }, where: { id: snapshot.matchId } });
      if (record.match.groupId !== null) {
        await transaction.groupQualification.updateMany({
          data: {
            invalidatedAt: input.occurredAt,
            invalidatedById: input.actorId,
            invalidationReason: 'A source result was annulled.',
            revision: { increment: 1 },
            status: 'INVALIDATED',
          },
          where: { groupId: record.match.groupId, status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
        });
        await this.#recalculateGroup(
          record.match.groupId,
          input.occurredAt,
          input.actorId,
          actorRole,
          transaction,
        );
      }
      await transaction.auditEntry.create({ data: {
        actionCode: 'MATCH_RESULT_ANNULLED', actorId: input.actorId, actorRole,
        competitionId: record.competitionId, correlationId: input.correlationId ?? randomUUID(), id: randomUUID(),
        metadata: { matchId: snapshot.matchId }, reason: snapshot.annulmentReason,
        resourceId: snapshot.id, resourceType: 'MATCH_RESULT', revisionAfter: snapshot.revision,
        revisionBefore: input.expectedRevision,
      } });
      await this.#completeMutation(transaction, input, 'result:annul', snapshot.id);
      });
    } catch (error: unknown) {
      const recovered = await this.#recover(error, input, 'result:annul');
      if (recovered !== null) return recovered;
      throw error;
    }
    return result;
  }

  async #beginMutation(
    transaction: Prisma.TransactionClient,
    input: ResultMutationInput,
    scope: string,
  ): Promise<void> {
    if (input.idempotencyKey === undefined) return;
    await transaction.idempotencyRecord.create({ data: {
      actorId: input.actorId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), id: randomUUID(),
      idempotencyKeyHash: digest(input.idempotencyKey), requestHash: digest(mutationRequest(input)), scope, status: 'PROCESSING',
    } });
  }

  async #completeMutation(
    transaction: Prisma.TransactionClient,
    input: ResultMutationInput,
    scope: string,
    resultId: string,
  ): Promise<void> {
    if (input.idempotencyKey === undefined) return;
    await transaction.idempotencyRecord.update({
      data: { completedAt: new Date(), resourceId: resultId, resourceType: 'MATCH_RESULT', responseBody: { resultId }, responseStatus: 200, status: 'COMPLETED' },
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: digest(input.idempotencyKey), scope } },
    });
  }

  async #replay(
    input: ResultMutationInput,
    scope: string,
  ): Promise<MatchResult | null> {
    if (input.idempotencyKey === undefined) return null;
    const record = await this.#client.idempotencyRecord.findUnique({
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: digest(input.idempotencyKey), scope } },
    });
    if (record === null) return null;
    if (record.requestHash !== digest(mutationRequest(input))) throw new DomainError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another result request.');
    if (record.status !== 'COMPLETED' || record.resourceId === null) throw new DomainError('IDEMPOTENCY_IN_PROGRESS', 'The original result request is still being processed.');
    const result = await this.findById(record.resourceId);
    if (result === null) throw new DomainError('RESULT_DETAIL_INVALID', 'The idempotent result no longer exists.');
    return result;
  }

  async #recover(
    error: unknown,
    input: ResultMutationInput,
    scope: string,
  ): Promise<MatchResult | null> {
    if (!isUniqueConstraint(error) || input.idempotencyKey === undefined) return null;
    return this.#replay(input, scope);
  }

  #snapshot(record: Awaited<ReturnType<PrismaClient['matchResult']['findUniqueOrThrow']>>): MatchResultSnapshot {
    return {
      annulledAt: record.annulledAt, annulledBy: record.annulledById, annulmentReason: record.annulmentReason,
      confirmedAt: record.confirmedAt, confirmedBy: record.confirmedById,
      detail: record.detailJson as unknown as ResultDetail,
      id: record.id, matchId: record.matchId,
      participantAId: record.participantAId, participantBId: record.participantBId,
      recordedAt: record.recordedAt, recordedBy: record.recordedById,
      resolved: record.resolvedJson as unknown as ResolvedResult,
      revision: record.revision, ruleSetId: record.ruleSetId,
      status: parseStatus(record.status),
    };
  }

  async #recalculateGroup(
    groupId: string,
    occurredAt: Date,
    actorId: string,
    actorRole: AuthorityRole,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    const group = await transaction.drawGroup.findUnique({
      include: {
        execution: { include: { configuration: true } },
        members: true,
        matches: { include: { results: { where: { status: 'CONFIRMED' } } } },
      },
      where: { id: groupId },
    });
    if (group === null) throw new DomainError('TABLE_CALCULATION_INVALID', 'Group does not exist.');
    const ruleSet = await this.#ruleSetRepository.findById(group.execution.configuration.ruleSetId);
    if (ruleSet === null) throw new DomainError('TABLE_CALCULATION_INVALID', 'Group rules are missing.');
    const resultSnapshots = group.matches.flatMap((match) => match.results.map((record) => this.#snapshot(record)));
    const table = calculateGroupTable(group.members.map(({ participantId }) => participantId), resultSnapshots, ruleSet.toSnapshot());
    await transaction.groupStanding.deleteMany({ where: { groupId } });
    await transaction.groupStanding.createMany({ data: table.map((row) => ({ ...row, competitionId: group.competitionId, groupId, recalculatedAt: occurredAt })) });
    const complete = group.matches.length > 0 && group.matches.every(({ status }) => status === 'RESULT_CONFIRMED');
    if (!complete) return;
    const active = await transaction.groupQualification.findFirst({
      where: { groupId, status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
    });
    if (active !== null) return;
    try {
      const qualification = GroupQualification.propose({
        actorId,
        actorRole,
        competitionId: group.competitionId,
        groupId,
        id: randomUUID(),
        occurredAt,
        sourceResultIds: resultSnapshots.map(({ id }) => id),
        sourceRuleSetId: ruleSet.toSnapshot().id,
        table,
      }).toSnapshot();
      await transaction.groupQualification.create({
        data: {
          competitionId: qualification.competitionId,
          firstParticipantId: qualification.firstParticipantId,
          groupId: qualification.groupId,
          id: qualification.id,
          proposedAt: qualification.proposedAt,
          proposedById: qualification.proposedBy,
          revision: qualification.revision,
          secondParticipantId: qualification.secondParticipantId,
          sourceRuleSetId: qualification.sourceRuleSetId,
          sources: {
            create: qualification.sourceResultIds.map((resultId, index) => ({
              competitionId: qualification.competitionId,
              ordinal: index + 1,
              resultId,
            })),
          },
          status: qualification.status,
        },
      });
    } catch (error: unknown) {
      if (error instanceof DomainError && error.code === 'TIE_UNRESOLVED') return;
      throw error;
    }
  }
}
