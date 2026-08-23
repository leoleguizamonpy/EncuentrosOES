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
  readonly tied: boolean;
  readonly wins: number;
}

type MutableRow = {
  -readonly [Key in keyof Omit<GroupTableRow, 'position' | 'tied'>]: Omit<
    GroupTableRow,
    'position' | 'tied'
  >[Key]
};

function outcomePoints(ruleSet: CompetitionRuleSetSnapshot, code: string): number {
  const outcome = ruleSet.outcomes.find((candidate) => candidate.code === code);
  if (outcome === undefined) {
    throw new DomainError('TABLE_CALCULATION_INVALID', `Outcome ${code} has no point value.`);
  }
  return outcome.tablePoints;
}

function resultPoints(result: MatchResultSnapshot, side: 'A' | 'B', ruleSet: CompetitionRuleSetSnapshot): number {
  const explicit = side === 'A' ? result.resolved.tablePointsA : result.resolved.tablePointsB;
  if (explicit !== undefined) return explicit;
  return outcomePoints(ruleSet, side === 'A' ? result.resolved.outcomeA : result.resolved.outcomeB);
}

function value(row: MutableRow, criterion: Exclude<TieBreakCriterion, 'HEAD_TO_HEAD_TABLE_POINTS'>): number {
  switch (criterion) {
    case 'TABLE_POINTS': return row.tablePoints;
    case 'WINS': return row.wins;
    case 'SCORE_DIFFERENCE': return row.scoreDifference;
    case 'SCORE_FOR': return row.scoreFor;
    case 'SETS_WON': return row.setsWon;
    case 'SET_DIFFERENCE': return row.setDifference;
    case 'SPORT_POINTS_FOR': return row.sportPointsFor;
    case 'SPORT_POINT_DIFFERENCE': return row.sportPointDifference;
  }
}

function headToHeadPoints(
  participantIds: readonly string[],
  results: readonly MatchResultSnapshot[],
  ruleSet: CompetitionRuleSetSnapshot,
): ReadonlyMap<string, number> {
  const participants = new Set(participantIds);
  const points = new Map(participantIds.map((participantId) => [participantId, 0]));
  for (const result of results) {
    if (
      result.status !== 'CONFIRMED' ||
      !participants.has(result.participantAId) ||
      !participants.has(result.participantBId)
    ) continue;
    points.set(result.participantAId, (points.get(result.participantAId) ?? 0) + resultPoints(result, 'A', ruleSet));
    points.set(result.participantBId, (points.get(result.participantBId) ?? 0) + resultPoints(result, 'B', ruleSet));
  }
  return points;
}

function splitByValue(
  rows: readonly MutableRow[],
  metric: (row: MutableRow) => number,
): readonly (readonly MutableRow[])[] {
  const buckets = new Map<number, MutableRow[]>();
  for (const row of rows) {
    const score = metric(row);
    const bucket = buckets.get(score) ?? [];
    bucket.push(row);
    buckets.set(score, bucket);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => right - left)
    .map(([, bucket]) => bucket);
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
    const sportingMetricsCounted = result.resolved.sportingMetricsCounted !== false;
    if (sportingMetricsCounted) {
      rowA.scoreFor += result.resolved.scoreA; rowA.scoreAgainst += result.resolved.scoreB;
      rowB.scoreFor += result.resolved.scoreB; rowB.scoreAgainst += result.resolved.scoreA;
      rowA.setsWon += result.resolved.setsWonA; rowA.setsLost += result.resolved.setsWonB;
      rowB.setsWon += result.resolved.setsWonB; rowB.setsLost += result.resolved.setsWonA;
      rowA.sportPointsFor += result.resolved.sportPointsA; rowA.sportPointsAgainst += result.resolved.sportPointsB;
      rowB.sportPointsFor += result.resolved.sportPointsB; rowB.sportPointsAgainst += result.resolved.sportPointsA;
    }
    rowA.tablePoints += resultPoints(result, 'A', ruleSet);
    rowB.tablePoints += resultPoints(result, 'B', ruleSet);
    if (result.resolved.draws) { rowA.draws += 1; rowB.draws += 1; }
    else {
      if (result.resolved.outcomeA === 'WIN') rowA.wins += 1;
      else rowA.losses += 1;
      if (result.resolved.outcomeB === 'WIN') rowB.wins += 1;
      else rowB.losses += 1;
    }
  }
  for (const row of rows.values()) {
    row.scoreDifference = row.scoreFor - row.scoreAgainst;
    row.setDifference = row.setsWon - row.setsLost;
    row.sportPointDifference = row.sportPointsFor - row.sportPointsAgainst;
  }
  let partitions: readonly (readonly MutableRow[])[] = [[...rows.values()]];
  const confirmedResults = results.filter(({ status }) => status === 'CONFIRMED');
  for (const criterion of ruleSet.tieBreakCriteria) {
    partitions = partitions.flatMap((partition) => {
      if (partition.length < 2) return [partition];
      if (criterion === 'HEAD_TO_HEAD_TABLE_POINTS') {
        const miniTable = headToHeadPoints(
          partition.map(({ participantId }) => participantId),
          confirmedResults,
          ruleSet,
        );
        return splitByValue(partition, ({ participantId }) => miniTable.get(participantId) ?? 0);
      }
      return splitByValue(partition, (row) => value(row, criterion));
    });
  }
  const ordered: GroupTableRow[] = [];
  for (const partition of partitions) {
    const position = ordered.length + 1;
    const tied = partition.length > 1;
    for (const row of [...partition].sort((left, right) => left.participantId.localeCompare(right.participantId))) {
      ordered.push(Object.freeze({ ...row, position, tied }));
    }
  }
  return Object.freeze(ordered);
}
