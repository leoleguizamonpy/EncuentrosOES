import { DomainError } from '../errors/domain-error.js';

export interface ConfirmedGroupAdvance {
  readonly firstParticipantId: string;
  readonly secondParticipantId: string;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'INVALIDATED' | 'ANNULLED';
}

export interface KnockoutAdvanceMatch {
  readonly status: 'PENDING_RESULT' | 'RESULT_PENDING' | 'RESULT_CONFIRMED' | 'RESULT_ANNULLED';
  readonly winnerParticipantId: string | null;
}

export type NextRoundSource =
  | Readonly<{
      groups: readonly ConfirmedGroupAdvance[];
      kind: 'GROUP_STAGE';
    }>
  | Readonly<{
      byeParticipantIds: readonly string[];
      kind: 'KNOCKOUT';
      matches: readonly KnockoutAdvanceMatch[];
    }>;

function ensureParticipantId(id: string): string {
  const value = id.trim();
  if (value.length === 0) {
    throw new DomainError(
      'DRAW_CONFIGURATION_INCOMPATIBLE',
      'A next-round participant identifier cannot be empty.',
    );
  }
  return value;
}

function ensureUnique(ids: readonly string[]): readonly string[] {
  const normalized = ids.map(ensureParticipantId);
  if (new Set(normalized).size !== normalized.length) {
    throw new DomainError(
      'DRAW_CONFIGURATION_INCOMPATIBLE',
      'A participant cannot advance more than once into the same round.',
    );
  }
  return Object.freeze([...normalized].sort((left, right) => Buffer.from(left).compare(Buffer.from(right))));
}

export function deriveNextRoundParticipantIds(source: NextRoundSource): readonly string[] {
  let participantIds: readonly string[];

  if (source.kind === 'GROUP_STAGE') {
    if (source.groups.length === 0) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'A group stage requires at least one confirmed group qualification.',
      );
    }
    if (source.groups.some((group) => group.status !== 'CONFIRMED')) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'Every group qualification must be confirmed before opening the knockout round.',
      );
    }
    participantIds = source.groups.flatMap((group) => [group.firstParticipantId, group.secondParticipantId]);
  } else {
    if (source.byeParticipantIds.length > 1) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'A knockout round can contain at most one bye advance.',
      );
    }
    if (source.matches.some((match) => match.status !== 'RESULT_CONFIRMED' || match.winnerParticipantId === null)) {
      throw new DomainError(
        'DRAW_CONFIGURATION_INCOMPATIBLE',
        'Every knockout match must have a confirmed winner before opening the next round.',
      );
    }
    participantIds = [
      ...source.matches.map((match) => {
        if (match.winnerParticipantId === null) {
          throw new DomainError(
            'DRAW_CONFIGURATION_INCOMPATIBLE',
            'Every knockout match must expose its confirmed winner.',
          );
        }
        return match.winnerParticipantId;
      }),
      ...source.byeParticipantIds,
    ];
  }

  const eligible = ensureUnique(participantIds);
  if (eligible.length < 2) {
    throw new DomainError(
      'DRAW_CONFIGURATION_INCOMPATIBLE',
      'A new knockout round requires at least two confirmed participants.',
    );
  }
  return eligible;
}
