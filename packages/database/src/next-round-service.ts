import { randomUUID } from 'node:crypto';

import {
  DomainError,
  DrawConfiguration,
  deriveNextRoundParticipantIds,
  type DrawConfigurationSnapshot,
  type NextRoundSource,
} from '@oes/domain';

import type { Prisma, PrismaClient } from './generated/prisma/client.js';

export interface PreparePersistedNextRoundInput {
  readonly actorId: string;
  readonly actorRole: 'ADMIN' | 'SUPERADMIN';
  readonly competitionId: string;
  readonly correlationId: string;
  readonly expectedCompetitionRevision: number;
  readonly occurredAt: Date;
}

export interface PreparedNextRound {
  readonly competitionRevision: number;
  readonly configuration: DrawConfigurationSnapshot;
}

export class PrismaNextRoundService {
  public constructor(private readonly client: PrismaClient) {}

  public async prepare(input: PreparePersistedNextRoundInput): Promise<PreparedNextRound> {
    return this.client.$transaction(
      (transaction) => this.prepareInTransaction(transaction, input),
      { isolationLevel: 'Serializable' },
    );
  }

  public async prepareInTransaction(
    transaction: Prisma.TransactionClient,
    input: PreparePersistedNextRoundInput,
  ): Promise<PreparedNextRound> {
    const competition = await transaction.competition.findUnique({
      select: { id: true, revision: true, status: true },
      where: { id: input.competitionId },
    });
    if (competition === null) {
      throw new DomainError('DRAW_CONFIGURATION_INCOMPATIBLE', 'The competition does not exist.');
    }
    if (competition.status !== 'LOCKED') {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'Only a locked competition can prepare its next knockout round.',
      );
    }
    if (competition.revision !== input.expectedCompetitionRevision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
    }

