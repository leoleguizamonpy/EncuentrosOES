import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationsClient } from '../components/confirmations-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const championApi = vi.hoisted(() => ({ champion: vi.fn(), confirmChampion: vi.fn() }));
const competitionApi = vi.hoisted(() => ({
  competitions: vi.fn(),
  confirmGroupQualification: vi.fn(),
  confirmMatchResult: vi.fn(),
  confirmOfficialDraw: vi.fn(),
  drawWorkspace: vi.fn(),
  resultsWorkspace: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/champion-api', () => championApi);
vi.mock('../lib/competition-api', () => competitionApi);

const actor = { displayName: 'Admin OES', id: 'actor-1', role: 'ADMIN' };
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

describe('ConfirmationsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    competitionApi.competitions.mockResolvedValue([competition]);
    championApi.champion.mockResolvedValue(null);
    competitionApi.drawWorkspace.mockResolvedValue({
      competitionId: competition.id,
      competitionRevision: 4,
      competitionStatus: 'LOCKED',
      configuration: { canonicalHash: 'hash', formatCode: 'GROUP_STAGE', groupCount: 1, id: 'config-1', participantCount: 4, revision: 1, roundNumber: 1, status: 'FROZEN' },
      execution: {
        confirmedAt: null,
        confirmedBy: null,
        evidenceHash: 'abcdef1234567890',
        executedAt: '2026-08-21T13:00:00.000Z',
        executedBy: { displayName: 'Admin B', id: 'actor-2' },
        id: 'draw-1',
        matchCount: 6,
        result: { formatCode: 'GROUP_STAGE', groups: [] },
        revision: 2,
        seedCommitment: 'commitment',
        seedHex: null,
        status: 'PENDING_CONFIRMATION',
      },
      publication: null,
    });
    competitionApi.resultsWorkspace.mockResolvedValue({
      competitionId: competition.id,
      competitionStatus: 'LOCKED',
      groups: [],
      matches: [{
        group: { id: 'group-1', label: 'A' },
        id: 'match-1',
        ordinal: 1,
        participantA: { displayName: 'Colegio A', id: 'participant-1' },
        participantB: { displayName: 'Colegio B', id: 'participant-2' },
        result: {
          confirmedAt: null,
          confirmedBy: null,
          detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 1 },
          id: 'result-1',
          recordedAt: '2026-08-21T14:00:00.000Z',
          recordedBy: { displayName: 'Admin OES', id: 'actor-1' },
          resolved: { scoreA: 2, scoreB: 1, setsWonA: 0, setsWonB: 0, winnerParticipantId: 'participant-1' },
          revision: 3,
          status: 'PENDING_CONFIRMATION',
        },
        roundNumber: 1,
        status: 'RESULT_PENDING_CONFIRMATION',
        winnerParticipantId: null,
      }],
      resultProfile: 'SCORE_BASED',
    });
    competitionApi.confirmOfficialDraw.mockResolvedValue({});
  });

  it('aggregates pending decisions and prevents self-confirmation', async () => {
    render(<ConfirmationsClient />);

    expect(await screen.findByRole('heading', { name: 'Confirmaciones', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Confirmaciones/ })).toHaveAttribute('href', '/admin/confirmations');
    expect(screen.getByText('Sorteo oficial pendiente')).toBeInTheDocument();
    expect(screen.getByText('Resultado pendiente')).toBeInTheDocument();
    expect(screen.getByText('Otra autoridad debe confirmar')).toBeInTheDocument();
    expect(screen.getByText('1 disponibles para confirmar')).toBeInTheDocument();
    expect(screen.getByText('1 requieren otra autoridad')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar sorteo' }));
    expect(competitionApi.confirmOfficialDraw).toHaveBeenCalledWith('draw-1', 2);
    expect(competitionApi.confirmMatchResult).not.toHaveBeenCalled();
  });
});
