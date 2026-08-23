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

@Injectable()
export class CompetitionHistoryService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async history(competitionId: string): Promise<CompetitionHistoryView> {
    const competition = await this.client.competition.findUnique({
      include: {
        officialDraws: {
          include: {
            configuration: { include: { ruleSet: true } },
            groups: {
              include: {
                qualifications: {
                  include: { firstParticipant: true, secondParticipant: true },
                  orderBy: { proposedAt: 'desc' },
                },
                standings: {
                  include: { participant: true },
                  orderBy: [{ position: 'asc' }, { participantId: 'asc' }],
                },
              },
              orderBy: { ordinal: 'asc' },
            },
            matches: {
              include: {
                group: true,
                participantA: true,
                participantB: true,
                results: { orderBy: { recordedAt: 'asc' } },
              },
              orderBy: [{ roundNumber: 'asc' }, { ordinal: 'asc' }],
            },
            pairings: {
              include: { participantA: true },
              orderBy: { ordinal: 'asc' },
            },
            publication: true,
          },
          orderBy: [{ configuration: { roundNumber: 'asc' } }, { executedAt: 'asc' }],
          where: { status: { in: ['CONFIRMED', 'ANNULLED'] } },
        },
      },
      where: { id: competitionId },
    });

    if (competition === null) throw new NotFoundException('The competition does not exist.');

    return {
      competitionId,
      executions: competition.officialDraws.map((execution): HistoryExecutionView => {
        const byePairing = execution.pairings.find((pairing) => pairing.pairingType === 'BYE');
        return {
          annulledAt: execution.annulledAt?.toISOString() ?? null,
          annulmentReason: execution.annulmentReason,
          bye: byePairing === undefined ? null : {
            participant: { displayName: byePairing.participantA.displayName, id: byePairing.participantA.id },
            priorByeCount: byePairing.priorByeCount ?? 0,
          },
          confirmedAt: execution.confirmedAt?.toISOString() ?? null,
          executedAt: execution.executedAt.toISOString(),
          formatCode: formatCode(execution.configuration.formatCode),
          groups: execution.groups.map((group): HistoryGroupView => {
            const qualification = group.qualifications.find((candidate) => candidate.status === 'CONFIRMED');
            return {
              id: group.id,
              label: group.label,
              ordinal: group.ordinal,
              qualified: qualification === undefined ? [] : [
                { displayName: qualification.firstParticipant.displayName, id: qualification.firstParticipant.id },
                { displayName: qualification.secondParticipant.displayName, id: qualification.secondParticipant.id },
              ],
              standings: group.standings.map((standing): HistoryStandingView => ({
                draws: standing.draws,
                losses: standing.losses,
                participant: { displayName: standing.participant.displayName, id: standing.participant.id },
                played: standing.played,
                position: standing.position,
                scoreAgainst: standing.scoreAgainst,
                scoreDifference: standing.scoreDifference,
                scoreFor: standing.scoreFor,
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
          matches: execution.matches.map((match): HistoryMatchView => ({
            groupLabel: match.group?.label ?? null,
            id: match.id,
            ordinal: match.ordinal,
            participantA: { displayName: match.participantA.displayName, id: match.participantA.id },
            participantB: { displayName: match.participantB.displayName, id: match.participantB.id },
            results: match.results.map((result): HistoryResultView => ({
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
          publication: execution.publication === null ? null : {
            id: execution.publication.id,
            publishedAt: execution.publication.publishedAt.toISOString(),
            verificationCode: execution.publication.verificationCode,
          },
          resultProfile: resultProfile(execution.configuration.ruleSet.resultProfile),
          roundNumber: execution.configuration.roundNumber,
          status: executionStatus(execution.status),
        };
      }),
    };
  }
}
