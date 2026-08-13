import { describe, expect, it } from 'vitest';

import {
  CompetitionRuleSet,
  DomainError,
  type CreateCompetitionRuleSetInput,
} from '../src/index.js';

const occurredAt = new Date('2026-08-06T12:00:00.000Z');
const baseInput: CreateCompetitionRuleSetInput = {
  actorId: '10000000-0000-4000-8000-000000000001',
  competitionId: '20000000-0000-4000-8000-000000000001',
  id: '30000000-0000-4000-8000-000000000001',
  knockoutResolutionCode: 'HIGHER_SCORE',
  metrics: ['PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'TABLE_POINTS', 'SCORE_DIFFERENCE'],
  occurredAt,
  outcomes: [
    { code: 'WIN', description: 'Victoria', tablePoints: 3 },
    { code: 'DRAW', description: 'Empate', tablePoints: 1 },
    { code: 'LOSS', description: 'Derrota', tablePoints: 0 },
  ],
  profileConfig: { allowDraws: true, profile: 'SCORE_BASED' },
  resultProfile: 'SCORE_BASED',
  revisionNumber: 1,
  schemaVersion: 1,
  tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'],
};

function expectCode(operation: () => unknown, code: DomainError['code']): void {
  try {
    operation();
    expect.fail(`Expected ${code}.`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) expect(error.code).toBe(code);
  }
}

describe('CompetitionRuleSet', () => {
  it('creates a complete editable score rule set', () => {
    expect(CompetitionRuleSet.create(baseInput).toSnapshot()).toMatchObject({
      canonicalHash: null,
      revision: 1,
      status: 'DRAFT',
    });
  });

  it('updates a draft with optimistic concurrency', () => {
    const ruleSet = CompetitionRuleSet.create(baseInput);
    ruleSet.update({
      ...baseInput,
      actorId: '10000000-0000-4000-8000-000000000002',
      expectedRevision: 1,
      outcomes: baseInput.outcomes.map((outcome) =>
        outcome.code === 'WIN' ? { ...outcome, tablePoints: 2 } : outcome,
      ),
    });
    expect(ruleSet.toSnapshot().revision).toBe(2);
    expect(ruleSet.toSnapshot().updatedBy).toBe(
      '10000000-0000-4000-8000-000000000002',
    );
  });

  it('freezes an immutable canonical snapshot', () => {
    const ruleSet = CompetitionRuleSet.create(baseInput);
    ruleSet.freeze({ actorId: baseInput.actorId, expectedRevision: 1, occurredAt });
    const snapshot = ruleSet.toSnapshot();

    expect(snapshot).toMatchObject({
      frozenBy: baseInput.actorId,
      revision: 2,
      status: 'FROZEN',
    });
    expect(snapshot.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => CompetitionRuleSet.rehydrate(snapshot)).not.toThrow();
    expectCode(
      () => ruleSet.update({ ...baseInput, expectedRevision: 2 }),
      'RULE_SET_FROZEN',
    );
  });

  it('detects tampering in a frozen snapshot', () => {
    const ruleSet = CompetitionRuleSet.create(baseInput);
    ruleSet.freeze({ actorId: baseInput.actorId, expectedRevision: 1, occurredAt });
    expectCode(
      () =>
        CompetitionRuleSet.rehydrate({
          ...ruleSet.toSnapshot(),
          outcomes: [{ code: 'WIN', description: 'Alterada', tablePoints: 99 }, ...baseInput.outcomes.slice(1)],
        }),
      'RULE_SET_INTEGRITY_FAILURE',
    );
  });

  it.each([
    {
      change: { tieBreakCriteria: ['WINS', 'TABLE_POINTS'] },
      code: 'RULE_SET_INCOMPLETE',
    },
    {
      change: { metrics: ['PLAYED', 'WINS', 'TABLE_POINTS'] },
      code: 'RULE_SET_INCOMPLETE',
    },
    {
      change: { tieBreakCriteria: ['TABLE_POINTS', 'SET_DIFFERENCE'] },
      code: 'TIE_BREAK_CRITERION_UNSUPPORTED',
    },
    {
      change: { outcomes: baseInput.outcomes.filter(({ code }) => code !== 'DRAW') },
      code: 'RULE_SET_INCOMPATIBLE',
    },
  ] as const)('rejects invalid configuration: $code', ({ change, code }) => {
    expectCode(
      () => CompetitionRuleSet.create({ ...baseInput, ...change } as CreateCompetitionRuleSetInput),
      code,
    );
  });

  it('supports a set-based template without score criteria', () => {
    const ruleSet = CompetitionRuleSet.create({
      ...baseInput,
      knockoutResolutionCode: 'MOST_SETS_WON',
      metrics: ['PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SET_DIFFERENCE', 'SETS_WON'],
      outcomes: [
        { code: 'WIN', description: 'Victoria', tablePoints: 3 },
        { code: 'LOSS', description: 'Derrota', tablePoints: 0 },
      ],
      profileConfig: { profile: 'SET_BASED', setsToWin: 3 },
      resultProfile: 'SET_BASED',
      tieBreakCriteria: ['TABLE_POINTS', 'SET_DIFFERENCE', 'SETS_WON'],
    });

    expect(ruleSet.toSnapshot().resultProfile).toBe('SET_BASED');
  });

  it('rejects variant-only outcomes until the result engine can derive them', () => {
    expectCode(
      () => CompetitionRuleSet.create({
        ...baseInput,
        knockoutResolutionCode: 'MOST_SETS_WON',
        metrics: ['PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SET_DIFFERENCE'],
        outcomes: [
          { code: 'WIN_VARIANT_3_0', description: 'Victoria 3-0', tablePoints: 3 },
          { code: 'LOSS_VARIANT_0_3', description: 'Derrota 0-3', tablePoints: 0 },
        ],
        profileConfig: { profile: 'SET_BASED', setsToWin: 3 },
        resultProfile: 'SET_BASED',
        tieBreakCriteria: ['TABLE_POINTS', 'SET_DIFFERENCE'],
      }),
      'RULE_SET_INCOMPLETE',
    );
  });

  it('rejects stale revisions and inconsistent freeze evidence', () => {
    const ruleSet = CompetitionRuleSet.create(baseInput);
    expectCode(
      () => ruleSet.freeze({ actorId: baseInput.actorId, expectedRevision: 2, occurredAt }),
      'CONCURRENCY_CONFLICT',
    );
    expectCode(
      () =>
        CompetitionRuleSet.rehydrate({
          ...ruleSet.toSnapshot(),
          canonicalHash: 'a'.repeat(64),
        }),
      'RULE_SET_INTEGRITY_FAILURE',
    );
  });
});
