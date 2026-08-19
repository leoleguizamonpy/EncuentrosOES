import { randomUUID } from 'node:crypto';

import { deriveChampionCandidate, DomainError, type ChampionCandidate } from '@oes/domain';

import type { Prisma, PrismaClient } from './generated/prisma/client.js';

export interface ProposePersistedChampionInput {
  readonly actorId: string;
  readonly actorRole: 'ADMIN' | 'SUPERADMIN';
  readonly competitionId: string;
  readonly correlationId: string;
  readonly expectedCompetitionRevision: number;
  readonly occurredAt: Date;
}

export interface ConfirmPersistedChampionInput extends ProposePersistedChampionInput {
  readonly proposalId: string;
}

export interface PersistedChampionView extends ChampionCandidate {
  readonly competitionId: string;
  readonly competitionRevision: number;
  readonly confirmedAt: Date | null;
  readonly confirmedBy: string | null;
  readonly participantDisplayName: string;
  readonly proposalId: string;
  readonly proposedAt: Date;
  readonly proposedBy: string;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

interface ChampionMetadata {
  participantId: string;
  participantDisplayName: string;
  sourceExecutionId: string;
  sourceMatchId: string;
  sourceResultId: string;
  sourceRoundNumber: number;
}

function metadata(value: Prisma.JsonValue): ChampionMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('INVALID_COMPETITION_STATE', 'Persisted champion evidence is invalid.');
  }
  const data = value as Record<string, Prisma.JsonValue>;
  const participantId = data.participantId;
  const participantDisplayName = data.participantDisplayName;
  const sourceExecutionId = data.sourceExecutionId;
  const sourceMatchId = data.sourceMatchId;
  const sourceResultId = data.sourceResultId;
  const sourceRoundNumber = data.sourceRoundNumber;
  if (
    typeof participantId !== 'string' ||
    typeof participantDisplayName !== 'string' ||
    typeof sourceExecutionId !== 'string' ||
    typeof sourceMatchId !== 'string' ||
    typeof sourceResultId !== 'string' ||
    typeof sourceRoundNumber !== 'number'
  ) {
    throw new DomainError('INVALID_COMPETITION_STATE', 'Persisted champion evidence is incomplete.');
  }
  return { participantId, participantDisplayName, sourceExecutionId, sourceMatchId, sourceResultId, sourceRoundNumber };
}

function metadataJson(value: ChampionMetadata): Prisma.InputJsonValue {
  return {
    participantDisplayName: value.participantDisplayName,
    participantId: value.participantId,
    sourceExecutionId: value.sourceExecutionId,
    sourceMatchId: value.sourceMatchId,
    sourceResultId: value.sourceResultId,
    sourceRoundNumber: value.sourceRoundNumber,
  };
}

export class PrismaChampionFinalizationService {
  public constructor(private readonly client: PrismaClient) {}

  public async propose(input: ProposePersistedChampionInput): Promise<PersistedChampionView> {
    return this.client.$transaction(
      (transaction) => this.proposeInTransaction(transaction, input),
      { isolationLevel: 'Serializable' },
    );
  }

  public async confirm(input: ConfirmPersistedChampionInput): Promise<PersistedChampionView> {
    return this.client.$transaction(
      (transaction) => this.confirmInTransaction(transaction, input),
      { isolationLevel: 'Serializable' },
    );
  }

  public async find(competitionId: string): Promise<PersistedChampionView | null> {
    const [competition, confirmation, proposal] = await Promise.all([
      this.client.competition.findUnique({ select: { revision: true }, where: { id: competitionId } }),
      this.client.auditEntry.findFirst({
        orderBy: { occurredAt: 'desc' },
        where: { actionCode: 'CHAMPION_CONFIRMED', competitionId },
      }),
      this.client.auditEntry.findFirst({
        orderBy: { occurredAt: 'desc' },
        where: { actionCode: 'CHAMPION_PROPOSED', competitionId },
      }),
    ]);
    if (competition === null || proposal === null) return null;
    return this.#view(competitionId, competition.revision, proposal, confirmation);
  }

