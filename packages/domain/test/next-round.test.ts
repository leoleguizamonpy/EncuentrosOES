import { describe, expect, it } from 'vitest';

import { DomainError, deriveNextRoundParticipantIds } from '../src/index.js';

describe('deriveNextRoundParticipantIds', () => {
  it('derives first and second place from every confirmed group', () => {
    expect(deriveNextRoundParticipantIds({
      kind: 'GROUP_STAGE',
      groups: [
        { firstParticipantId: 'p1', secondParticipantId: 'p2', status: 'CONFIRMED' },
        { firstParticipantId: 'p3', secondParticipantId: 'p4', status: 'CONFIRMED' },
      ],
    })).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('rejects a group stage while any qualification remains unconfirmed', () => {
    expect(() => deriveNextRoundParticipantIds({
      kind: 'GROUP_STAGE',
      groups: [
        { firstParticipantId: 'p1', secondParticipantId: 'p2', status: 'CONFIRMED' },
        { firstParticipantId: 'p3', secondParticipantId: 'p4', status: 'PENDING_CONFIRMATION' },
      ],
    })).toThrowError(DomainError);
  });

  it('derives confirmed knockout winners plus the explicit bye', () => {
    expect(deriveNextRoundParticipantIds({
      byeParticipantIds: ['p5'],
      kind: 'KNOCKOUT',
      matches: [
        { status: 'RESULT_CONFIRMED', winnerParticipantId: 'p1' },
        { status: 'RESULT_CONFIRMED', winnerParticipantId: 'p3' },
      ],
    })).toEqual(['p1', 'p3', 'p5']);
  });

  it('rejects knockout continuity before every winner is confirmed', () => {
    expect(() => deriveNextRoundParticipantIds({
      byeParticipantIds: [],
      kind: 'KNOCKOUT',
      matches: [
        { status: 'RESULT_CONFIRMED', winnerParticipantId: 'p1' },
        { status: 'RESULT_PENDING', winnerParticipantId: null },
      ],
    })).toThrowError(DomainError);
  });

  it('rejects duplicate advances into the same round', () => {
    expect(() => deriveNextRoundParticipantIds({
      kind: 'GROUP_STAGE',
      groups: [
        { firstParticipantId: 'p1', secondParticipantId: 'p2', status: 'CONFIRMED' },
        { firstParticipantId: 'p1', secondParticipantId: 'p3', status: 'CONFIRMED' },
      ],
    })).toThrowError(DomainError);
  });

  it('does not open a new round when only a champion remains', () => {
    expect(() => deriveNextRoundParticipantIds({
      byeParticipantIds: [],
      kind: 'KNOCKOUT',
      matches: [{ status: 'RESULT_CONFIRMED', winnerParticipantId: 'p1' }],
    })).toThrowError(DomainError);
  });
});
