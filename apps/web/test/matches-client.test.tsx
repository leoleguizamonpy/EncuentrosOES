import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MatchesClient } from '../components/matches-client';

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
  groupCount: 2,
  id: 'competition-1',
  modality: { code: 'MALE', id: 'modality-1', name: 'Masculina' },
  participantCount: 8,
  revision: 4,
  sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' },
  status: 'LOCKED',
};
const pendingMatch = {
  group: { id: 'group-1', label: 'A' },
  id: 'match-1',
  ordinal: 1,
  participantA: { displayName: 'Colegio A', id: 'participant-1' },
  participantB: { displayName: 'Colegio B', id: 'participant-2' },
  result: null,
  roundNumber: 1,
  status: 'PENDING_RESULT',
  winnerParticipantId: null,
};

describe('MatchesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    competitionApi.competitions.mockResolvedValue([competition]);
    competitionApi.resultsWorkspace.mockResolvedValue({
      competitionId: competition.id,
      competitionStatus: 'LOCKED',
      groups: [],
      matches: [pendingMatch],
      resultProfile: 'SCORE_BASED',
    });
  });

  it('shows materialized matches and routes operation to the existing results workspace', async () => {
    render(<MatchesClient />);

    expect(await screen.findByRole('heading', { name: 'Encuentros', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Encuentros/ })).toHaveAttribute('href', '/matches');
    expect(screen.getByText('Colegio A · Colegio B')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de resultado')).toBeInTheDocument();
    expect(screen.getByText('1 sin resultado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Operar encuentro Colegio A contra Colegio B' })).toHaveAttribute('href', '/competitions/competition-1#results-workspace');
  });
});
