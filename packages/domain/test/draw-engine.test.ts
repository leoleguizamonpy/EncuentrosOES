import { describe, expect, it } from 'vitest';

import {
  DrawConfiguration,
  DomainError,
  commitOfficialSeed,
  executeOfficialDraw,
  generateOfficialSeed,
  verifyOfficialDraw,
} from '../src/index.js';

const seed = Uint8Array.from({ length: 32 }, (_, index) => index);
const common = {
  actorId: 'actor-1',
  competitionId: 'competition-1',
  occurredAt: new Date('2026-08-06T12:00:00.000Z'),
  ruleSetId: 'rule-set-1',
} as const;

function participants(count: number, byeCounts: readonly number[] = []) {
  return Array.from({ length: count }, (_, index) => ({
    byeCount: byeCounts[index] ?? 0,
    displayName: `Equipo ${String(index + 1)}`,
    id: `P${String(index + 1).padStart(2, '0')}`,
  }));
}

function frozenGroup() {
  const configuration = DrawConfiguration.create({
    ...common,
    formatCode: 'GROUP_STAGE',
    groupCount: 2,
    id: 'draw-groups',
    participants: participants(7),
    roundNumber: 0,
  });
  configuration.freeze({ actorId: common.actorId, expectedRevision: 1, occurredAt: common.occurredAt });
  return configuration.toSnapshot();
}

function frozenKnockout() {
  const configuration = DrawConfiguration.create({
    ...common,
    formatCode: 'KNOCKOUT',
    groupCount: null,
    id: 'draw-knockout',
    participants: participants(5, [1, 0, 0, 2, 0]),
    roundNumber: 2,
  });
  configuration.freeze({ actorId: common.actorId, expectedRevision: 1, occurredAt: common.occurredAt });
  return configuration.toSnapshot();
}

describe('oes-draw-v1', () => {
  it('reproduces the same groups and evidence from the same seed', () => {
    const configuration = frozenGroup();
    const first = executeOfficialDraw(configuration, seed);
    const second = executeOfficialDraw(configuration, seed);

    expect(first).toEqual(second);
    expect(first.result).toMatchObject({
      formatCode: 'GROUP_STAGE',
      groups: [
        { label: 'A', members: ['P04', 'P07', 'P01', 'P06'], ordinal: 1 },
        { label: 'B', members: ['P02', 'P03', 'P05'], ordinal: 2 },
      ],
    });
    expect(first).toMatchObject({
      configurationHash: '9708561cd5e0c60908241ce6566a270b7ce6eb52ba5af5007e0791bc8f2fb52e',
      evidenceHash: '9932e688984d65857551934f3edf8066e7b6eca8a58965f86f1d8ab1925e5cc6',
      resultHash: 'ac84536fcb534714b0d70c759533b4b9cdbbcfb703692ddc28d98973094a79c9',
      seedCommitment: '3d8e699483b15e351f49bc6aafe3b41548be0fc39c820375f62d4ae73fcd55f6',
    });
    expect(verifyOfficialDraw(configuration, seed, first)).toBe(true);
  });

  it('assigns an odd knockout bye only among the minimum history', () => {
    const evidence = executeOfficialDraw(frozenKnockout(), seed);
    expect(evidence.result).toMatchObject({
      bye: { priorByeCount: 0 },
      formatCode: 'KNOCKOUT',
      pairings: [{ ordinal: 1 }, { ordinal: 2 }],
      roundNumber: 2,
    });
  });

  it('selects the only participant with the minimum bye history without consuming a choice', () => {
    const configuration = DrawConfiguration.create({
      ...common,
      formatCode: 'KNOCKOUT',
      groupCount: null,
      id: 'draw-single-eligible-bye',
      participants: participants(3, [0, 1, 1]),
      roundNumber: 3,
    });
    configuration.freeze({ actorId: common.actorId, expectedRevision: 1, occurredAt: common.occurredAt });
    expect(executeOfficialDraw(configuration.toSnapshot(), seed).result).toMatchObject({
      bye: { participantId: 'P01', priorByeCount: 0 },
    });
  });

  it('does not assign a bye to an even knockout field', () => {
    const configuration = DrawConfiguration.create({
      ...common,
      formatCode: 'KNOCKOUT',
      groupCount: null,
      id: 'draw-even',
      participants: participants(4),
      roundNumber: 1,
    });
    configuration.freeze({ actorId: common.actorId, expectedRevision: 1, occurredAt: common.occurredAt });
    expect(executeOfficialDraw(configuration.toSnapshot(), seed).result).toMatchObject({
      bye: null,
      pairings: [{ ordinal: 1 }, { ordinal: 2 }],
    });
  });

  it('rejects invalid seeds and detects altered evidence', () => {
    const configuration = frozenGroup();
    try {
      executeOfficialDraw(configuration, new Uint8Array(31));
      expect.fail('Expected an invalid seed error.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DomainError);
      if (error instanceof DomainError) expect(error.code).toBe('DRAW_SEED_INVALID');
    }
    const evidence = executeOfficialDraw(configuration, seed);
    expect(
      verifyOfficialDraw(configuration, seed, { ...evidence, resultHash: '0'.repeat(64) }),
    ).toBe(false);
    expect(verifyOfficialDraw(configuration, new Uint8Array(31), evidence)).toBe(false);
  });

  it('creates 32-byte official seeds and rejects commitments for drafts', () => {
    expect(generateOfficialSeed()).toHaveLength(32);
    const draft = DrawConfiguration.create({
      ...common,
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      id: 'draft-draw',
      participants: participants(3),
      roundNumber: 0,
    });
    expect(() => commitOfficialSeed(draft.toSnapshot(), seed)).toThrow();
  });
});
