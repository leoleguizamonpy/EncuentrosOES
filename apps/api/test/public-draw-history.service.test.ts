import type { PrismaClient } from '@oes/database';
import { publicDrawVerificationCode, type PublicDrawAct } from '@oes/domain';
import { describe, expect, it, vi } from 'vitest';

import { PublicDrawHistoryService } from '../src/draws/public-draw-history.service.js';

function act(publicationId: string, officialDrawId: string): PublicDrawAct {
  return {
    algorithmVersion: 'oes-draw-v1',
    competition: {
      edition: 'OES 2026',
      event: 'Colegiales',
      id: '20000000-0000-4000-8000-000000000001',
      modality: 'Masculina',
      sport: 'Futsal',
    },
    configuration: {
      canonicalHash: '1'.repeat(64),
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
      id: '30000000-0000-4000-8000-000000000001',
      participantCount: 2,
      roundNumber: 0,
      ruleSetHash: '2'.repeat(64),
      ruleSetId: '40000000-0000-4000-8000-000000000001',
    },
    confirmedAt: '2026-08-19T17:00:00.000Z',
    evidenceHash: '3'.repeat(64),
    officialDrawId,
    participants: [
      { byeCount: 0, id: '50000000-0000-4000-8000-000000000001', name: 'Colegio A' },
      { byeCount: 0, id: '50000000-0000-4000-8000-000000000002', name: 'Colegio B' },
    ],
    publicationId,
    publishedAt: '2026-08-19T17:01:00.000Z',
    result: {
      formatCode: 'GROUP_STAGE',
      groups: [{
        label: 'A',
        members: [
          { id: '50000000-0000-4000-8000-000000000001', name: 'Colegio A' },
          { id: '50000000-0000-4000-8000-000000000002', name: 'Colegio B' },
        ],
        ordinal: 1,
      }],
    },
    schemaVersion: 'oes-public-draw-act-v1',
    seedHex: '4'.repeat(64),
  };
}

describe('PublicDrawHistoryService', () => {
  it('preserves revoked publications as historical evidence and verifies their stored act', async () => {
    const publishedAct = act('60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001');
    const revokedAct = act('60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002');
    const records = [
      {
        actJson: publishedAct,
        id: publishedAct.publicationId,
        officialDraw: { configuration: { formatCode: 'GROUP_STAGE', roundNumber: 0 }, evidenceHash: publishedAct.evidenceHash },
        officialDrawId: publishedAct.officialDrawId,
        publishedAt: new Date(publishedAct.publishedAt),
        revocationReason: null,
        revokedAt: null,
        status: 'PUBLISHED',
        verificationCode: publicDrawVerificationCode(publishedAct),
      },
      {
        actJson: revokedAct,
        id: revokedAct.publicationId,
        officialDraw: { configuration: { formatCode: 'GROUP_STAGE', roundNumber: 0 }, evidenceHash: revokedAct.evidenceHash },
        officialDrawId: revokedAct.officialDrawId,
        publishedAt: new Date(revokedAct.publishedAt),
        revocationReason: 'Resultado fuente anulado.',
        revokedAt: new Date('2026-08-19T18:00:00.000Z'),
        status: 'REVOKED',
        verificationCode: publicDrawVerificationCode(revokedAct),
      },
    ];
    const findMany = vi.fn().mockResolvedValue(records);
    const client = { drawPublication: { findMany } } as unknown as PrismaClient;

    const history = await new PublicDrawHistoryService(client).history('20000000-0000-4000-8000-000000000001');

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ integrityValid: true, status: 'PUBLISHED' });
    expect(history[1]).toMatchObject({
      integrityValid: true,
      revocationReason: 'Resultado fuente anulado.',
      revokedAt: '2026-08-19T18:00:00.000Z',
      status: 'REVOKED',
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { publishedAt: 'asc' },
      where: { competitionId: '20000000-0000-4000-8000-000000000001' },
    }));
  });
});