    const sourceExecution = await transaction.officialDraw.findFirst({
      include: { configuration: true },
      orderBy: { confirmedAt: 'desc' },
      where: { competitionId: input.competitionId, status: 'CONFIRMED' },
    });
    if (sourceExecution === null) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'A confirmed draw is required before preparing the next round.',
      );
    }

    const nextRoundNumber = sourceExecution.configuration.formatCode === 'GROUP_STAGE'
      ? 1
      : sourceExecution.configuration.roundNumber + 1;
    const existingNextRound = await transaction.drawConfiguration.findFirst({
      select: { id: true },
      where: {
        competitionId: input.competitionId,
        formatCode: 'KNOCKOUT',
        roundNumber: nextRoundNumber,
        status: 'FROZEN',
      },
    });
    if (existingNextRound !== null) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'The next knockout round already has a frozen configuration.',
      );
    }

    const source = sourceExecution.configuration.formatCode === 'GROUP_STAGE'
      ? await this.#groupStageSource(transaction, sourceExecution.id)
      : await this.#knockoutSource(transaction, sourceExecution.id);
    const eligibleIds = deriveNextRoundParticipantIds(source);
    const participants = await transaction.competitionParticipant.findMany({
      select: { displayName: true, id: true },
      where: { competitionId: input.competitionId, id: { in: [...eligibleIds] }, status: 'ENABLED' },
    });
    if (participants.length !== eligibleIds.length) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'Every advancing participant must still belong to the competition.',
      );
    }

    const byeCounts = await transaction.drawPairing.groupBy({
      _count: { participantAId: true },
      by: ['participantAId'],
      where: {
        execution: { competitionId: input.competitionId, status: 'CONFIRMED' },
        pairingType: 'BYE',
        participantAId: { in: [...eligibleIds] },
      },
    });
    const byeCountByParticipant = new Map(
      byeCounts.map((entry) => [entry.participantAId, entry._count.participantAId]),
    );
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));
    const configuration = DrawConfiguration.create({
      actorId: input.actorId,
      competitionId: input.competitionId,
      formatCode: 'KNOCKOUT',
      groupCount: null,
      id: randomUUID(),
      occurredAt: input.occurredAt,
      participants: eligibleIds.map((id) => {
        const participant = participantById.get(id);
        if (participant === undefined) {
          throw new DomainError(
            'DRAW_CONFIGURATION_INCOMPATIBLE',
            'A next-round participant snapshot could not be reconstructed.',
          );
        }
        return {
          byeCount: byeCountByParticipant.get(id) ?? 0,
          displayName: participant.displayName,
          id: participant.id,
        };
      }),
      roundNumber: nextRoundNumber,
      ruleSetId: sourceExecution.configuration.ruleSetId,
    });
    configuration.freeze({
      actorId: input.actorId,
      expectedRevision: 1,
      occurredAt: input.occurredAt,
    });
    const snapshot = configuration.toSnapshot();

    await transaction.drawConfiguration.create({
      data: {
        algorithmVersion: snapshot.algorithmVersion,
        canonicalHash: snapshot.canonicalHash,
        competitionId: snapshot.competitionId,
        createdAt: snapshot.createdAt,
        createdById: snapshot.createdBy,
        formatCode: snapshot.formatCode,
        frozenAt: snapshot.frozenAt,
        frozenById: snapshot.frozenBy,
        groupCount: snapshot.groupCount,
        id: snapshot.id,
        participantCount: snapshot.participantCount,
        revision: snapshot.revision,
        roundNumber: snapshot.roundNumber,
        ruleSetId: snapshot.ruleSetId,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
        updatedById: snapshot.updatedBy,
      },
    });
    await transaction.drawConfigurationParticipant.createMany({
      data: snapshot.participants.map((participant, index) => ({
        byeCountSnapshot: participant.byeCount,
        canonicalOrder: index + 1,
        competitionId: snapshot.competitionId,
        competitionParticipantId: participant.id,
        configurationId: snapshot.id,
        displayNameSnapshot: participant.displayName,
      })),
    });

    const updatedCompetition = await transaction.competition.updateMany({
      data: {
        revision: input.expectedCompetitionRevision + 1,
        updatedAt: input.occurredAt,
        updatedById: input.actorId,
      },
      where: {
        id: input.competitionId,
        revision: input.expectedCompetitionRevision,
        status: 'LOCKED',
      },
    });
    if (updatedCompetition.count !== 1) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The competition revision changed during preparation.');
    }

    await transaction.auditEntry.create({
      data: {
        actionCode: 'NEXT_ROUND_CONFIGURATION_FROZEN',
        actorId: input.actorId,
        actorRole: input.actorRole,
        competitionId: input.competitionId,
        correlationId: input.correlationId,
        id: randomUUID(),
        metadata: {
          participantCount: snapshot.participantCount,
          roundNumber: snapshot.roundNumber,
          sourceExecutionId: sourceExecution.id,
        },
        resourceId: snapshot.id,
        resourceType: 'DRAW_CONFIGURATION',
        revisionAfter: snapshot.revision,
      },
    });

    return {
      competitionRevision: input.expectedCompetitionRevision + 1,
      configuration: snapshot,
    };
  }

  async #groupStageSource(
    transaction: Prisma.TransactionClient,
    executionId: string,
  ): Promise<NextRoundSource> {
    const groups = await transaction.drawGroup.findMany({
      include: {
        qualifications: {
          orderBy: { confirmedAt: 'desc' },
          take: 1,
          where: { status: 'CONFIRMED' },
        },
      },
      orderBy: { ordinal: 'asc' },
      where: { executionId },
    });
    return {
      groups: groups.map((group) => {
        const qualification = group.qualifications[0];
        return qualification === undefined
          ? { firstParticipantId: '', secondParticipantId: '', status: 'PENDING_CONFIRMATION' as const }
          : {
              firstParticipantId: qualification.firstParticipantId,
              secondParticipantId: qualification.secondParticipantId,
              status: 'CONFIRMED' as const,
            };
      }),
      kind: 'GROUP_STAGE',
    };
  }

  async #knockoutSource(
    transaction: Prisma.TransactionClient,
    executionId: string,
  ): Promise<NextRoundSource> {
    const [matches, byes] = await Promise.all([
      transaction.logicalMatch.findMany({
        orderBy: { ordinal: 'asc' },
        select: { status: true, winnerParticipantId: true },
        where: { executionId },
      }),
      transaction.drawPairing.findMany({
        orderBy: { ordinal: 'asc' },
        select: { participantAId: true },
        where: { executionId, pairingType: 'BYE' },
      }),
    ]);
    return {
      byeParticipantIds: byes.map((bye) => bye.participantAId),
      kind: 'KNOCKOUT',
      matches: matches.map((match) => ({
        status: match.status as 'PENDING_RESULT' | 'RESULT_PENDING' | 'RESULT_CONFIRMED' | 'RESULT_ANNULLED',
        winnerParticipantId: match.winnerParticipantId,
      })),
    };
  }
}
