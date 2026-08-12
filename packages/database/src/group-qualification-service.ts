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
  readonly expectedRevision: number;
  readonly occurredAt: Date;
  readonly qualificationId: string;
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
    const changed = await this.#client.groupQualification.updateMany({
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
    return qualification;
  }

  public async annul(input: AnnulPersistedGroupQualificationInput): Promise<GroupQualification> {
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
    const changed = await this.#client.groupQualification.updateMany({
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
    return qualification;
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
