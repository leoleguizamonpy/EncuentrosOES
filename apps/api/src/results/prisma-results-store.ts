import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PrismaGroupQualificationService, PrismaMatchResultService, type PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  ResultsStoreError,
  type AnnulResultInput,
  type ConfirmResultInput,
  type ConfirmQualificationInput,
  type MatchResultView,
  type RecordResultInput,
  type ResultMatchView,
  type ResultParticipantView,
  type ResultsStore,
  type ResultsWorkspace,
  type StandingRowView,
} from './results-store.js';

function resultProfile(value: string): 'SCORE_BASED' | 'SET_BASED' {
  if (value === 'SCORE_BASED' || value === 'SET_BASED') return value;
  throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The frozen result profile is invalid.');
}

function competitionStatus(value: string): ResultsWorkspace['competitionStatus'] {
  if (value === 'DRAFT' || value === 'FINALIZED' || value === 'LOCKED' || value === 'OPEN') return value;
  throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The persisted competition status is invalid.');
}

function resultStatus(value: string): MatchResultView['status'] {
  if (value === 'CONFIRMED' || value === 'PENDING_CONFIRMATION') return value;
  throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The persisted result status is invalid.');
}

function matchStatus(value: string): ResultMatchView['status'] {
  if (value === 'PENDING_RESULT' || value === 'RESULT_CONFIRMED' || value === 'RESULT_PENDING_CONFIRMATION') return value;
  throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The persisted match status is invalid.');
}

function groupedBy<T, K>(values: readonly T[], key: (value: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const value of values) {
    const group = grouped.get(key(value));
    if (group === undefined) grouped.set(key(value), [value]);
    else group.push(value);
  }
  return grouped;
}

