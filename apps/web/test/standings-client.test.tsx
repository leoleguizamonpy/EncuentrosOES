import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StandingsClient } from '../components/standings-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const competitionApi = vi.hoisted(() => ({ competitions: vi.fn(), resultsWorkspace: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/competition-api', () => competitionApi);

const actor = { displayName: 'Operador OES', id: 'actor-1', role: 'OPERATOR' };
const competition = {
  createdAt: '2026-08-21T12:00:00.000Z',
  edition: { id: 'edition-1', name: 'OES 2026', year: 2026 },
  event: { code: 'COLEGIALES', id: 'event-1', name: 'Colegiales' },
  formatCode: 'GROUP_STAGE',
  groupCount: 1,
  id: 'competition-1',
  modality: { code: 'MALE', id: 'modality-1', name: 'Masculina' },
  participantCount: 4,
  revision: 4,
  sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' },
  status: 'LOCKED',
};

const standing = (position: number, name: string, id: string, points: number) => ({
  draws: 0,
  losses: position - 1,
  participant: { displayName: name, id },
  played: 3,
  position,
  scoreAgainst: position,
  scoreDifference: 4 - position,
  scoreFor: 4,
  setDifference: 0,
  setsLost: 0,
  setsWon: 0,
  sportPointDifference: 0,
  sportPointsAgainst: 0,
  sportPointsFor: 0,
  tablePoints: points,
  tied: false,
  wins: 4 - position,
});

describe('StandingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    competitionApi.competitions.mockResolvedValue([competition]);
    competitionApi.resultsWorkspace.mockResolvedValue({
      competitionId: competition.id,
      competitionStatus: 'LOCKED',
      groups: [{
        complete: true,
        id: 'group-1',
        label: 'A',
        ordinal: 1,
        qualification: {
          confirmedAt: '2026-08-21T14:00:00.000Z',
          confirmedBy: { displayName: 'Admin B', id: 'actor-2' },
          firstParticipant: { displayName: 'Colegio A', id: 'participant-1' },
          id: 'qualification-1',
          proposedAt: '2026-08-21T13:00:00.000Z',
          proposedBy: { displayName: 'Admin A', id: 'actor-3' },
          revision: 2,
          secondParticipant: { displayName: 'Colegio B', id: 'participant-2' },
          status: 'CONFIRMED',
        },
        standings: [standing(1, 'Colegio A', 'participant-1', 9), standing(2, 'Colegio B', 'participant-2', 6)],
      }],
      matches: [],
      resultProfile: 'SCORE_BASED',
    });
  });

  it('shows calculated standings and confirmed qualification without recalculating them', async () => {
    render(<StandingsClient />);

    expect(await screen.findByRole('heading', { name: 'Clasificación', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Clasificación/ })).toHaveAttribute('href', '/standings');
    expect(screen.getByText('Futsal · Masculina · Grupo A')).toBeInTheDocument();
    expect(screen.getByText('Colegio A')).toBeInTheDocument();
    expect(screen.getByText('Colegio B')).toBeInTheDocument();
    expect(screen.getByText('Clasificación confirmada')).toBeInTheDocument();
    expect(screen.getByText('1 grupos confirmados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver competencia' })).toHaveAttribute('href', '/competitions/competition-1#results-workspace');
  });
});
