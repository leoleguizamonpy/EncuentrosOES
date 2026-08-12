import { DomainError } from '../errors/domain-error.js';
import type { CompetitionRuleSetSnapshot, TieBreakCriterion } from '../rules/competition-rule-set.js';
import type { MatchResultSnapshot } from './match-result.js';

export interface GroupTableRow {
  readonly draws: number;
  readonly losses: number;
  readonly participantId: string;
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
  readonly wins: number;
}

type MutableRow = { -readonly [Key in keyof Omit<GroupTableRow, 'position'>]: Omit<GroupTableRow, 'position'>[Key] };

function outcomePoints(ruleSet: CompetitionRuleSetSnapshot, code: string): number {
  const outcome = ruleSet.outcomes.find((candidate) => candidate.code === code);
  if (outcome === undefined) {
    throw new DomainError('TABLE_CALCULATION_INVALID', `Outcome ${code} has no point value.`);
  }
  return outcome.tablePoints;
}

function value(row: MutableRow, criterion: TieBreakCriterion): number {
  switch (criterion) {
    case 'TABLE_POINTS': return row.tablePoints;
    case 'WINS': return row.wins;
    case 'SCORE_DIFFERENCE': return row.scoreDifference;
    case 'SCORE_FOR': return row.scoreFor;
    case 'SETS_WON': return row.setsWon;
    case 'SET_DIFFERENCE': return row.setDifference;
    case 'SPORT_POINTS_FOR': return row.sportPointsFor;
    case 'SPORT_POINT_DIFFERENCE': return row.sportPointDifference;
    case 'HEAD_TO_HEAD_TABLE_POINTS':
      throw new DomainError(
        'TABLE_CALCULATION_INVALID',
        'Head-to-head mini-tables are not implemented yet.',
      );
  }
}

export function calculateGroupTable(
  participantIds: readonly string[],
  results: readonly MatchResultSnapshot[],
  ruleSet: CompetitionRuleSetSnapshot,
): readonly GroupTableRow[] {
  if (ruleSet.status !== 'FROZEN') {
    throw new DomainError('TABLE_CALCULATION_INVALID', 'Tables require frozen rules.');
  }
  const rows = new Map<string, MutableRow>();
  for (const participantId of participantIds) {
    rows.set(participantId, {
      draws: 0, losses: 0, participantId, played: 0,
      scoreAgainst: 0, scoreDifference: 0, scoreFor: 0,
      setDifference: 0, setsLost: 0, setsWon: 0,
      sportPointDifference: 0, sportPointsAgainst: 0, sportPointsFor: 0,
      tablePoints: 0, wins: 0,
    });
  }
  for (const result of results.filter(({ status }) => status === 'CONFIRMED')) {
    const rowA = rows.get(result.participantAId);
    const rowB = rows.get(result.participantBId);
    if (rowA === undefined || rowB === undefined || result.ruleSetId !== ruleSet.id) {
      throw new DomainError('TABLE_CALCULATION_INVALID', 'Confirmed result is outside this group or rule set.');
    }
    rowA.played += 1; rowB.played += 1;
    rowA.scoreFor += result.resolved.scoreA; rowA.scoreAgainst += result.resolved.scoreB;
    rowB.scoreFor += result.resolved.scoreB; rowB.scoreAgainst += result.resolved.scoreA;
    rowA.setsWon += result.resolved.setsWonA; rowA.setsLost += result.resolved.setsWonB;
    rowB.setsWon += result.resolved.setsWonB; rowB.setsLost += result.resolved.setsWonA;
    rowA.sportPointsFor += result.resolved.sportPointsA; rowA.sportPointsAgainst += result.resolved.sportPointsB;
    rowB.sportPointsFor += result.resolved.sportPointsB; rowB.sportPointsAgainst += result.resolved.sportPointsA;
    rowA.tablePoints += outcomePoints(ruleSet, result.resolved.outcomeA);
    rowB.tablePoints += outcomePoints(ruleSet, result.resolved.outcomeB);
    if (result.resolved.draws) { rowA.draws += 1; rowB.draws += 1; }
    else if (result.resolved.winnerParticipantId === result.participantAId) {
      rowA.wins += 1; rowB.losses += 1;
    } else { rowB.wins += 1; rowA.losses += 1; }
  }
  for (const row of rows.values()) {
    row.scoreDifference = row.scoreFor - row.scoreAgainst;
    row.setDifference = row.setsWon - row.setsLost;
    row.sportPointDifference = row.sportPointsFor - row.sportPointsAgainst;
  }
  const ordered = [...rows.values()].sort((left, right) => {
    for (const criterion of ruleSet.tieBreakCriteria) {
      const difference = value(right, criterion) - value(left, criterion);
      if (difference !== 0) return difference;
    }
    return left.participantId.localeCompare(right.participantId);
  });
  return Object.freeze(ordered.map((row, index) => Object.freeze({ ...row, position: index + 1 })));
}
