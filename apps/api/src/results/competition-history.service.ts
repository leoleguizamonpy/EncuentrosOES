import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';

export interface HistoryParticipantView {
  readonly displayName: string;
  readonly id: string;
}

export interface HistoryResultView {
  readonly annulledAt: string | null;
  readonly annulmentReason: string | null;
  readonly confirmedAt: string | null;
  readonly detail: unknown;
  readonly id: string;
  readonly recordedAt: string;
  readonly resolved: unknown;
  readonly status: 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
}

export interface HistoryMatchView {
  readonly groupLabel: string | null;
  readonly id: string;
  readonly ordinal: number;
  readonly participantA: HistoryParticipantView;
  readonly participantB: HistoryParticipantView;
  readonly results: readonly HistoryResultView[];
  readonly roundNumber: number;
  readonly status: string;
  readonly winnerParticipantId: string | null;
}

export interface HistoryStandingView {
  readonly draws: number;
  readonly losses: number;
  readonly participant: HistoryParticipantView;
  readonly played: number;
  readonly position: number;
  readonly scoreAgainst: number;
  readonly scoreDifference: number;
  readonly scoreFor: number;
  readonly setDifference: number;
  readonly setsLost: number;
  readonly setsWon: number;
  readonly sportPointDifference: number;
  readonly sportPointsAgainst: number;
  readonly sportPointsFor: number;
  readonly tablePoints: number;
  readonly tied: boolean;
  readonly wins: number;
}

export interface HistoryGroupView {
  readonly id: string;
  readonly label: string;
  readonly ordinal: number;
  readonly qualified: readonly HistoryParticipantView[];
  readonly standings: readonly HistoryStandingView[];
}

export interface HistoryByeView {
  readonly participant: HistoryParticipantView;
  readonly priorByeCount: number;
}

export interface HistoryExecutionView {
  readonly annulledAt: string | null;
  readonly annulmentReason: string | null;
  readonly confirmedAt: string | null;
  readonly executedAt: string;
  readonly formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
  readonly groups: readonly HistoryGroupView[];
  readonly id: string;
  readonly matches: readonly HistoryMatchView[];
  readonly publication: Readonly<{ id: string; publishedAt: string; verificationCode: string }> | null;
  readonly resultProfile: 'SCORE_BASED' | 'SET_BASED';
  readonly roundNumber: number;
  readonly status: 'ANNULLED' | 'CONFIRMED';
  readonly bye: HistoryByeView | null;
}

export interface CompetitionHistoryView {
  readonly competitionId: string;
  readonly executions: readonly HistoryExecutionView[];
}

function executionStatus(value: string): HistoryExecutionView['status'] {
  if (value === 'CONFIRMED' || value === 'ANNULLED') return value;
  throw new Error(`Unsupported historical draw status: ${value}`);
}

function formatCode(value: string): HistoryExecutionView['formatCode'] {
  if (value === 'GROUP_STAGE' || value === 'KNOCKOUT') return value;
  throw new Error(`Unsupported historical format: ${value}`);
}

function resultProfile(value: string): HistoryExecutionView['resultProfile'] {
  if (value === 'SCORE_BASED' || value === 'SET_BASED') return value;
  throw new Error(`Unsupported historical result profile: ${value}`);
}

function resultStatus(value: string): HistoryResultView['status'] {
  if (value === 'ANNULLED' || value === 'CONFIRMED' || value === 'PENDING_CONFIRMATION') return value;
  throw new Error(`Unsupported historical result status: ${value}`);
}

