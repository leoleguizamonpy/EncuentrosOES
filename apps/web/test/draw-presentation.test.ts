import { describe, expect, it } from 'vitest';

import type { PublicDrawPublication } from '../lib/competition-api';
import { drawPresentationItems, normalizedPresentationStep } from '../lib/draw-presentation';

function publication(result: PublicDrawPublication['act']['result']): PublicDrawPublication {
  return {
    act: {
      algorithmVersion: 'oes-draw-v1',
      competition: { edition: 'OES 2026', event: 'Colegiales', id: 'competition-1', modality: 'Masculina', sport: 'Futsal' },
      configuration: { canonicalHash: 'a'.repeat(64), formatCode: result.formatCode, groupCount: result.formatCode === 'GROUP_STAGE' ? 2 : null, id: 'configuration-1', participantCount: 4, roundNumber: result.formatCode === 'KNOCKOUT' ? result.roundNumber : 0, ruleSetHash: 'b'.repeat(64), ruleSetId: 'rules-1' },
      confirmedAt: '2026-08-19T17:00:00.000Z',
      evidenceHash: 'c'.repeat(64),
      officialDrawId: 'draw-1',
      participants: [],
      publicationId: 'publication-1',
      publishedAt: '2026-08-19T17:01:00.000Z',
      result,
      schemaVersion: 'oes-public-draw-act-v1',
      seedHex: 'd'.repeat(64),
    },
    id: 'publication-1',
    publishedAt: '2026-08-19T17:01:00.000Z',
    verificationCode: 'e'.repeat(64),
    verified: true,
  };
}

describe('official draw presentation sequence', () => {
  it('reveals persisted groups in ordinal order without reshuffling members', () => {
    const result = publication({
      formatCode: 'GROUP_STAGE',
      groups: [
        { label: 'B', members: [{ id: 'p3', name: 'Colegio C' }, { id: 'p4', name: 'Colegio D' }], ordinal: 2 },
        { label: 'A', members: [{ id: 'p1', name: 'Colegio A' }, { id: 'p2', name: 'Colegio B' }], ordinal: 1 },
      ],
    });
    expect(drawPresentationItems(result)).toEqual([
      { kind: 'GROUP', label: 'Grupo A', members: [{ id: 'p1', name: 'Colegio A' }, { id: 'p2', name: 'Colegio B' }] },
      { kind: 'GROUP', label: 'Grupo B', members: [{ id: 'p3', name: 'Colegio C' }, { id: 'p4', name: 'Colegio D' }] },
    ]);
  });

  it('reveals persisted knockout pairings followed by the persisted bye', () => {
    const result = publication({
      bye: { participant: { id: 'p5', name: 'Colegio E' }, priorByeCount: 0 },
      formatCode: 'KNOCKOUT',
      pairings: [
        { ordinal: 2, participantA: { id: 'p3', name: 'Colegio C' }, participantB: { id: 'p4', name: 'Colegio D' } },
        { ordinal: 1, participantA: { id: 'p1', name: 'Colegio A' }, participantB: { id: 'p2', name: 'Colegio B' } },
      ],
      roundNumber: 1,
    });
    expect(drawPresentationItems(result).map((item) => item.label)).toEqual(['Cruce 1', 'Cruce 2', 'Pase libre']);
  });

  it('restores a bounded reveal step from the URL', () => {
    expect(normalizedPresentationStep(null, 4)).toBe(0);
    expect(normalizedPresentationStep('2', 4)).toBe(2);
    expect(normalizedPresentationStep('99', 4)).toBe(4);
    expect(normalizedPresentationStep('-1', 4)).toBe(0);
    expect(normalizedPresentationStep('random', 4)).toBe(0);
  });
});
