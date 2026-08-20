import type { PrismaClient } from '@oes/database';
import { describe, expect, it, vi } from 'vitest';

import { PrismaChampionStore } from '../src/finalization/prisma-champion-store.js';

const competitionId = '20000000-0000-4000-8000-000000000001';
const participantA = { displayName: 'Colegio A', id: '50000000-0000-4000-8000-000000000001' };
const participantB = { displayName: 'Colegio B', id: '50000000-0000-4000-8000-000000000002' };

function clientWithCompetition(competition: unknown): { client: PrismaClient; findUnique: ReturnType<typeof vi.fn> } {
  const findUnique = vi.fn().mockResolvedValue(competition);
  const client = {
    auditEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    competition: { findUnique },
  } as unknown as PrismaClient;
  return { client, findUnique };
}

describe('PrismaChampionStore public journey', () => {
  it('returns a locked competition from published evidence with groups, standings and pending matches', async () => {
    const { client, findUnique } = clientWithCompetition({
      combination: { event: { name: 'Colegiales' }, modality: { name: 'Masculina' }, sport: { name: 'Futsal' } },
      edition: { name: 'OES 2026' },
      finalizedAt: null,
      id: competitionId,
      officialDraws: [{
        configuration: { formatCode: 'GROUP_STAGE', roundNumber: 0 },
        confirmedAt: new Date('2026-08-19T17:00:00.000Z'),
        executedAt: new Date('2026-08-19T16:59:00.000Z'),
        groups: [{
          label: 'A',
          members: [{ participant: participantA }, { participant: participantB }],
          ordinal: 1,
          standings: [{
            draws: 0, losses: 0, participant: participantA, played: 1, position: 1,
            scoreAgainst: 1, scoreDifference: 2, scoreFor: 3, setDifference: 0, setsLost: 0, setsWon: 0,
            sportPointDifference: 2, sportPointsAgainst: 1, sportPointsFor: 3, tablePoints: 3, tied: false, wins: 1,
          }],
        }],
        id: '30000000-0000-4000-8000-000000000001',
        matches: [{
          group: { label: 'A' }, id: '40000000-0000-4000-8000-000000000001', ordinal: 1,
          participantA, participantB, results: [], winnerParticipantId: null,
        }],
        publication: {
          id: '60000000-0000-4000-8000-000000000001',
          publishedAt: new Date('2026-08-19T17:01:00.000Z'),
          status: 'PUBLISHED',
          verificationCode: 'a'.repeat(64),
        },
      }],
      revision: 8,
      status: 'LOCKED',
    });

    await expect(new PrismaChampionStore(client).publicJourney(competitionId)).resolves.toMatchObject({
      champion: null,
      competition: { finalizedAt: null, id: competitionId, status: 'LOCKED' },
      rounds: [{
        formatCode: 'GROUP_STAGE',
        groups: [{ label: 'A', members: [participantA, participantB], standings: [{ participant: participantA, tablePoints: 3 }] }],
        matches: [{ participantA, participantB, result: null, winnerParticipantId: null }],
        publication: { verificationCode: 'a'.repeat(64) },
        roundNumber: 0,
      }],
    });

    const publicQuery = findUnique.mock.calls.find((call) => {
      const argument = call[0] as { include?: { officialDraws?: unknown } } | undefined;
      return argument?.include?.officialDraws !== undefined;
    });
    expect(publicQuery?.[0]).toMatchObject({
      include: {
        officialDraws: {
          where: { publication: { is: { status: 'PUBLISHED' } }, status: 'CONFIRMED' },
        },
      },
    });
  });

  it('returns null until at least one official draw is published', async () => {
    const { client } = clientWithCompetition({
      combination: { event: { name: 'Colegiales' }, modality: { name: 'Masculina' }, sport: { name: 'Futsal' } },
      edition: { name: 'OES 2026' },
      finalizedAt: null,
      id: competitionId,
      officialDraws: [],
      revision: 7,
      status: 'LOCKED',
    });
    await expect(new PrismaChampionStore(client).publicJourney(competitionId)).resolves.toBeNull();
  });
});