function byKey<T, K>(values: readonly T[], key: (value: T) => K): Map<K, T> {
  return new Map(values.map((value) => [key(value), value]));
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
export class CompetitionHistoryService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async history(competitionId: string): Promise<CompetitionHistoryView> {
    const competition = await this.client.competition.findUnique({ select: { id: true }, where: { id: competitionId } });
    if (competition === null) throw new NotFoundException('The competition does not exist.');

    const executions = await this.client.officialDraw.findMany({
      orderBy: { executedAt: 'asc' },
      where: { competitionId, status: { in: ['CONFIRMED', 'ANNULLED'] } },
    });
    if (executions.length === 0) return { competitionId, executions: [] };

    const executionIds = executions.map(({ id }) => id);
    const configurationIds = [...new Set(executions.map(({ configurationId }) => configurationId))];
    const configurations = await this.client.drawConfiguration.findMany({ where: { id: { in: configurationIds } } });
    const configurationById = byKey(configurations, ({ id }) => id);
    const ruleSetIds = [...new Set(configurations.map(({ ruleSetId }) => ruleSetId))];
    const ruleSets = await this.client.competitionRuleSet.findMany({
      select: { id: true, resultProfile: true },
      where: { competitionId, id: { in: ruleSetIds } },
    });
    const ruleSetById = byKey(ruleSets, ({ id }) => id);

    const groups = await this.client.drawGroup.findMany({ orderBy: { ordinal: 'asc' }, where: { executionId: { in: executionIds } } });
    const groupIds = groups.map(({ id }) => id);
    const matches = await this.client.logicalMatch.findMany({
      orderBy: [{ roundNumber: 'asc' }, { ordinal: 'asc' }],
      where: { executionId: { in: executionIds } },
    });
    const matchIds = matches.map(({ id }) => id);
    const standings = groupIds.length === 0 ? [] : await this.client.groupStanding.findMany({
      orderBy: [{ position: 'asc' }, { participantId: 'asc' }],
      where: { groupId: { in: groupIds } },
    });
    const qualifications = groupIds.length === 0 ? [] : await this.client.groupQualification.findMany({
      orderBy: { proposedAt: 'desc' },
      where: { groupId: { in: groupIds }, status: 'CONFIRMED' },
    });
    const results = matchIds.length === 0 ? [] : await this.client.matchResult.findMany({
      orderBy: { recordedAt: 'asc' },
      where: { matchId: { in: matchIds } },
    });
    const pairings = await this.client.drawPairing.findMany({
      orderBy: { ordinal: 'asc' },
      where: { executionId: { in: executionIds }, pairingType: 'BYE' },
    });
    const publications = await this.client.drawPublication.findMany({ where: { officialDrawId: { in: executionIds } } });

    const participantIds = new Set<string>();
    for (const match of matches) {
      participantIds.add(match.participantAId);
      participantIds.add(match.participantBId);
    }
    for (const standing of standings) participantIds.add(standing.participantId);
    for (const qualification of qualifications) {
      participantIds.add(qualification.firstParticipantId);
      participantIds.add(qualification.secondParticipantId);
    }
    for (const pairing of pairings) participantIds.add(pairing.participantAId);
    const participants = await this.client.competitionParticipant.findMany({
      select: { displayName: true, id: true },
      where: { competitionId, id: { in: [...participantIds] } },
    });
    const participantById = byKey(participants, ({ id }) => id);
    const participant = (id: string): HistoryParticipantView => {
      const value = participantById.get(id);
      if (value === undefined) throw new Error(`Historical participant ${id} does not exist.`);
      return value;
    };

    const groupsByExecution = groupedBy(groups, ({ executionId }) => executionId);
    const matchesByExecution = groupedBy(matches, ({ executionId }) => executionId);
    const standingsByGroup = groupedBy(standings, ({ groupId }) => groupId);
    const qualificationsByGroup = groupedBy(qualifications, ({ groupId }) => groupId);
    const resultsByMatch = groupedBy(results, ({ matchId }) => matchId);
    const byeByExecution = byKey(pairings, ({ executionId }) => executionId);
    const publicationByExecution = byKey(publications, ({ officialDrawId }) => officialDrawId);
    const groupById = byKey(groups, ({ id }) => id);

    const orderedExecutions = [...executions].sort((left, right) => {
      const leftConfiguration = configurationById.get(left.configurationId);
      const rightConfiguration = configurationById.get(right.configurationId);
      const roundDifference = (leftConfiguration?.roundNumber ?? 0) - (rightConfiguration?.roundNumber ?? 0);
      return roundDifference !== 0 ? roundDifference : left.executedAt.getTime() - right.executedAt.getTime();
    });

    return {
      competitionId,
      executions: orderedExecutions.map((execution): HistoryExecutionView => {
        const configuration = configurationById.get(execution.configurationId);
        if (configuration === undefined) throw new Error(`Historical configuration ${execution.configurationId} does not exist.`);
        const ruleSet = ruleSetById.get(configuration.ruleSetId);
        if (ruleSet === undefined) throw new Error(`Historical rule set ${configuration.ruleSetId} does not exist.`);
        const byePairing = byeByExecution.get(execution.id);
        const publication = publicationByExecution.get(execution.id);
        return {
          annulledAt: execution.annulledAt?.toISOString() ?? null,
          annulmentReason: execution.annulmentReason,
          bye: byePairing === undefined ? null : {
            participant: participant(byePairing.participantAId),
            priorByeCount: byePairing.priorByeCount ?? 0,
          },
          confirmedAt: execution.confirmedAt?.toISOString() ?? null,
          executedAt: execution.executedAt.toISOString(),
          formatCode: formatCode(configuration.formatCode),
          groups: (groupsByExecution.get(execution.id) ?? []).map((group): HistoryGroupView => {
            const qualification = (qualificationsByGroup.get(group.id) ?? [])[0];
            return {
              id: group.id,
              label: group.label,
              ordinal: group.ordinal,
              qualified: qualification === undefined ? [] : [
                participant(qualification.firstParticipantId),
                participant(qualification.secondParticipantId),
              ],
              standings: (standingsByGroup.get(group.id) ?? []).map((standing): HistoryStandingView => ({
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
          id: execution.id,
          matches: (matchesByExecution.get(execution.id) ?? []).map((match): HistoryMatchView => ({
            groupLabel: match.groupId === null ? null : groupById.get(match.groupId)?.label ?? null,
            id: match.id,
            ordinal: match.ordinal,
            participantA: participant(match.participantAId),
            participantB: participant(match.participantBId),
            results: (resultsByMatch.get(match.id) ?? []).map((result): HistoryResultView => ({
              annulledAt: result.annulledAt?.toISOString() ?? null,
              annulmentReason: result.annulmentReason,
              confirmedAt: result.confirmedAt?.toISOString() ?? null,
              detail: result.detailJson,
              id: result.id,
              recordedAt: result.recordedAt.toISOString(),
              resolved: result.resolvedJson,
              status: resultStatus(result.status),
            })),
            roundNumber: match.roundNumber,
            status: match.status,
            winnerParticipantId: match.winnerParticipantId,
          })),
          publication: publication === undefined ? null : {
            id: publication.id,
            publishedAt: publication.publishedAt.toISOString(),
            verificationCode: publication.verificationCode,
          },
          resultProfile: resultProfile(ruleSet.resultProfile),
          roundNumber: configuration.roundNumber,
          status: executionStatus(execution.status),
        };
      }),
    };
  }
}
