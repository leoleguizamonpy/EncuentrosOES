import { describe, expect, it } from 'vitest';

import {
  DomainError,
  groupLabel,
  planGroupDistribution,
} from '../src/index.js';

function expectDomainError(
  operation: () => unknown,
  code: DomainError['code'],
): void {
  try {
    operation();
    expect.fail(`Expected domain error ${code}.`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DomainError);

    if (error instanceof DomainError) {
      expect(error.code).toBe(code);
    }
  }
}

describe('planGroupDistribution', () => {
  it.each([
    { participants: 7, groups: 2, expected: [4, 3] },
    { participants: 9, groups: 3, expected: [3, 3, 3] },
    { participants: 11, groups: 3, expected: [4, 4, 3] },
    { participants: 12, groups: 3, expected: [4, 4, 4] },
  ])(
    'distributes $participants participants across $groups groups',
    ({ participants, groups, expected }) => {
      const plan = planGroupDistribution(participants, groups);

      expect(plan.groups.map(({ size }) => size)).toEqual(expected);
      expect(plan.groups.map(({ label }) => label)).toEqual(
        expected.map((_, index) => groupLabel(index)),
      );
    },
  );

  it('assigns additional places to A, B, C in that order', () => {
    const plan = planGroupDistribution(14, 4);

    expect(plan.groups).toEqual([
      { index: 0, label: 'A', size: 4 },
      { index: 1, label: 'B', size: 4 },
      { index: 2, label: 'C', size: 3 },
      { index: 3, label: 'D', size: 3 },
    ]);
  });

  it.each([
    { participants: 8, groups: 3 },
    { participants: 13, groups: 3 },
    { participants: 3, groups: 0 },
    { participants: 3, groups: 1.5 },
  ])('rejects invalid group counts: $participants / $groups', (input) => {
    expectDomainError(
      () => planGroupDistribution(input.participants, input.groups),
      'INVALID_GROUP_COUNT',
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid participant count %s',
    (participants) => {
      expectDomainError(
        () => planGroupDistribution(participants, 1),
        'INVALID_PARTICIPANT_COUNT',
      );
    },
  );

  it('returns immutable plans', () => {
    const plan = planGroupDistribution(7, 2);

    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.groups)).toBe(true);
    expect(plan.groups.every(Object.isFrozen)).toBe(true);
  });

  it('preserves all invariants for every valid plan up to 200 participants', () => {
    for (let participants = 3; participants <= 200; participants += 1) {
      for (let groups = 1; groups <= Math.floor(participants / 3); groups += 1) {
        if (participants > 4 * groups) continue;

        const plan = planGroupDistribution(participants, groups);
        const sizes: number[] = plan.groups.map(({ size }) => size);

        expect(sizes.reduce((total, size) => total + size, 0)).toBe(
          participants,
        );
        expect(sizes.every((size) => size === 3 || size === 4)).toBe(true);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

        const firstThree = sizes.indexOf(3);
        const lastFour = sizes.lastIndexOf(4);
        expect(firstThree === -1 || lastFour < firstThree).toBe(true);
      }
    }
  });
});

describe('groupLabel', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('maps index %i to %s', (index, expected) => {
    expect(groupLabel(index)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid index %s',
    (index) => {
      expect(() => groupLabel(index)).toThrow(RangeError);
    },
  );
});
