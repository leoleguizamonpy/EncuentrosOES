import { randomUUID } from 'node:crypto';

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
  readonly detail: ResultDetail;
  readonly matchId: string;
  readonly occurredAt: Date;
  readonly resultId: string;
}

export interface ConfirmPersistedMatchResultInput {
  readonly actorId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
  readonly resultId: string;
}

export interface AnnulPersistedMatchResultInput extends ConfirmPersistedMatchResultInput {
  readonly reason: string;
}

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

export class PrismaMatchResultService {
  readonly #client: PrismaClient;
  readonly #ruleSetRepository: PrismaCompetitionRuleSetRepository;

  public constructor(client: PrismaClient) {
    this.#client = client;
    this.#ruleSetRepository = new PrismaCompetitionRuleSetRepository(client);
  }

  public async record(input: RecordPersistedMatchResultInput): Promise<MatchResult> {
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
    await this.#client.$transaction(async (transaction) => {
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
    });
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
    const [result, actor, record] = await Promise.all([
      this.findById(input.resultId),
      this.#client.user.findUnique({ select: { role: true, status: true }, where: { id: input.actorId } }),
      this.#client.matchResult.findUnique({ include: { match: true }, where: { id: input.resultId } }),
    ]);
    if (result === null || actor === null || record === null) {
      throw new DomainError('RESULT_CONFIRMATION_INVALID', 'Result confirmation dependencies are missing.');
    }
    result.confirm({ actorId: input.actorId, actorRole: parseRole(actor.role, actor.status), expectedRevision: input.expectedRevision, occurredAt: input.occurredAt });
    const snapshot = result.toSnapshot();
    await this.#client.$transaction(async (transaction) => {
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
          parseRole(actor.role, actor.status),
          transaction,
        );
      }
    });
    return result;
  }

  public async annul(input: AnnulPersistedMatchResultInput): Promise<MatchResult> {
    const [result, actor, record] = await Promise.all([
      this.findById(input.resultId),
      this.#client.user.findUnique({ select: { role: true, status: true }, where: { id: input.actorId } }),
      this.#client.matchResult.findUnique({ include: { match: true }, where: { id: input.resultId } }),
    ]);
    if (result === null || actor === null || record === null) {
      throw new DomainError('RESULT_ANNULMENT_INVALID', 'Result annulment dependencies are missing.');
    }
    result.annul({ actorId: input.actorId, actorRole: parseRole(actor.role, actor.status), expectedRevision: input.expectedRevision, occurredAt: input.occurredAt, reason: input.reason });
    const snapshot = result.toSnapshot();
    await this.#client.$transaction(async (transaction) => {
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
          parseRole(actor.role, actor.status),
          transaction,
        );
      }
    });
    return result;
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
