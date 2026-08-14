import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PrismaMatchResultService, type PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  ResultsStoreError,
  type ConfirmResultInput,
  type MatchResultView,
  type RecordResultInput,
  type ResultMatchView,
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

@Injectable()
export class PrismaResultsStore implements ResultsStore {
  readonly #matchResultService: PrismaMatchResultService;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#matchResultService = new PrismaMatchResultService(client);
  }

  public async record(input: RecordResultInput): Promise<ResultsWorkspace> {
    const match = await this.client.logicalMatch.findUnique({ select: { competitionId: true }, where: { id: input.matchId } });
    if (match === null) throw new ResultsStoreError('RESULTS_INTEGRITY_FAILURE', 'The match does not exist.');
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
    const competition = await this.client.competition.findUnique({
      include: {
        officialDraws: {
          include: {
            configuration: { include: { ruleSet: true } },
            groups: {
              include: {
                standings: { include: { participant: true }, orderBy: [{ position: 'asc' }, { participantId: 'asc' }] },
              },
              orderBy: { ordinal: 'asc' },
            },
            matches: {
              include: {
                group: true,
                participantA: true,
                participantB: true,
                results: {
                  include: { confirmedBy: true, recordedBy: true },
                  orderBy: { recordedAt: 'desc' },
                  take: 1,
                  where: { status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
                },
              },
              orderBy: { ordinal: 'asc' },
            },
          },
          orderBy: { confirmedAt: 'desc' },
          take: 1,
          where: { status: 'CONFIRMED' },
        },
      },
      where: { id: competitionId },
    });
    if (competition === null) throw new ResultsStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    const execution = competition.officialDraws[0];
    if (execution === undefined) return {
      competitionId,
      competitionStatus: competitionStatus(competition.status),
      groups: [],
      matches: [],
      resultProfile: null,
    };
    const matches = execution.matches.map((match): ResultMatchView => {
      const record = match.results[0];
      const result: MatchResultView | null = record === undefined ? null : {
        confirmedAt: record.confirmedAt?.toISOString() ?? null,
        confirmedBy: record.confirmedBy === null ? null : { displayName: record.confirmedBy.displayName, id: record.confirmedBy.id },
        detail: record.detailJson,
        id: record.id,
        recordedAt: record.recordedAt.toISOString(),
        recordedBy: { displayName: record.recordedBy.displayName, id: record.recordedBy.id },
        resolved: record.resolvedJson,
        revision: record.revision,
        status: resultStatus(record.status),
      };
      return {
        group: match.group === null ? null : { id: match.group.id, label: match.group.label },
        id: match.id,
        ordinal: match.ordinal,
        participantA: { displayName: match.participantA.displayName, id: match.participantA.id },
        participantB: { displayName: match.participantB.displayName, id: match.participantB.id },
        result,
        roundNumber: match.roundNumber,
        status: matchStatus(match.status),
        winnerParticipantId: match.winnerParticipantId,
      };
    });
    return {
      competitionId,
      competitionStatus: competitionStatus(competition.status),
      groups: execution.groups.map((group) => {
        const groupMatches = matches.filter((match) => match.group?.id === group.id);
        return {
          complete: groupMatches.length > 0 && groupMatches.every((match) => match.status === 'RESULT_CONFIRMED'),
          id: group.id,
          label: group.label,
          ordinal: group.ordinal,
          standings: group.standings.map((standing): StandingRowView => ({
            draws: standing.draws,
            losses: standing.losses,
            participant: { displayName: standing.participant.displayName, id: standing.participant.id },
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
      resultProfile: resultProfile(execution.configuration.ruleSet.resultProfile),
    };
  }
}