  public async proposeInTransaction(
    transaction: Prisma.TransactionClient,
    input: ProposePersistedChampionInput,
  ): Promise<PersistedChampionView> {
    const competition = await transaction.competition.findUnique({
      select: { revision: true, status: true },
      where: { id: input.competitionId },
    });
    if (competition === null || competition.status !== 'LOCKED') {
      throw new DomainError('INVALID_COMPETITION_STATE', 'Only a locked competition can propose a champion.');
    }
    if (competition.revision !== input.expectedCompetitionRevision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
    }
    const existing = await transaction.auditEntry.findFirst({
      select: { id: true },
      where: { actionCode: { in: ['CHAMPION_PROPOSED', 'CHAMPION_CONFIRMED'] }, competitionId: input.competitionId },
    });
    if (existing !== null) {
      throw new DomainError('INVALID_COMPETITION_STATE', 'The competition already has a champion proposal.');
    }

    const execution = await transaction.officialDraw.findFirst({
      include: { configuration: true },
      orderBy: { confirmedAt: 'desc' },
      where: { competitionId: input.competitionId, status: 'CONFIRMED' },
    });
    if (execution === null || execution.configuration.formatCode !== 'KNOCKOUT') {
      throw new DomainError('INVALID_COMPETITION_STATE', 'A confirmed knockout final is required before proposing a champion.');
    }
    const [matches, byes] = await Promise.all([
      transaction.logicalMatch.findMany({
        include: { results: { orderBy: { confirmedAt: 'desc' }, take: 1, where: { status: 'CONFIRMED' } } },
        orderBy: { ordinal: 'asc' },
        where: { executionId: execution.id },
      }),
      transaction.drawPairing.findMany({
        select: { participantAId: true },
        where: { executionId: execution.id, pairingType: 'BYE' },
      }),
    ]);
    const candidate = deriveChampionCandidate({
      byeParticipantIds: byes.map(({ participantAId }) => participantAId),
      executionId: execution.id,
      formatCode: 'KNOCKOUT',
      matches: matches.map((match) => ({
        id: match.id,
        resultId: match.results[0]?.id ?? null,
        status: match.status as 'PENDING_RESULT' | 'RESULT_PENDING_CONFIRMATION' | 'RESULT_CONFIRMED' | 'RESULT_ANNULLED',
        winnerParticipantId: match.winnerParticipantId,
      })),
      roundNumber: execution.configuration.roundNumber,
    });
    const participant = await transaction.competitionParticipant.findFirst({
      select: { displayName: true, id: true },
      where: { competitionId: input.competitionId, id: candidate.participantId, status: 'ENABLED' },
    });
    if (participant === null) {
      throw new DomainError('INVALID_COMPETITION_STATE', 'The derived champion no longer belongs to the competition.');
    }

    const changed = await transaction.competition.updateMany({
      data: { revision: input.expectedCompetitionRevision + 1, updatedAt: input.occurredAt, updatedById: input.actorId },
      where: { id: input.competitionId, revision: input.expectedCompetitionRevision, status: 'LOCKED' },
    });
    if (changed.count !== 1) throw new DomainError('CONCURRENCY_CONFLICT', 'The competition changed while proposing the champion.');

    const proposalMetadata: ChampionMetadata = { ...candidate, participantDisplayName: participant.displayName };
    const proposal = await transaction.auditEntry.create({
      data: {
        actionCode: 'CHAMPION_PROPOSED',
        actorId: input.actorId,
        actorRole: input.actorRole,
        competitionId: input.competitionId,
        correlationId: input.correlationId,
        id: randomUUID(),
        metadata: metadataJson(proposalMetadata),
        resourceId: participant.id,
        resourceType: 'COMPETITION_CHAMPION',
        revisionAfter: input.expectedCompetitionRevision + 1,
        revisionBefore: input.expectedCompetitionRevision,
      },
    });
    return this.#view(input.competitionId, input.expectedCompetitionRevision + 1, proposal, null);
  }

