import { DomainError } from '../errors/domain-error.js';

export type GeneralChampionshipStatus = 'ACTIVE' | 'DRAFT' | 'FINALIZED';
export type GeneralContributionStatus = 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
export type GeneralContributionSourceType = 'COMPETITION_PLACEMENT' | 'SPECIAL';

export interface GeneralScoringRule {
  readonly label: string;
  readonly placement: number;
  readonly points: number;
}

export interface GeneralStandingContribution {
  readonly id: string;
  readonly institutionId: string;
  readonly points: number;
  readonly sourceType: GeneralContributionSourceType;
  readonly status: GeneralContributionStatus;
}

export interface GeneralStandingRow {
  readonly contributionCount: number;
  readonly institutionId: string;
  readonly placementContributionCount: number;
  readonly position: number;
  readonly specialContributionCount: number;
  readonly totalPoints: number;
  readonly tied: boolean;
}

export function validateGeneralScoringRules(input: readonly GeneralScoringRule[]): readonly GeneralScoringRule[] {
  if (input.length === 0) {
    throw new DomainError('GENERAL_SCORING_INVALID', 'General championship scoring requires at least one placement.');
  }

  const placements = new Set<number>();
  const normalized = input.map((rule) => {
    if (!Number.isInteger(rule.placement) || rule.placement < 1) {
      throw new DomainError('GENERAL_SCORING_INVALID', 'General championship placement must be a positive integer.');
    }
    if (!Number.isInteger(rule.points) || rule.points < 0) {
      throw new DomainError('GENERAL_SCORING_INVALID', 'General championship points must be a non-negative integer.');
    }
    const label = rule.label.trim();
    if (label.length < 1 || label.length > 80) {
      throw new DomainError('GENERAL_SCORING_INVALID', 'General championship scoring labels must contain between 1 and 80 characters.');
    }
    if (placements.has(rule.placement)) {
      throw new DomainError('GENERAL_SCORING_INVALID', 'General championship scoring cannot repeat a placement.');
    }
    placements.add(rule.placement);
    return { label, placement: rule.placement, points: rule.points } as const;
  }).sort((a, b) => a.placement - b.placement);

  for (let index = 1; index < normalized.length; index += 1) {
    const current = normalized.at(index);
    const previous = normalized.at(index - 1);
    if (current === undefined || previous === undefined) continue;
    if (current.points > previous.points) {
      throw new DomainError('GENERAL_SCORING_INVALID', 'A lower placement cannot award more points than a higher placement.');
    }
  }

  return normalized;
}

export function pointsForGeneralPlacement(rules: readonly GeneralScoringRule[], placement: number): number {
  const rule = rules.find((candidate) => candidate.placement === placement);
  if (rule === undefined) {
    throw new DomainError('GENERAL_PLACEMENT_INVALID', `Placement ${String(placement)} is not configured in the general championship scoring rules.`);
  }
  return rule.points;
}

export function deriveGeneralStandings(contributions: readonly GeneralStandingContribution[]): readonly GeneralStandingRow[] {
  const totals = new Map<string, { all: number; placement: number; special: number; total: number }>();
  for (const contribution of contributions) {
    if (contribution.status !== 'CONFIRMED') continue;
    if (!Number.isInteger(contribution.points) || contribution.points < 0) {
      throw new DomainError('GENERAL_CONTRIBUTION_INVALID', 'Confirmed general championship contributions require non-negative integer points.');
    }
    const current = totals.get(contribution.institutionId) ?? { all: 0, placement: 0, special: 0, total: 0 };
    current.all += 1;
    current.total += contribution.points;
    if (contribution.sourceType === 'COMPETITION_PLACEMENT') current.placement += 1;
    else current.special += 1;
    totals.set(contribution.institutionId, current);
  }

  const ordered = [...totals.entries()]
    .map(([institutionId, total]) => ({ institutionId, ...total }))
    .sort((a, b) => b.total - a.total || a.institutionId.localeCompare(b.institutionId));

  return ordered.map((entry, index) => {
    const previous = ordered.at(index - 1);
    const next = ordered.at(index + 1);
    const tied = previous?.total === entry.total || next?.total === entry.total;
    const firstSameTotalIndex = ordered.findIndex((candidate) => candidate.total === entry.total);
    const position = firstSameTotalIndex + 1;
    return {
      contributionCount: entry.all,
      institutionId: entry.institutionId,
      placementContributionCount: entry.placement,
      position,
      specialContributionCount: entry.special,
      tied,
      totalPoints: entry.total,
    } as const;
  });
}

export function deriveGeneralChampion(standings: readonly GeneralStandingRow[]): GeneralStandingRow {
  const first = standings.at(0);
  if (first === undefined) {
    throw new DomainError('GENERAL_FINALIZATION_INVALID', 'The general championship cannot be finalized without confirmed contributions.');
  }
  const second = standings.at(1);
  if (second !== undefined && second.totalPoints === first.totalPoints) {
    throw new DomainError('TIE_UNRESOLVED', 'The general championship cannot be finalized while first place is tied.');
  }
  return first;
}
