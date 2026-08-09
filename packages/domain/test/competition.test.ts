import { describe, expect, it } from 'vitest';

import { Competition, DomainError, type CompetitionSnapshot } from '../src/index.js';

const key = Object.freeze({
  editionId: '10000000-0000-4000-8000-000000000001',
  eventId: '20000000-0000-4000-8000-000000000001',
  modalityId: '30000000-0000-4000-8000-000000000001',
  sportId: '40000000-0000-4000-8000-000000000001',
});
const actorA = '50000000-0000-4000-8000-000000000001';
const actorB = '50000000-0000-4000-8000-000000000002';
const createdAt = new Date('2026-08-06T12:00:00.000Z');

function createCompetition(): Competition {
  return Competition.create({
    actorId: actorA,
    id: '60000000-0000-4000-8000-000000000001',
    key,
    occurredAt: createdAt,
  });
}

function expectDomainError(operation: () => unknown, code: DomainError['code']): void {
  try {
    operation();
    expect.fail(`Expected domain error ${code}.`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) expect(error.code).toBe(code);
  }
}

describe('Competition', () => {
  it('creates an immutable draft snapshot at revision one', () => {
    const snapshot = createCompetition().toSnapshot();

    expect(snapshot).toMatchObject({
      createdBy: actorA,
      key,
      participants: [],
      revision: 1,
      status: 'DRAFT',
      updatedBy: actorA,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.key)).toBe(true);
    expect(Object.isFrozen(snapshot.participants)).toBe(true);
  });

  it('opens a draft and increments its revision', () => {
    const competition = createCompetition();

    competition.open({
      actorId: actorB,
      expectedRevision: 1,
      occurredAt: new Date('2026-08-06T12:05:00.000Z'),
    });

    expect(competition.toSnapshot()).toMatchObject({
      revision: 2,
      status: 'OPEN',
      updatedBy: actorB,
    });
  });

  it('adds and normalizes a participant in the same event', () => {
    const competition = createCompetition();

    competition.addParticipant({
      actorId: actorB,
      displayName: '  Colegio   Nacional  ',
      eventId: key.eventId,
      expectedRevision: 1,
      id: '70000000-0000-4000-8000-000000000001',
      institutionId: '80000000-0000-4000-8000-000000000001',
      occurredAt: new Date('2026-08-06T12:05:00.000Z'),
    });

    expect(competition.toSnapshot().participants).toEqual([
      expect.objectContaining({
        displayName: 'Colegio Nacional',
        eventId: key.eventId,
        revision: 1,
        status: 'ENABLED',
      }),
    ]);
    expect(competition.toSnapshot().revision).toBe(2);
  });

  it('rejects stale revisions without mutating state', () => {
    const competition = createCompetition();

    expectDomainError(
      () =>
        competition.open({
          actorId: actorB,
          expectedRevision: 2,
          occurredAt: createdAt,
        }),
      'CONCURRENCY_CONFLICT',
    );
    expect(competition.toSnapshot()).toMatchObject({ revision: 1, status: 'DRAFT' });
  });

  it('rejects a participant from another event', () => {
    const competition = createCompetition();

    expectDomainError(
      () =>
        competition.addParticipant({
          actorId: actorA,
          displayName: 'Universidad',
          eventId: '20000000-0000-4000-8000-000000000002',
          expectedRevision: 1,
          id: '70000000-0000-4000-8000-000000000001',
          institutionId: '80000000-0000-4000-8000-000000000001',
          occurredAt: createdAt,
        }),
      'COMPETITION_SCOPE_MISMATCH',
    );
  });

  it('rejects duplicate institutions', () => {
    const competition = createCompetition();
    const common = {
      actorId: actorA,
      displayName: 'Colegio',
      eventId: key.eventId,
      institutionId: '80000000-0000-4000-8000-000000000001',
      occurredAt: createdAt,
    } as const;

    competition.addParticipant({
      ...common,
      expectedRevision: 1,
      id: '70000000-0000-4000-8000-000000000001',
    });

    expectDomainError(
      () =>
        competition.addParticipant({
          ...common,
          expectedRevision: 2,
          id: '70000000-0000-4000-8000-000000000002',
        }),
      'DUPLICATE_PARTICIPANT',
    );
  });

  it.each(['', '   ', 'x'.repeat(121)])('rejects invalid display name', (displayName) => {
    const competition = createCompetition();

    expectDomainError(
      () =>
        competition.addParticipant({
          actorId: actorA,
          displayName,
          eventId: key.eventId,
          expectedRevision: 1,
          id: '70000000-0000-4000-8000-000000000001',
          institutionId: '80000000-0000-4000-8000-000000000001',
          occurredAt: createdAt,
        }),
      'INVALID_DISPLAY_NAME',
    );
  });

  it('rejects participant changes after locking', () => {
    const snapshot: CompetitionSnapshot = {
      ...createCompetition().toSnapshot(),
      formatCode: 'GROUP_STAGE',
      lockedAt: createdAt,
      lockedBy: actorA,
      status: 'LOCKED',
    };
    const competition = Competition.rehydrate(snapshot);

    expectDomainError(
      () =>
        competition.addParticipant({
          actorId: actorA,
          displayName: 'Colegio',
          eventId: key.eventId,
          expectedRevision: 1,
          id: '70000000-0000-4000-8000-000000000001',
          institutionId: '80000000-0000-4000-8000-000000000001',
          occurredAt: createdAt,
        }),
      'COMPETITION_NOT_EDITABLE',
    );
  });

  it('rejects invalid persisted scope, duplicates and revision', () => {
    const base = createCompetition().toSnapshot();
    const participant = {
      displayName: 'Colegio',
      enabledAt: createdAt,
      enabledBy: actorA,
      eventId: key.eventId,
      id: '70000000-0000-4000-8000-000000000001',
      institutionId: '80000000-0000-4000-8000-000000000001',
      revision: 1,
      status: 'ENABLED' as const,
    };

    expectDomainError(
      () => Competition.rehydrate({ ...base, revision: 0 }),
      'CONCURRENCY_CONFLICT',
    );
    expectDomainError(
      () =>
        Competition.rehydrate({
          ...base,
          participants: [{ ...participant, eventId: 'other-event' }],
        }),
      'COMPETITION_SCOPE_MISMATCH',
    );
    expectDomainError(
      () => Competition.rehydrate({ ...base, participants: [participant, participant] }),
      'DUPLICATE_PARTICIPANT',
    );
  });

  it('rejects opening a non-draft competition', () => {
    const competition = Competition.rehydrate({
      ...createCompetition().toSnapshot(),
      status: 'OPEN',
    });

    expectDomainError(
      () => competition.open({ actorId: actorA, expectedRevision: 1, occurredAt: createdAt }),
      'INVALID_COMPETITION_STATE',
    );
  });

  it('locks only when participants, frozen rules and frozen format match', () => {
    const competition = createCompetition();
    for (const [index, institutionId] of ['institution-1', 'institution-2', 'institution-3'].entries()) {
      competition.addParticipant({
        actorId: actorA,
        displayName: `Equipo ${String(index + 1)}`,
        eventId: key.eventId,
        expectedRevision: index + 1,
        id: `participant-${String(index + 1)}`,
        institutionId,
        occurredAt: createdAt,
      });
    }
    competition.open({ actorId: actorA, expectedRevision: 4, occurredAt: createdAt });
    competition.lock({
      actorId: actorB,
      drawConfiguration: {
        competitionId: competition.toSnapshot().id,
        formatCode: 'GROUP_STAGE',
        participantCount: 3,
        participants: [
          { byeCount: 0, displayName: 'Equipo 1', id: 'participant-1' },
          { byeCount: 0, displayName: 'Equipo 2', id: 'participant-2' },
          { byeCount: 0, displayName: 'Equipo 3', id: 'participant-3' },
        ],
        ruleSetId: 'rule-set-1',
        status: 'FROZEN',
      },
      expectedRevision: 5,
      occurredAt: createdAt,
      ruleSet: {
        competitionId: competition.toSnapshot().id,
        id: 'rule-set-1',
        status: 'FROZEN',
      },
    });

    expect(competition.toSnapshot()).toMatchObject({
      formatCode: 'GROUP_STAGE',
      lockedBy: actorB,
      revision: 6,
      status: 'LOCKED',
    });
  });

  it('rejects locking with a participant snapshot mismatch', () => {
    const competition = createCompetition();
    competition.open({ actorId: actorA, expectedRevision: 1, occurredAt: createdAt });
    expectDomainError(
      () =>
        competition.lock({
          actorId: actorA,
          drawConfiguration: {
            competitionId: competition.toSnapshot().id,
            formatCode: 'KNOCKOUT',
            participantCount: 2,
            participants: [
              { byeCount: 0, displayName: 'Equipo 1', id: 'participant-1' },
              { byeCount: 0, displayName: 'Equipo 2', id: 'participant-2' },
            ],
            ruleSetId: 'rule-set-1',
            status: 'FROZEN',
          },
          expectedRevision: 2,
          occurredAt: createdAt,
          ruleSet: {
            competitionId: competition.toSnapshot().id,
            id: 'rule-set-1',
            status: 'FROZEN',
          },
        }),
      'LOCK_PRECONDITION_FAILED',
    );
  });
});
