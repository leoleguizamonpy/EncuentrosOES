import { describe, expect, it } from 'vitest';

import {
  CompetitionRuleSet,
  DrawConfiguration,
  GroupQualification,
  MatchResult,
  OfficialDraw,
  type GroupTableRow,
} from '../src/index.js';

const occurredAt = new Date('2026-08-22T15:30:00.000Z');

function frozenDrawConfiguration() {
  const configuration = DrawConfiguration.create({
    actorId: 'super-1',
    competitionId: 'competition-1',
    formatCode: 'KNOCKOUT',
    groupCount: null,
    id: 'configuration-1',
    occurredAt,
    participants: [
      { byeCount: 0, displayName: 'Uno', id: 'participant-1' },
      { byeCount: 0, displayName: 'Dos', id: 'participant-2' },
    ],
    roundNumber: 1,
    ruleSetId: 'rules-1',
  });
  configuration.freeze({ actorId: 'super-1', expectedRevision: 1, occurredAt });
  return configuration.toSnapshot();
}

function frozenRuleSet() {
  const ruleSet = CompetitionRuleSet.create({
    actorId: 'super-1',
    competitionId: 'competition-1',
    id: 'rules-1',
    knockoutResolutionCode: 'HIGHER_SCORE',
    metrics: ['PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'TABLE_POINTS', 'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE'],
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
    tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE', 'SCORE_FOR'],
  });
  ruleSet.freeze({ actorId: 'super-1', expectedRevision: 1, occurredAt });
  return ruleSet.toSnapshot();
}

function row(participantId: string, position: number): GroupTableRow {
  return {
    draws: 0,
    losses: 0,
    participantId,
    played: 2,
    position,
    scoreAgainst: 0,
    scoreDifference: 0,
    scoreFor: 0,
    setDifference: 0,
    setsLost: 0,
    setsWon: 0,
    sportPointDifference: 0,
    sportPointsAgainst: 0,
    sportPointsFor: 0,
    tablePoints: 0,
    tied: false,
    wins: 0,
  };
}

describe('SUPERADMIN single-authority mode', () => {
  it('can execute and explicitly confirm the same official draw', () => {
    const draw = OfficialDraw.execute({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      competitionStatus: 'LOCKED',
      configuration: frozenDrawConfiguration(),
      id: 'execution-1',
      occurredAt,
      seed: Uint8Array.from({ length: 32 }, (_, index) => index),
    });

    draw.confirm({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      expectedRevision: 1,
      occurredAt,
    });

    expect(draw.toSnapshot()).toMatchObject({
      confirmedBy: 'super-1',
      executedBy: 'super-1',
      revision: 2,
      status: 'CONFIRMED',
    });
  });

  it('can record and explicitly confirm the same match result', () => {
    const result = MatchResult.record({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 },
      id: 'result-1',
      matchId: 'match-1',
      occurredAt,
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      ruleSet: frozenRuleSet(),
    });

    result.confirm({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      expectedRevision: 1,
      occurredAt,
    });

    expect(result.toSnapshot()).toMatchObject({
      confirmedBy: 'super-1',
      recordedBy: 'super-1',
      revision: 2,
      status: 'CONFIRMED',
    });
  });

  it('can propose and explicitly confirm the same group qualification', () => {
    const qualification = GroupQualification.propose({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      competitionId: 'competition-1',
      groupId: 'group-1',
      id: 'qualification-1',
      occurredAt,
      sourceResultIds: ['result-1', 'result-2', 'result-3'],
      sourceRuleSetId: 'rules-1',
      table: [row('participant-1', 1), row('participant-2', 2), row('participant-3', 3)],
    });

    qualification.confirm({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      expectedRevision: 1,
      occurredAt,
    });

    expect(qualification.toSnapshot()).toMatchObject({
      confirmedBy: 'super-1',
      proposedBy: 'super-1',
      revision: 2,
      status: 'CONFIRMED',
    });
  });
});
