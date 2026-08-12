import { describe, expect, it } from 'vitest';

import {
  CompetitionRuleSet,
  DomainError,
  MatchResult,
  calculateGroupTable,
  type ResultDetail,
} from '../src/index.js';

const occurredAt = new Date('2026-08-12T12:00:00.000Z');

function rules(profile: 'SCORE_BASED' | 'SET_BASED' = 'SCORE_BASED') {
  const ruleSet = CompetitionRuleSet.create({
    actorId: 'admin-1', competitionId: 'competition-1', id: `rules-${profile}`,
    knockoutResolutionCode: profile === 'SCORE_BASED' ? 'HIGHER_SCORE' : 'MOST_SETS_WON',
    metrics: profile === 'SCORE_BASED'
      ? ['PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'TABLE_POINTS', 'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE']
      : ['PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SETS_WON', 'SETS_LOST', 'SET_DIFFERENCE', 'SPORT_POINTS_FOR', 'SPORT_POINTS_AGAINST', 'SPORT_POINT_DIFFERENCE'],
    occurredAt,
    outcomes: profile === 'SCORE_BASED'
      ? [{ code: 'WIN', description: 'Victoria', tablePoints: 3 }, { code: 'DRAW', description: 'Empate', tablePoints: 1 }, { code: 'LOSS', description: 'Derrota', tablePoints: 0 }]
      : [{ code: 'WIN', description: 'Victoria', tablePoints: 2 }, { code: 'LOSS', description: 'Derrota', tablePoints: 0 }],
    profileConfig: profile === 'SCORE_BASED'
      ? { allowDraws: true, profile: 'SCORE_BASED' }
      : { profile: 'SET_BASED', setsToWin: 2 },
    resultProfile: profile,
    revisionNumber: 1, schemaVersion: 1,
    tieBreakCriteria: profile === 'SCORE_BASED'
      ? ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE', 'SCORE_FOR']
      : ['TABLE_POINTS', 'WINS', 'SET_DIFFERENCE', 'SPORT_POINT_DIFFERENCE'],
  });
  ruleSet.freeze({ actorId: 'admin-1', expectedRevision: 1, occurredAt });
  return ruleSet.toSnapshot();
}

function record(id: string, a: string, b: string, detail: ResultDetail) {
  return MatchResult.record({
    actorId: 'admin-1', actorRole: 'ADMIN', detail, id, matchId: `match-${id}`,
    occurredAt, participantAId: a, participantBId: b,
    ruleSet: rules(detail.profile),
  });
}

function expectCode(operation: () => unknown, code: DomainError['code']): void {
  try { operation(); expect.fail(`Expected ${code}`); }
  catch (error: unknown) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) expect(error.code).toBe(code);
  }
}

