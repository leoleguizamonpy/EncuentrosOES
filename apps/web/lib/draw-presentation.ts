import type { PublicDrawPublication } from './competition-api';

export type DrawPresentationItem =
  | Readonly<{ kind: 'GROUP'; label: string; members: readonly Readonly<{ id: string; name: string }>[] }>
  | Readonly<{ kind: 'PAIRING'; label: string; participantA: Readonly<{ id: string; name: string }>; participantB: Readonly<{ id: string; name: string }> }>
  | Readonly<{ kind: 'BYE'; label: string; participant: Readonly<{ id: string; name: string }> }>;

export function drawPresentationItems(publication: PublicDrawPublication): readonly DrawPresentationItem[] {
  const result = publication.act.result;
  if (result.formatCode === 'GROUP_STAGE') {
    return result.groups
      .slice()
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((group) => ({ kind: 'GROUP' as const, label: `Grupo ${group.label}`, members: group.members }));
  }

  const pairings: DrawPresentationItem[] = result.pairings
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((pairing) => ({
      kind: 'PAIRING' as const,
      label: `Cruce ${String(pairing.ordinal)}`,
      participantA: pairing.participantA,
      participantB: pairing.participantB,
    }));
  if (result.bye !== null) {
    pairings.push({ kind: 'BYE', label: 'Pase libre', participant: result.bye.participant });
  }
  return pairings;
}

export function normalizedPresentationStep(value: string | null, total: number): number {
  if (total <= 0 || value === null || !/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return 0;
  return Math.min(parsed, total);
}
