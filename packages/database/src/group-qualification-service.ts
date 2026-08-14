import { createHash, randomUUID } from 'node:crypto';

import {
  DomainError,
  GroupQualification,
  type AuthorityRole,
  type GroupQualificationSnapshot,
  type GroupQualificationStatus,
} from '@oes/domain';

import type { Prisma, PrismaClient } from './generated/prisma/client.js';

export interface ConfirmPersistedGroupQualificationInput {
  readonly actorId: string;
  readonly correlationId?: string;
  readonly expectedRevision: number;
  readonly idempotencyKey?: string;
  readonly occurredAt: Date;
  readonly qualificationId: string;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function mutationRequest(input: ConfirmPersistedGroupQualificationInput | AnnulPersistedGroupQualificationInput): unknown {
  return {
    expectedRevision: input.expectedRevision,
    qualificationId: input.qualificationId,
    ...('reason' in input ? { reason: input.reason.trim() } : {}),
  };
}

export interface AnnulPersistedGroupQualificationInput
  extends ConfirmPersistedGroupQualificationInput {
  readonly reason: string;
}

type QualificationRecord = Prisma.GroupQualificationGetPayload<{
  include: { sources: true };
}>;

function parseRole(role: string, status: string): AuthorityRole {
  if (status === 'ACTIVE' && (role === 'ADMIN' || role === 'SUPERADMIN')) return role;
  throw new DomainError('QUALIFICATION_AUTHORITY_INVALID', 'An active qualification authority is required.');
}

function parseStatus(status: string): GroupQualificationStatus {
  if (
    status === 'PENDING_CONFIRMATION' ||
    status === 'CONFIRMED' ||
    status === 'INVALIDATED' ||
    status === 'ANNULLED'
  ) return status;
  throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', `Unknown qualification status: ${status}.`);
}

export class PrismaGroupQualificationService {
  readonly #client: PrismaClient;

  public constructor(client: PrismaClient) {
    this.#client = client;
  }

  public async findById(id: string): Promise<GroupQualification | null> {
    const record = await this.#client.groupQualification.findUnique({
      include: { sources: { orderBy: { ordinal: 'asc' } } },
      where: { id },
    });
    return record === null ? null : GroupQualification.rehydrate(this.#snapshot(record));
  }