  public async confirmInTransaction(
    transaction: Prisma.TransactionClient,
    input: ConfirmPersistedChampionInput,
  ): Promise<PersistedChampionView> {
    const [competition, proposal] = await Promise.all([
      transaction.competition.findUnique({
        select: { revision: true, status: true },
        where: { id: input.competitionId },
      }),
      transaction.auditEntry.findUnique({ where: { id: input.proposalId } }),
    ]);
    if (competition === null || competition.status !== 'LOCKED' || proposal === null || proposal.actionCode !== 'CHAMPION_PROPOSED' || proposal.competitionId !== input.competitionId) {
      throw new DomainError('INVALID_COMPETITION_STATE', 'A pending champion proposal for the locked competition is required.');
    }
    if (competition.revision !== input.expectedCompetitionRevision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
    }
    if (proposal.actorId === input.actorId) {
      throw new DomainError('INVALID_COMPETITION_STATE', 'The authority that proposed the champion cannot confirm the same proposal.');
    }
    const existingConfirmation = await transaction.auditEntry.findFirst({
      select: { id: true },
      where: { actionCode: 'CHAMPION_CONFIRMED', competitionId: input.competitionId },
    });
    if (existingConfirmation !== null) {
      throw new DomainError('INVALID_COMPETITION_STATE', 'The competition already has a confirmed champion.');
    }

    const evidence = metadata(proposal.metadata);
    const sourceResult = await transaction.matchResult.findFirst({
      select: { matchId: true, status: true, winnerParticipantId: true },
      where: { competitionId: input.competitionId, id: evidence.sourceResultId },
    });
    if (sourceResult === null || sourceResult.status !== 'CONFIRMED' || sourceResult.matchId !== evidence.sourceMatchId || sourceResult.winnerParticipantId !== evidence.participantId) {
      throw new DomainError('INVALID_COMPETITION_STATE', 'The final result no longer supports the proposed champion.');
    }

    const changed = await transaction.competition.updateMany({
      data: {
        finalizedAt: input.occurredAt,
        finalizedById: input.actorId,
        revision: input.expectedCompetitionRevision + 1,
        status: 'FINALIZED',
        updatedAt: input.occurredAt,
        updatedById: input.actorId,
      },
      where: { id: input.competitionId, revision: input.expectedCompetitionRevision, status: 'LOCKED' },
    });
    if (changed.count !== 1) throw new DomainError('CONCURRENCY_CONFLICT', 'The competition changed while confirming the champion.');

    const confirmation = await transaction.auditEntry.create({
      data: {
        actionCode: 'CHAMPION_CONFIRMED',
        actorId: input.actorId,
        actorRole: input.actorRole,
        competitionId: input.competitionId,
        correlationId: input.correlationId,
        id: randomUUID(),
        metadata: metadataJson(evidence),
        resourceId: evidence.participantId,
        resourceType: 'COMPETITION_CHAMPION',
        revisionAfter: input.expectedCompetitionRevision + 1,
        revisionBefore: input.expectedCompetitionRevision,
      },
    });
    return this.#view(input.competitionId, input.expectedCompetitionRevision + 1, proposal, confirmation);
  }

  #view(
    competitionId: string,
    competitionRevision: number,
    proposal: { actorId: string | null; id: string; metadata: Prisma.JsonValue; occurredAt: Date },
    confirmation: { actorId: string | null; occurredAt: Date } | null,
  ): PersistedChampionView {
    const evidence = metadata(proposal.metadata);
    if (proposal.actorId === null) throw new DomainError('INVALID_COMPETITION_STATE', 'Champion proposal authority is missing.');
    return {
      competitionId,
      competitionRevision,
      confirmedAt: confirmation?.occurredAt ?? null,
      confirmedBy: confirmation?.actorId ?? null,
      participantDisplayName: evidence.participantDisplayName,
      participantId: evidence.participantId,
      proposalId: proposal.id,
      proposedAt: proposal.occurredAt,
      proposedBy: proposal.actorId,
      sourceExecutionId: evidence.sourceExecutionId,
      sourceMatchId: evidence.sourceMatchId,
      sourceResultId: evidence.sourceResultId,
      sourceRoundNumber: evidence.sourceRoundNumber,
      status: confirmation === null ? 'PENDING_CONFIRMATION' : 'CONFIRMED',
    };
  }
}
