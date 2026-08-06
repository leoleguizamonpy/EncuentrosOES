import { DomainError } from '../errors/domain-error.js';

export const MIN_GROUP_SIZE = 3 as const;
export const MAX_GROUP_SIZE = 4 as const;

export type GroupSize = typeof MIN_GROUP_SIZE | typeof MAX_GROUP_SIZE;

export interface GroupPlanEntry {
  readonly index: number;
  readonly label: string;
  readonly size: GroupSize;
}

export interface GroupPlan {
  readonly groupCount: number;
  readonly participantCount: number;
  readonly groups: readonly GroupPlanEntry[];
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(
      'INVALID_PARTICIPANT_COUNT',
      `${name} must be a positive safe integer.`,
    );
  }
}

export function groupLabel(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('Group index must be a non-negative safe integer.');
  }

  let remaining = index + 1;
  let label = '';

  while (remaining > 0) {
    remaining -= 1;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }

  return label;
}

export function planGroupDistribution(
  participantCount: number,
  groupCount: number,
): GroupPlan {
  assertPositiveInteger(participantCount, 'participantCount');

  if (!Number.isSafeInteger(groupCount) || groupCount <= 0) {
    throw new DomainError(
      'INVALID_GROUP_COUNT',
      'groupCount must be a positive safe integer.',
    );
  }

  const minimumParticipants = MIN_GROUP_SIZE * groupCount;
  const maximumParticipants = MAX_GROUP_SIZE * groupCount;

  if (
    participantCount < minimumParticipants ||
    participantCount > maximumParticipants
  ) {
    throw new DomainError(
      'INVALID_GROUP_COUNT',
      `A valid group count must satisfy ${String(MIN_GROUP_SIZE)}G ≤ N ≤ ${String(MAX_GROUP_SIZE)}G.`,
    );
  }

  const baseSize = Math.floor(participantCount / groupCount);
  const additionalPlaces = participantCount % groupCount;
  const groups = Array.from({ length: groupCount }, (_, index) => {
    const size = baseSize + (index < additionalPlaces ? 1 : 0);

    if (size !== MIN_GROUP_SIZE && size !== MAX_GROUP_SIZE) {
      throw new DomainError(
        'INVALID_GROUP_COUNT',
        'The requested distribution produced an invalid group size.',
      );
    }

    return Object.freeze({
      index,
      label: groupLabel(index),
      size,
    });
  });

  return Object.freeze({
    groupCount,
    participantCount,
    groups: Object.freeze(groups),
  });
}