  public async confirm(input: ConfirmPersistedGroupQualificationInput): Promise<GroupQualification> {
    const replay = await this.#replay(input, 'qualification:confirm');
    if (replay !== null) return replay;
    const [qualification, actor] = await Promise.all([
      this.findById(input.qualificationId),
      this.#client.user.findUnique({
        select: { role: true, status: true },
        where: { id: input.actorId },
      }),
    ]);
    if (qualification === null || actor === null) {
      throw new DomainError('QUALIFICATION_CONFIRMATION_INVALID', 'Qualification confirmation dependencies are missing.');
    }
    qualification.confirm({
      actorId: input.actorId,
      actorRole: parseRole(actor.role, actor.status),
      expectedRevision: input.expectedRevision,
      occurredAt: input.occurredAt,
    });
    const snapshot = qualification.toSnapshot();
    const actorRole = parseRole(actor.role, actor.status);
    try {
      await this.#client.$transaction(async (transaction) => {
        await this.#beginMutation(transaction, input, 'qualification:confirm');
        const changed = await transaction.groupQualification.updateMany({
          data: {
            confirmedAt: snapshot.confirmedAt,
            confirmedById: snapshot.confirmedBy,
            revision: snapshot.revision,
            status: snapshot.status,
          },
          where: {
            id: snapshot.id,
            revision: input.expectedRevision,
            status: 'PENDING_CONFIRMATION',
          },
        });
        if (changed.count !== 1) {
          throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted qualification revision is stale.');
        }
        await transaction.auditEntry.create({ data: {
          actionCode: 'GROUP_QUALIFICATION_CONFIRMED', actorId: input.actorId, actorRole,
          competitionId: snapshot.competitionId, correlationId: input.correlationId ?? randomUUID(), id: randomUUID(),
          metadata: { firstParticipantId: snapshot.firstParticipantId, groupId: snapshot.groupId, secondParticipantId: snapshot.secondParticipantId },
          resourceId: snapshot.id, resourceType: 'GROUP_QUALIFICATION', revisionAfter: snapshot.revision,
          revisionBefore: input.expectedRevision,
        } });
        await this.#completeMutation(transaction, input, 'qualification:confirm', snapshot.id);
      });
    } catch (error: unknown) {
      const recovered = await this.#recover(error, input, 'qualification:confirm');
      if (recovered !== null) return recovered;
      throw error;
    }
    return qualification;
  }

  public async annul(input: AnnulPersistedGroupQualificationInput): Promise<GroupQualification> {
    const replay = await this.#replay(input, 'qualification:annul');
    if (replay !== null) return replay;
    const [qualification, actor] = await Promise.all([
      this.findById(input.qualificationId),
      this.#client.user.findUnique({
        select: { role: true, status: true },
        where: { id: input.actorId },
      }),
    ]);
    if (qualification === null || actor === null) {
      throw new DomainError('QUALIFICATION_TRANSITION_INVALID', 'Qualification annulment dependencies are missing.');
    }
    qualification.annul({
      actorId: input.actorId,
      actorRole: parseRole(actor.role, actor.status),
      expectedRevision: input.expectedRevision,
      occurredAt: input.occurredAt,
      reason: input.reason,
    });
    const snapshot = qualification.toSnapshot();
    const actorRole = parseRole(actor.role, actor.status);
    try {
      await this.#client.$transaction(async (transaction) => {
        await this.#beginMutation(transaction, input, 'qualification:annul');
        const changed = await transaction.groupQualification.updateMany({
          data: {
            annulledAt: snapshot.annulledAt,
            annulledById: snapshot.annulledBy,
            annulmentReason: snapshot.annulmentReason,
            revision: snapshot.revision,
            status: snapshot.status,
          },
          where: { id: snapshot.id, revision: input.expectedRevision, status: 'CONFIRMED' },
        });
        if (changed.count !== 1) {
          throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted qualification revision is stale.');
        }
        await transaction.auditEntry.create({ data: {
          actionCode: 'GROUP_QUALIFICATION_ANNULLED', actorId: input.actorId, actorRole,
          competitionId: snapshot.competitionId, correlationId: input.correlationId ?? randomUUID(), id: randomUUID(),
          metadata: { groupId: snapshot.groupId }, reason: snapshot.annulmentReason,
          resourceId: snapshot.id, resourceType: 'GROUP_QUALIFICATION', revisionAfter: snapshot.revision,
          revisionBefore: input.expectedRevision,
        } });
        await this.#completeMutation(transaction, input, 'qualification:annul', snapshot.id);
      });
    } catch (error: unknown) {
      const recovered = await this.#recover(error, input, 'qualification:annul');
      if (recovered !== null) return recovered;
      throw error;
    }
    return qualification;
  }

  async #beginMutation(
    transaction: Prisma.TransactionClient,
    input: ConfirmPersistedGroupQualificationInput | AnnulPersistedGroupQualificationInput,
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
    input: ConfirmPersistedGroupQualificationInput | AnnulPersistedGroupQualificationInput,
    scope: string,
    qualificationId: string,
  ): Promise<void> {
    if (input.idempotencyKey === undefined) return;
    await transaction.idempotencyRecord.update({
      data: { completedAt: new Date(), resourceId: qualificationId, resourceType: 'GROUP_QUALIFICATION', responseBody: { qualificationId }, responseStatus: 200, status: 'COMPLETED' },
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: digest(input.idempotencyKey), scope } },
    });
  }

  async #replay(
    input: ConfirmPersistedGroupQualificationInput | AnnulPersistedGroupQualificationInput,
    scope: string,
  ): Promise<GroupQualification | null> {
    if (input.idempotencyKey === undefined) return null;
    const record = await this.#client.idempotencyRecord.findUnique({
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: digest(input.idempotencyKey), scope } },
    });
    if (record === null) return null;
    if (record.requestHash !== digest(mutationRequest(input))) throw new DomainError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another qualification request.');
    if (record.status !== 'COMPLETED' || record.resourceId === null) throw new DomainError('IDEMPOTENCY_IN_PROGRESS', 'The original qualification request is still being processed.');
    const qualification = await this.findById(record.resourceId);
    if (qualification === null) throw new DomainError('QUALIFICATION_PROPOSAL_INVALID', 'The idempotent qualification no longer exists.');
    return qualification;
  }

  async #recover(
    error: unknown,
    input: ConfirmPersistedGroupQualificationInput | AnnulPersistedGroupQualificationInput,
    scope: string,
  ): Promise<GroupQualification | null> {
    if (!isUniqueConstraint(error) || input.idempotencyKey === undefined) return null;
    return this.#replay(input, scope);
  }

  #snapshot(record: QualificationRecord): GroupQualificationSnapshot {
    return {
      annulledAt: record.annulledAt,
      annulledBy: record.annulledById,
      annulmentReason: record.annulmentReason,
      competitionId: record.competitionId,
      confirmedAt: record.confirmedAt,
      confirmedBy: record.confirmedById,
      firstParticipantId: record.firstParticipantId,
      groupId: record.groupId,
      id: record.id,
      invalidatedAt: record.invalidatedAt,
      invalidatedBy: record.invalidatedById,
      invalidationReason: record.invalidationReason,
      proposedAt: record.proposedAt,
      proposedBy: record.proposedById,
      revision: record.revision,
      secondParticipantId: record.secondParticipantId,
      sourceResultIds: record.sources.map(({ resultId }) => resultId),
      sourceRuleSetId: record.sourceRuleSetId,
      status: parseStatus(record.status),
    };
  }
}
