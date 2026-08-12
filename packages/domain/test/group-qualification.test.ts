import { describe, expect, it } from 'vitest';

import {
  DomainError,
  GroupQualification,
  type GroupTableRow,
} from '../src/index.js';

const occurredAt = new Date('2026-08-12T15:00:00.000Z');

function row(participantId: string, position: number, tied = false): GroupTableRow {
  return {
    draws: 0, losses: 0, participantId, played: 2, position,
    scoreAgainst: 0, scoreDifference: 0, scoreFor: 0,
    setDifference: 0, setsLost: 0, setsWon: 0,
    sportPointDifference: 0, sportPointsAgainst: 0, sportPointsFor: 0,
    tablePoints: 0, tied, wins: 0,
  };
}

function proposal(table: readonly GroupTableRow[] = [row('A', 1), row('B', 2), row('C', 3)]) {
  return GroupQualification.propose({
    actorId: 'admin-1', actorRole: 'ADMIN', competitionId: 'competition-1',
    groupId: 'group-1', id: 'qualification-1', occurredAt,
    sourceResultIds: ['result-3', 'result-1', 'result-2'],
    sourceRuleSetId: 'rules-1', table,
  });
}

function expectCode(operation: () => unknown, code: DomainError['code']): void {
  try { operation(); expect.fail(`Expected ${code}`); }
  catch (error: unknown) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) expect(error.code).toBe(code);
  }
}

describe('GroupQualification', () => {
  it('proposes exactly two participants with canonical source evidence', () => {
    expect(proposal().toSnapshot()).toMatchObject({
      firstParticipantId: 'A', secondParticipantId: 'B',
      sourceResultIds: ['result-1', 'result-2', 'result-3'],
      status: 'PENDING_CONFIRMATION', revision: 1,
    });
  });

  it('blocks a tie that crosses the qualification cut', () => {
    expectCode(
      () => proposal([row('A', 1), row('B', 2, true), row('C', 2, true)]),
      'TIE_UNRESOLVED',
    );
  });

  it('allows a tie entirely inside the two qualifying places', () => {
    expect(proposal([row('A', 1, true), row('B', 1, true), row('C', 3)])).toBeInstanceOf(GroupQualification);
  });

  it('requires another authority to confirm and preserves confirmation evidence', () => {
    const qualification = proposal();
    expectCode(() => qualification.confirm({
      actorId: 'admin-1', actorRole: 'ADMIN', expectedRevision: 1, occurredAt,
    }), 'QUALIFICATION_CONFIRMATION_INVALID');
    qualification.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    expect(qualification.toSnapshot()).toMatchObject({
      confirmedBy: 'admin-2', revision: 2, status: 'CONFIRMED',
    });
  });

  it('invalidates an active proposal when its source changes', () => {
    const qualification = proposal();
    qualification.invalidate({
      actorId: 'super-1', actorRole: 'SUPERADMIN', expectedRevision: 1,
      occurredAt, reason: ' Resultado de origen anulado ',
    });
    expect(qualification.toSnapshot()).toMatchObject({
      invalidationReason: 'Resultado de origen anulado', status: 'INVALIDATED', revision: 2,
    });
  });

  it('allows only a superadministrator to annul a confirmed proposal', () => {
    const qualification = proposal();
    qualification.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    expectCode(() => qualification.annul({
      actorId: 'admin-3', actorRole: 'ADMIN', expectedRevision: 2, occurredAt, reason: 'Error',
    }), 'QUALIFICATION_TRANSITION_INVALID');
    qualification.annul({
      actorId: 'super-1', actorRole: 'SUPERADMIN', expectedRevision: 2, occurredAt, reason: 'Error formal',
    });
    expect(qualification.toSnapshot()).toMatchObject({ status: 'ANNULLED', revision: 3 });
  });

  it('rejects stale transitions and inconsistent persisted evidence', () => {
    const qualification = proposal();
    expectCode(() => qualification.confirm({
      actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 2, occurredAt,
    }), 'CONCURRENCY_CONFLICT');
    const snapshot = qualification.toSnapshot();
    expect(() => GroupQualification.rehydrate(snapshot)).not.toThrow();
    expectCode(() => GroupQualification.rehydrate({ ...snapshot, status: 'CONFIRMED' }), 'QUALIFICATION_PROPOSAL_INVALID');
  });

  it('rejects incomplete sources, duplicate evidence and an empty authority', () => {
    expectCode(() => GroupQualification.propose({
      actorId: '', actorRole: 'ADMIN', competitionId: 'competition-1', groupId: 'group-1',
      id: 'qualification-1', occurredAt, sourceResultIds: ['result-1'],
      sourceRuleSetId: 'rules-1', table: [row('A', 1), row('B', 2), row('C', 3)],
    }), 'QUALIFICATION_AUTHORITY_INVALID');
    expectCode(() => GroupQualification.propose({
      actorId: 'admin-1', actorRole: 'ADMIN', competitionId: 'competition-1', groupId: 'group-1',
      id: 'qualification-1', occurredAt, sourceResultIds: ['result-1', 'result-1'],
      sourceRuleSetId: 'rules-1', table: [row('A', 1), row('B', 2), row('C', 3)],
    }), 'QUALIFICATION_PROPOSAL_INVALID');
    expectCode(() => proposal([row('A', 1), row('B', 2)]), 'QUALIFICATION_PROPOSAL_INVALID');
  });

  it('validates invalidation and annulment evidence during restoration', () => {
    const snapshot = proposal().toSnapshot();
    expectCode(() => GroupQualification.rehydrate({ ...snapshot, revision: 0 }), 'QUALIFICATION_PROPOSAL_INVALID');
    expectCode(() => GroupQualification.rehydrate({
      ...snapshot, status: 'INVALIDATED', invalidatedAt: occurredAt,
    }), 'QUALIFICATION_PROPOSAL_INVALID');
    expectCode(() => GroupQualification.rehydrate({
      ...snapshot, status: 'ANNULLED', confirmedAt: occurredAt, confirmedBy: 'admin-2',
    }), 'QUALIFICATION_PROPOSAL_INVALID');
  });

  it('can invalidate a confirmed proposal and restore its full evidence', () => {
    const qualification = proposal();
    qualification.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    qualification.invalidate({
      actorId: 'super-1', actorRole: 'SUPERADMIN', expectedRevision: 2,
      occurredAt, reason: 'Fuente reemplazada',
    });
    const snapshot = qualification.toSnapshot();
    expect(snapshot).toMatchObject({
      confirmedBy: 'admin-2', invalidatedBy: 'super-1', status: 'INVALIDATED', revision: 3,
    });
    expect(() => GroupQualification.rehydrate(snapshot)).not.toThrow();
    expectCode(() => qualification.invalidate({
      actorId: 'super-1', actorRole: 'SUPERADMIN', expectedRevision: 3,
      occurredAt, reason: 'Otra vez',
    }), 'QUALIFICATION_TRANSITION_INVALID');
  });

  it('requires a non-empty reason for official annulment', () => {
    const qualification = proposal();
    qualification.confirm({ actorId: 'admin-2', actorRole: 'ADMIN', expectedRevision: 1, occurredAt });
    expectCode(() => qualification.annul({
      actorId: 'super-1', actorRole: 'SUPERADMIN', expectedRevision: 2,
      occurredAt, reason: '   ',
    }), 'QUALIFICATION_TRANSITION_INVALID');
  });
});
