import { describe, expect, it } from 'vitest';

import { publicDrawVerificationCode, verifyPublicDrawAct, type PublicDrawAct } from '../src/index.js';

const act: PublicDrawAct = {
  algorithmVersion: 'oes-draw-v1',
  competition: { edition: 'OES 2026', event: 'Colegiales', id: 'competition-1', modality: 'Masculina', sport: 'Futsal' },
  configuration: { canonicalHash: 'a'.repeat(64), formatCode: 'GROUP_STAGE', groupCount: 1, id: 'configuration-1', participantCount: 3, roundNumber: 0, ruleSetHash: 'b'.repeat(64), ruleSetId: 'rules-1' },
  confirmedAt: '2026-08-13T18:03:00.000Z',
  evidenceHash: 'c'.repeat(64),
  officialDrawId: 'draw-1',
  participants: [{ byeCount: 0, id: 'participant-1', name: 'Colegio Uno' }],
  publicationId: 'publication-1',
  publishedAt: '2026-08-13T18:04:00.000Z',
  result: { formatCode: 'GROUP_STAGE', groups: [{ label: 'A', members: [{ id: 'participant-1', name: 'Colegio Uno' }], ordinal: 1 }] },
  schemaVersion: 'oes-public-draw-act-v1',
  seedHex: 'd'.repeat(64),
};

describe('public draw act', () => {
  it('produces a stable SHA-256 code and detects altered public evidence', () => {
    const code = publicDrawVerificationCode(act);
    expect(code).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyPublicDrawAct(structuredClone(act), code)).toBe(true);
    expect(verifyPublicDrawAct({ ...act, competition: { ...act.competition, sport: 'Voleibol' } }, code)).toBe(false);
  });
});
