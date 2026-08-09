import { describe, expect, it } from 'vitest';

import {
  DomainError,
  DrawConfiguration,
  OfficialDraw,
  type AuthorityRole,
} from '../src/index.js';

const occurredAt = new Date('2026-08-09T18:00:00.000Z');
const seed = Uint8Array.from({ length: 32 }, (_, index) => index);

function frozenConfiguration(format: 'GROUP_STAGE' | 'KNOCKOUT' = 'GROUP_STAGE') {
  const common = {
    actorId: 'admin-1',
    competitionId: 'competition-1',
    id: `configuration-${format}`,
    occurredAt,
    participants: [
      { byeCount: 0, displayName: 'Uno', id: 'participant-1' },
      { byeCount: 0, displayName: 'Dos', id: 'participant-2' },
      { byeCount: 1, displayName: 'Tres', id: 'participant-3' },
    ],
    ruleSetId: 'rules-1',
  } as const;
  const configuration =
    format === 'GROUP_STAGE'
      ? DrawConfiguration.create({
          ...common,
          formatCode: 'GROUP_STAGE',
          groupCount: 1,
          roundNumber: 0,
        })
      : DrawConfiguration.create({
          ...common,
          formatCode: 'KNOCKOUT',
          groupCount: null,
          roundNumber: 1,
        });
  configuration.freeze({ actorId: 'admin-1', expectedRevision: 1, occurredAt });
  return configuration.toSnapshot();
}

