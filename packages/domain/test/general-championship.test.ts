import { describe, expect, it } from 'vitest';

import {
  deriveGeneralChampion,
  deriveGeneralStandings,
  pointsForGeneralPlacement,
  validateGeneralScoringRules,
} from '../src/index.js';

const rules = validateGeneralScoringRules([
  { label: 'Campeón', placement: 1, points: 100 },
  { label: 'Subcampeón', placement: 2, points: 70 },
  { label: 'Tercer lugar', placement: 3, points: 50 },
  { label: 'Cuarto lugar', placement: 4, points: 25 },
]);

describe('general championship scoring', () => {
  it('resolves placement points from a validated scoring table', () => {
    expect(pointsForGeneralPlacement(rules, 1)).toBe(100);
    expect(pointsForGeneralPlacement(rules, 4)).toBe(25);
  });

  it('rejects duplicate placements and inverted scoring', () => {
    expect(() => validateGeneralScoringRules([
      { label: 'Uno', placement: 1, points: 100 },
      { label: 'Otro uno', placement: 1, points: 70 },
    ])).toThrow(/repeat a placement/i);
    expect(() => validateGeneralScoringRules([
      { label: 'Uno', placement: 1, points: 70 },
      { label: 'Dos', placement: 2, points: 100 },
    ])).toThrow(/cannot award more points/i);
  });
});

describe('deriveGeneralStandings', () => {
  it('sums only confirmed contributions and keeps the ledger categories auditable', () => {
    const standings = deriveGeneralStandings([
      { id: 'futsal-m', institutionId: 'vasconsellos', points: 100, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED' },
      { id: 'futsal-f', institutionId: 'vasconsellos', points: 100, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED' },
      { id: 'voley-m', institutionId: 'vasconsellos', points: 70, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED' },
      { id: 'hinchada', institutionId: 'vasconsellos', points: 50, sourceType: 'SPECIAL', status: 'PENDING_CONFIRMATION' },
      { id: 'other', institutionId: 'san-juan', points: 250, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED' },
    ]);

    expect(standings).toEqual([
      {
        contributionCount: 3,
        institutionId: 'vasconsellos',
        placementContributionCount: 3,
        position: 1,
        specialContributionCount: 0,
        tied: false,
        totalPoints: 270,
      },
      {
        contributionCount: 1,
        institutionId: 'san-juan',
        placementContributionCount: 1,
        position: 2,
        specialContributionCount: 0,
        tied: false,
        totalPoints: 250,
      },
    ]);
  });

  it('uses competition ranking positions and marks tied totals without pretending to resolve them', () => {
    const standings = deriveGeneralStandings([
      { id: 'a', institutionId: 'a', points: 100, sourceType: 'SPECIAL', status: 'CONFIRMED' },
      { id: 'b', institutionId: 'b', points: 100, sourceType: 'SPECIAL', status: 'CONFIRMED' },
      { id: 'c', institutionId: 'c', points: 70, sourceType: 'SPECIAL', status: 'CONFIRMED' },
    ]);
    expect(standings.map(({ institutionId, position, tied }) => ({ institutionId, position, tied }))).toEqual([
      { institutionId: 'a', position: 1, tied: true },
      { institutionId: 'b', position: 1, tied: true },
      { institutionId: 'c', position: 3, tied: false },
    ]);
    expect(() => deriveGeneralChampion(standings)).toThrow(/first place is tied/i);
  });

  it('derives a unique champion from confirmed totals', () => {
    const standings = deriveGeneralStandings([
      { id: 'a', institutionId: 'vasconsellos', points: 270, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED' },
      { id: 'b', institutionId: 'san-juan', points: 240, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED' },
    ]);
    expect(deriveGeneralChampion(standings).institutionId).toBe('vasconsellos');
  });
});