describe('MatchResult and group table', () => {
  it('records a score, requires another authority and exposes the winner', () => {
    const result = record('1', 'A', 'B', { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 });
    expect(result.toSnapshot()).toMatchObject({
      resolved: { outcomeA: 'WIN', outcomeB: 'LOSS', winnerParticipantId: 'A' },
      status: 'PENDING_CONFIRMATION',
    });
    expectCode(() => result.confirm({ actorId: 'admin-1', actorRole: 'ADMIN', expectedRevision: 1, occurredAt }), 'RESULT_CONFIRMATION_INVALID');
    result.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    expect(result.toSnapshot()).toMatchObject({ confirmedBy: 'admin-2', revision: 2, status: 'CONFIRMED' });
  });

  it('validates set results and calculates set winner', () => {
    const result = record('sets', 'A', 'B', {
      profile: 'SET_BASED',
      sets: [{ pointsA: 25, pointsB: 20 }, { pointsA: 21, pointsB: 25 }, { pointsA: 15, pointsB: 11 }],
    });
    expect(result.toSnapshot().resolved).toMatchObject({ setsWonA: 2, setsWonB: 1, winnerParticipantId: 'A' });
    expectCode(() => record('bad-set', 'A', 'B', { profile: 'SET_BASED', sets: [{ pointsA: 25, pointsB: 25 }] }), 'RESULT_DETAIL_INVALID');
  });

  it('calculates standings only from confirmed results', () => {
    const first = record('1', 'A', 'B', { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 });
    const second = record('2', 'A', 'C', { profile: 'SCORE_BASED', scoreA: 1, scoreB: 1 });
    const pending = record('3', 'B', 'C', { profile: 'SCORE_BASED', scoreA: 9, scoreB: 0 });
    first.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    second.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    const table = calculateGroupTable(['A', 'B', 'C'], [first.toSnapshot(), second.toSnapshot(), pending.toSnapshot()], rules());
    expect(table).toMatchObject([
      { participantId: 'A', played: 2, tablePoints: 4, position: 1 },
      { participantId: 'C', played: 1, tablePoints: 1, position: 2 },
      { participantId: 'B', played: 1, tablePoints: 0, position: 3 },
    ]);
  });

  it('allows only superadministrator annulment and ignores annulled results in tables', () => {
    const result = record('1', 'A', 'B', { profile: 'SCORE_BASED', scoreA: 1, scoreB: 0 });
    result.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    expectCode(() => result.annul({ actorId: 'admin-3', actorRole: 'ADMIN', expectedRevision: 2, occurredAt, reason: 'Error' }), 'RESULT_ANNULMENT_INVALID');
    result.annul({ actorId: 'super-1', actorRole: 'SUPERADMIN', expectedRevision: 2, occurredAt, reason: ' Error formal ' });
    expect(result.toSnapshot()).toMatchObject({ annulmentReason: 'Error formal', status: 'ANNULLED' });
    expect(calculateGroupTable(['A', 'B'], [result.toSnapshot()], rules())).toMatchObject([
      { participantId: 'A', played: 0 }, { participantId: 'B', played: 0 },
    ]);
  });

  it('rejects incompatible, negative and incomplete result details', () => {
    expectCode(() => record('negative', 'A', 'B', { profile: 'SCORE_BASED', scoreA: -1, scoreB: 0 }), 'RESULT_DETAIL_INVALID');
    expectCode(() => MatchResult.record({
      actorId: 'admin-1', actorRole: 'ADMIN', detail: { profile: 'SET_BASED', sets: [] },
      id: 'x', matchId: 'x', occurredAt, participantAId: 'A', participantBId: 'B', ruleSet: rules(),
    }), 'RESULT_DETAIL_INVALID');
    expectCode(() => record('unfinished', 'A', 'B', { profile: 'SET_BASED', sets: [{ pointsA: 25, pointsB: 20 }] }), 'RESULT_DETAIL_INVALID');
  });

  it('calculates set metrics and rejects results outside the group', () => {
    const result = record('sets-table', 'A', 'B', {
      profile: 'SET_BASED',
      sets: [{ pointsA: 25, pointsB: 20 }, { pointsA: 25, pointsB: 23 }],
    });
    result.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    expect(calculateGroupTable(['A', 'B'], [result.toSnapshot()], rules('SET_BASED'))).toMatchObject([
      { participantId: 'A', setsWon: 2, setDifference: 2, sportPointsFor: 50, tablePoints: 2 },
      { participantId: 'B', setsLost: 2, setDifference: -2, sportPointsAgainst: 50, tablePoints: 0 },
    ]);
    expectCode(
      () => calculateGroupTable(['A', 'C'], [result.toSnapshot()], rules('SET_BASED')),
      'TABLE_CALCULATION_INVALID',
    );
  });

  it('rejects duplicate participants and stale result transitions', () => {
    expectCode(() => MatchResult.record({
      actorId: 'admin-1', actorRole: 'ADMIN',
      detail: { profile: 'SCORE_BASED', scoreA: 1, scoreB: 0 },
      id: 'duplicate', matchId: 'match-duplicate', occurredAt,
      participantAId: 'A', participantBId: 'A', ruleSet: rules(),
    }), 'RESULT_DETAIL_INVALID');
    const result = record('stale', 'A', 'B', { profile: 'SCORE_BASED', scoreA: 1, scoreB: 0 });
    expectCode(() => result.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 2, occurredAt }), 'CONCURRENCY_CONFLICT');
  });

  it('rehydrates valid results and detects persisted tampering', () => {
    const ruleSet = rules();
    const result = record('restore', 'A', 'B', { profile: 'SCORE_BASED', scoreA: 2, scoreB: 1 });
    const snapshot = result.toSnapshot();
    expect(() => MatchResult.rehydrate(snapshot, ruleSet)).not.toThrow();
    expectCode(() => MatchResult.rehydrate({ ...snapshot, revision: 0 }, ruleSet), 'RESULT_DETAIL_INVALID');
    expectCode(() => MatchResult.rehydrate({
      ...snapshot,
      resolved: { ...snapshot.resolved, winnerParticipantId: 'B' },
    }, ruleSet), 'RESULT_DETAIL_INVALID');
    expectCode(() => MatchResult.rehydrate({ ...snapshot, status: 'CONFIRMED' }, ruleSet), 'RESULT_DETAIL_INVALID');
  });

  it('fails explicitly instead of silently ignoring unsupported head-to-head mini-tables', () => {
    const base = rules();
    const withHeadToHead = {
      ...base,
      tieBreakCriteria: ['TABLE_POINTS', 'HEAD_TO_HEAD_TABLE_POINTS'] as const,
    };
    expectCode(
      () => calculateGroupTable(['A', 'B'], [], withHeadToHead),
      'TABLE_CALCULATION_INVALID',
    );
  });
});
