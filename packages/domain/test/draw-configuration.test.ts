import { describe, expect, it } from 'vitest';

import { DomainError, DrawConfiguration } from '../src/index.js';

const common = {
  actorId: '10000000-0000-4000-8000-000000000001',
  competitionId: '20000000-0000-4000-8000-000000000001',
  id: '30000000-0000-4000-8000-000000000001',
  occurredAt: new Date('2026-08-06T12:00:00.000Z'),
  ruleSetId: '40000000-0000-4000-8000-000000000001',
} as const;

function participants(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    byeCount: 0,
    displayName: `Equipo ${String(index + 1)}`,
    id: `participant-${String(index + 1)}`,
  }));
}

function expectCode(operation: () => unknown, code: DomainError['code']): void {
  try {
    operation();
    expect.fail(`Expected ${code}.`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) expect(error.code).toBe(code);
  }
}

describe('DrawConfiguration', () => {
  it('creates a valid group configuration with manual group count', () => {
    expect(
      DrawConfiguration.create({
        ...common,
        formatCode: 'GROUP_STAGE',
        groupCount: 2,
        participants: participants(7),
        roundNumber: 0,
      }).toSnapshot(),
    ).toMatchObject({ groupCount: 2, status: 'DRAFT' });
  });

  it('rejects groups outside the three-to-four participant rule', () => {
    expectCode(
      () =>
        DrawConfiguration.create({
          ...common,
          formatCode: 'GROUP_STAGE',
          groupCount: 3,
          participants: participants(7),
          roundNumber: 0,
        }),
      'INVALID_GROUP_COUNT',
    );
  });

  it('creates knockout configuration without groups', () => {
    expect(
      DrawConfiguration.create({
        ...common,
        formatCode: 'KNOCKOUT',
        groupCount: null,
        participants: participants(5),
        roundNumber: 1,
      }).toSnapshot(),
    ).toMatchObject({ formatCode: 'KNOCKOUT', groupCount: null, roundNumber: 1 });
  });

  it('rejects invalid knockout rounds and participant counts', () => {
    expectCode(
      () =>
        DrawConfiguration.create({
          ...common,
          formatCode: 'KNOCKOUT',
          groupCount: null,
          participants: participants(1),
          roundNumber: 0,
        }),
      'DRAW_CONFIGURATION_INCOMPATIBLE',
    );
  });

  it.each([
    {
      description: 'duplicate identifier',
      participants: [
        { byeCount: 0, displayName: 'Uno', id: 'same' },
        { byeCount: 0, displayName: 'Dos', id: 'same' },
        { byeCount: 0, displayName: 'Tres', id: 'third' },
      ],
    },
    {
      description: 'empty name',
      participants: [
        { byeCount: 0, displayName: '', id: 'one' },
        { byeCount: 0, displayName: 'Dos', id: 'two' },
        { byeCount: 0, displayName: 'Tres', id: 'three' },
      ],
    },
    {
      description: 'negative bye history',
      participants: [
        { byeCount: -1, displayName: 'Uno', id: 'one' },
        { byeCount: 0, displayName: 'Dos', id: 'two' },
        { byeCount: 0, displayName: 'Tres', id: 'three' },
      ],
    },
  ] as const)(
    'rejects participant snapshots with $description',
    ({ participants: invalidParticipants }) => {
      expectCode(
        () =>
          DrawConfiguration.create({
            ...common,
            formatCode: 'GROUP_STAGE',
            groupCount: 1,
            participants: invalidParticipants,
            roundNumber: 0,
          }),
        'DRAW_CONFIGURATION_INCOMPATIBLE',
      );
    },
  );

  it('updates a draft and freezes a verifiable canonical snapshot', () => {
    const configuration = DrawConfiguration.create({
      ...common,
      formatCode: 'GROUP_STAGE',
      groupCount: 2,
      participants: participants(6),
      roundNumber: 0,
    });
    configuration.update({
      actorId: common.actorId,
      expectedRevision: 1,
      formatCode: 'GROUP_STAGE',
      groupCount: 2,
      occurredAt: common.occurredAt,
      participants: participants(7),
      roundNumber: 0,
    });
    configuration.freeze({
      actorId: common.actorId,
      expectedRevision: 2,
      occurredAt: common.occurredAt,
    });
    const snapshot = configuration.toSnapshot();

    expect(snapshot.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.status).toBe('FROZEN');
    expect(() => DrawConfiguration.rehydrate(snapshot)).not.toThrow();
    expectCode(
      () =>
        configuration.update({
          actorId: common.actorId,
          expectedRevision: 3,
          formatCode: 'GROUP_STAGE',
          groupCount: 2,
          occurredAt: common.occurredAt,
          participants: participants(8),
          roundNumber: 0,
        }),
      'DRAW_CONFIGURATION_FROZEN',
    );
  });

  it('detects stale revisions and tampering', () => {
    const configuration = DrawConfiguration.create({
      ...common,
      formatCode: 'KNOCKOUT',
      groupCount: null,
      participants: participants(4),
      roundNumber: 1,
    });
    expectCode(
      () =>
        configuration.freeze({
          actorId: common.actorId,
          expectedRevision: 2,
          occurredAt: common.occurredAt,
        }),
      'CONCURRENCY_CONFLICT',
    );
    configuration.freeze({
      actorId: common.actorId,
      expectedRevision: 1,
      occurredAt: common.occurredAt,
    });
    expectCode(
      () =>
        DrawConfiguration.rehydrate({
          ...configuration.toSnapshot(),
          participantCount: 6,
          participants: participants(6),
        }),
      'DRAW_CONFIGURATION_INTEGRITY_FAILURE',
    );
  });
});