@Injectable()
export class PrismaResultsStore implements ResultsStore {
  readonly #groupQualificationService: PrismaGroupQualificationService;
  readonly #matchResultService: PrismaMatchResultService;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#groupQualificationService = new PrismaGroupQualificationService(client);
    this.#matchResultService = new PrismaMatchResultService(client);
  }

  public async confirmQualification(input: ConfirmQualificationInput): Promise<ResultsWorkspace> {
    const qualification = await this.client.groupQualification.findUnique({ select: { competitionId: true }, where: { id: input.qualificationId } });
    if (qualification === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The qualification does not exist.');
    await this.#assertMutable(qualification.competitionId);
    await this.#groupQualificationService.confirm({
      actorId: input.actorId,
      correlationId: input.correlationId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      occurredAt: new Date(),
      qualificationId: input.qualificationId,
    });
    return this.workspace(qualification.competitionId);
  }

  public async annul(input: AnnulResultInput): Promise<ResultsWorkspace> {
    const result = await this.client.matchResult.findUnique({ select: { competitionId: true }, where: { id: input.resultId } });
    if (result === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The result does not exist.');
    await this.#assertMutable(result.competitionId);
    await this.#matchResultService.annul({
      actorId: input.actorId,
      correlationId: input.correlationId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      occurredAt: new Date(),
      reason: input.reason,
      resultId: input.resultId,
    });
    return this.workspace(result.competitionId);
  }

  public async record(input: RecordResultInput): Promise<ResultsWorkspace> {
    const match = await this.client.logicalMatch.findUnique({ select: { competitionId: true }, where: { id: input.matchId } });
    if (match === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The match does not exist.');
    await this.#assertMutable(match.competitionId);
    await this.#matchResultService.record({
      actorId: input.actorId,
      correlationId: input.correlationId,
      detail: input.detail,
      idempotencyKey: input.idempotencyKey,
      matchId: input.matchId,
      occurredAt: new Date(),
      resultId: randomUUID(),
    });
    return this.workspace(match.competitionId);
  }

  public async confirm(input: ConfirmResultInput): Promise<ResultsWorkspace> {
    const result = await this.client.matchResult.findUnique({ select: { competitionId: true }, where: { id: input.resultId } });
    if (result === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The result does not exist.');
    await this.#assertMutable(result.competitionId);
    await this.#matchResultService.confirm({
      actorId: input.actorId,
      correlationId: input.correlationId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      occurredAt: new Date(),
      resultId: input.resultId,
    });
    return this.workspace(result.competitionId);
  }

  public async workspace(competitionId: string): Promise<ResultsWorkspace> {
    const competition = await this.client.competition.findUnique({ select: { status: true }, where: { id: competitionId } });
    if (competition === null) throw new ResultsStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');

    const execution = await this.client.officialDraw.findFirst({
      orderBy: { confirmedAt: 'desc' },
      select: { configurationId: true, id: true },
      where: { competitionId, status: 'CONFIRMED' },
    });
    if (execution === null) return {
      competitionId,
      competitionStatus: competitionStatus(competition.status),
      groups: [],
      matches: [],
      resultProfile: null,
    };

    const configuration = await this.client.drawConfiguration.findUnique({
      select: { ruleSetId: true },
      where: { id: execution.configurationId },
    });
    if (configuration === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The draw configuration does not exist.');
    const ruleSet = await this.client.competitionRuleSet.findUnique({
      select: { resultProfile: true },
      where: { competitionId_id: { competitionId, id: configuration.ruleSetId } },
    });
    if (ruleSet === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The frozen rule set does not exist.');

    const groups = await this.client.drawGroup.findMany({ orderBy: { ordinal: 'asc' }, where: { executionId: execution.id } });
    const matchesRaw = await this.client.logicalMatch.findMany({ orderBy: { ordinal: 'asc' }, where: { executionId: execution.id } });
    const groupIds = groups.map(({ id }) => id);
    const matchIds = matchesRaw.map(({ id }) => id);
    const standings = groupIds.length === 0 ? [] : await this.client.groupStanding.findMany({
      orderBy: [{ position: 'asc' }, { participantId: 'asc' }],
      where: { groupId: { in: groupIds } },
    });
    const qualifications = groupIds.length === 0 ? [] : await this.client.groupQualification.findMany({
      orderBy: { proposedAt: 'desc' },
      where: { groupId: { in: groupIds }, status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
    });
    const resultRecords = matchIds.length === 0 ? [] : await this.client.matchResult.findMany({
      orderBy: { recordedAt: 'desc' },
      where: { matchId: { in: matchIds }, status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
    });

    const participantIds = new Set<string>();
    for (const match of matchesRaw) {
      participantIds.add(match.participantAId);
      participantIds.add(match.participantBId);
    }
    for (const standing of standings) participantIds.add(standing.participantId);
    for (const qualification of qualifications) {
      participantIds.add(qualification.firstParticipantId);
      participantIds.add(qualification.secondParticipantId);
    }
    const participants = await this.client.competitionParticipant.findMany({
      select: { displayName: true, id: true },
      where: { competitionId, id: { in: [...participantIds] } },
    });
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));

    const userIds = new Set<string>();
    for (const result of resultRecords) {
      userIds.add(result.recordedById);
      if (result.confirmedById !== null) userIds.add(result.confirmedById);
    }
    for (const qualification of qualifications) {
      userIds.add(qualification.proposedById);
      if (qualification.confirmedById !== null) userIds.add(qualification.confirmedById);
    }
    const users = userIds.size === 0 ? [] : await this.client.user.findMany({
      select: { displayName: true, id: true },
      where: { id: { in: [...userIds] } },
    });
    const userById = new Map(users.map((user) => [user.id, user]));

    const participant = (id: string): ResultParticipantView => {
      const value = participantById.get(id);
      if (value === undefined) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', `Participant ${id} does not exist.`);
      return value;
    };
    const user = (id: string): ResultParticipantView => {
      const value = userById.get(id);
      if (value === undefined) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', `Authority ${id} does not exist.`);
      return value;
    };

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const standingsByGroup = groupedBy(standings, ({ groupId }) => groupId);
    const qualificationsByGroup = groupedBy(qualifications, ({ groupId }) => groupId);
    const resultsByMatch = groupedBy(resultRecords, ({ matchId }) => matchId);

    const matches = matchesRaw.map((match): ResultMatchView => {
      const record = (resultsByMatch.get(match.id) ?? [])[0];
      const result: MatchResultView | null = record === undefined ? null : {
        confirmedAt: record.confirmedAt?.toISOString() ?? null,
        confirmedBy: record.confirmedById === null ? null : user(record.confirmedById),
        detail: record.detailJson,
        id: record.id,
        recordedAt: record.recordedAt.toISOString(),
        recordedBy: user(record.recordedById),
        resolved: record.resolvedJson,
        revision: record.revision,
        status: resultStatus(record.status),
      };
      const group = match.groupId === null ? null : groupById.get(match.groupId);
      return {
        group: group === undefined || group === null ? null : { id: group.id, label: group.label },
        id: match.id,
        ordinal: match.ordinal,
        participantA: participant(match.participantAId),
        participantB: participant(match.participantBId),
        result,
        roundNumber: match.roundNumber,
        status: matchStatus(match.status),
        winnerParticipantId: match.winnerParticipantId,
      };
    });

    return {
      competitionId,
      competitionStatus: competitionStatus(competition.status),
      groups: groups.map((group) => {
        const groupMatches = matches.filter((match) => match.group?.id === group.id);
        const qualification = (qualificationsByGroup.get(group.id) ?? [])[0];
        return {
          complete: groupMatches.length > 0 && groupMatches.every((match) => match.status === 'RESULT_CONFIRMED'),
          id: group.id,
          label: group.label,
          ordinal: group.ordinal,
          qualification: qualification === undefined ? null : {
            confirmedAt: qualification.confirmedAt?.toISOString() ?? null,
            confirmedBy: qualification.confirmedById === null ? null : user(qualification.confirmedById),
            firstParticipant: participant(qualification.firstParticipantId),
            id: qualification.id,
            proposedAt: qualification.proposedAt.toISOString(),
            proposedBy: user(qualification.proposedById),
            revision: qualification.revision,
            secondParticipant: participant(qualification.secondParticipantId),
            status: qualification.status === 'CONFIRMED' ? 'CONFIRMED' as const : 'PENDING_CONFIRMATION' as const,
          },
          standings: (standingsByGroup.get(group.id) ?? []).map((standing): StandingRowView => ({
            draws: standing.draws,
            losses: standing.losses,
            participant: participant(standing.participantId),
            played: standing.played,
            position: standing.position,
            scoreAgainst: standing.scoreAgainst,
            scoreDifference: standing.scoreDifference,
            scoreFor: standing.scoreFor,
            setDifference: standing.setDifference,
            setsLost: standing.setsLost,
            setsWon: standing.setsWon,
            sportPointDifference: standing.sportPointDifference,
            sportPointsAgainst: standing.sportPointsAgainst,
            sportPointsFor: standing.sportPointsFor,
            tablePoints: standing.tablePoints,
            tied: standing.tied,
            wins: standing.wins,
          })),
        };
      }),
      matches,
      resultProfile: resultProfile(ruleSet.resultProfile),
    };
  }

  async #assertMutable(competitionId: string): Promise<void> {
    const competition = await this.client.competition.findUnique({
      select: { status: true },
      where: { id: competitionId },
    });
    if (competition === null) throw new ResultsStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    if (competition.status === 'FINALIZED') {
      throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'A finalized competition cannot modify results or classifications.');
    }
  }
}