function execute(format: 'GROUP_STAGE' | 'KNOCKOUT' = 'GROUP_STAGE') {
  return OfficialDraw.execute({
    actorId: 'admin-1',
    actorRole: 'ADMIN',
    competitionStatus: 'LOCKED',
    configuration: frozenConfiguration(format),
    id: `execution-${format}`,
    occurredAt,
    seed,
  });
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

describe('OfficialDraw', () => {
  it('executes a locked competition and persists reproducible evidence as pending', () => {
    const draw = execute();
    const snapshot = draw.toSnapshot();

    expect(snapshot).toMatchObject({
      competitionId: 'competition-1',
      executedBy: 'admin-1',
      revision: 1,
      status: 'PENDING_CONFIRMATION',
    });
    expect(snapshot.seedHex).toHaveLength(64);
    expect(() => OfficialDraw.rehydrate(snapshot, frozenConfiguration())).not.toThrow();
  });

  it('rejects execution before competition locking', () => {
    expectCode(
      () =>
        OfficialDraw.execute({
          actorId: 'admin-1',
          actorRole: 'ADMIN',
          competitionStatus: 'OPEN',
          configuration: frozenConfiguration(),
          id: 'execution-1',
          occurredAt,
          seed,
        }),
      'DRAW_EXECUTION_INVALID',
    );
  });

  it('requires a different administrator to confirm', () => {
    const draw = execute();
    expectCode(
      () =>
        draw.confirm({
          actorId: 'admin-1',
          actorRole: 'ADMIN',
          expectedRevision: 1,
          occurredAt,
        }),
      'DRAW_CONFIRMATION_INVALID',
    );
    draw.confirm({
      actorId: 'admin-2',
      actorRole: 'ADMIN',
      expectedRevision: 1,
      occurredAt,
    });
    expect(draw.toSnapshot()).toMatchObject({
      confirmedBy: 'admin-2',
      revision: 2,
      status: 'CONFIRMED',
    });
  });

  it.each(['ADMIN', 'SUPERADMIN'] as const)('accepts %s as an execution authority', (role) => {
    expect(
      OfficialDraw.execute({
        actorId: 'authority-1',
        actorRole: role,
        competitionStatus: 'LOCKED',
        configuration: frozenConfiguration('KNOCKOUT'),
        id: `execution-${role}`,
        occurredAt,
        seed,
      }).toSnapshot().evidence.result,
    ).toMatchObject({ formatCode: 'KNOCKOUT' });
  });

  it('allows only a superadministrator to annul a confirmed draw with a reason', () => {
    const draw = execute();
    draw.confirm({
      actorId: 'admin-2',
      actorRole: 'ADMIN',
      expectedRevision: 1,
      occurredAt,
    });
    expectCode(
      () =>
        draw.annul({
          actorId: 'admin-3',
          actorRole: 'ADMIN',
          expectedRevision: 2,
          occurredAt,
          reason: 'Error operativo',
        }),
      'DRAW_ANNULMENT_INVALID',
    );
    draw.annul({
      actorId: 'super-1',
      actorRole: 'SUPERADMIN',
      expectedRevision: 2,
      occurredAt,
      reason: '  Error   operativo  ',
    });
    expect(draw.toSnapshot()).toMatchObject({
      annulledBy: 'super-1',
      annulmentReason: 'Error operativo',
      revision: 3,
      status: 'ANNULLED',
    });
  });

  it('detects stale revisions and persisted evidence tampering', () => {
    const draw = execute();
    expectCode(
      () =>
        draw.confirm({
          actorId: 'admin-2',
          actorRole: 'ADMIN',
          expectedRevision: 2,
          occurredAt,
        }),
      'CONCURRENCY_CONFLICT',
    );
    expectCode(
      () =>
        OfficialDraw.rehydrate(
          { ...draw.toSnapshot(), seedHex: '0'.repeat(64) },
          frozenConfiguration(),
        ),
      'DRAW_EVIDENCE_INVALID',
    );
  });

  it('rejects unknown authority roles at the domain boundary', () => {
    expectCode(
      () =>
        OfficialDraw.execute({
          actorId: 'operator-1',
          actorRole: 'OPERATOR' as AuthorityRole,
          competitionStatus: 'LOCKED',
          configuration: frozenConfiguration(),
          id: 'execution-1',
          occurredAt,
          seed,
        }),
      'DRAW_AUTHORITY_INVALID',
    );
  });

  it('rejects incomplete persisted confirmation and annulment evidence', () => {
    const configuration = frozenConfiguration();
    const pending = execute().toSnapshot();
    expectCode(
      () =>
        OfficialDraw.rehydrate(
          { ...pending, status: 'CONFIRMED' },
          configuration,
        ),
      'DRAW_EXECUTION_INVALID',
    );
    const confirmed = execute();
    confirmed.confirm({
      actorId: 'admin-2',
      actorRole: 'ADMIN',
      expectedRevision: 1,
      occurredAt,
    });
    expectCode(
      () =>
        OfficialDraw.rehydrate(
          { ...confirmed.toSnapshot(), status: 'ANNULLED' },
          configuration,
        ),
      'DRAW_EXECUTION_INVALID',
    );
  });

  it('rejects malformed execution metadata and empty annulment reasons', () => {
    const configuration = frozenConfiguration();
    const snapshot = execute().toSnapshot();
    expectCode(
      () => OfficialDraw.rehydrate({ ...snapshot, revision: 0 }, configuration),
      'DRAW_EXECUTION_INVALID',
    );
    expectCode(
      () => OfficialDraw.rehydrate({ ...snapshot, seedHex: 'invalid' }, configuration),
      'DRAW_EXECUTION_INVALID',
    );
    expectCode(
      () =>
        OfficialDraw.execute({
          actorId: '',
          actorRole: 'ADMIN',
          competitionStatus: 'LOCKED',
          configuration,
          id: 'execution-1',
          occurredAt,
          seed,
        }),
      'DRAW_AUTHORITY_INVALID',
    );
    const confirmed = execute();
    confirmed.confirm({
      actorId: 'admin-2',
      actorRole: 'ADMIN',
      expectedRevision: 1,
      occurredAt,
    });
    expectCode(
      () =>
        confirmed.annul({
          actorId: 'super-1',
          actorRole: 'SUPERADMIN',
          expectedRevision: 2,
          occurredAt,
          reason: '   ',
        }),
      'DRAW_ANNULMENT_INVALID',
    );
  });
});
