import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DrawsClient } from '../components/draws-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const competitionApi = vi.hoisted(() => ({ competitions: vi.fn(), drawWorkspace: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/competition-api', () => competitionApi);

const actor = { displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' };
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
const configuration = {
  canonicalHash: 'hash',
  formatCode: 'GROUP_STAGE',
  groupCount: 2,
  id: 'configuration-1',
  participantCount: 8,
  revision: 1,
  roundNumber: 1,
  status: 'FROZEN',
};

describe('DrawsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    competitionApi.competitions.mockResolvedValue([competition]);
  });

  it('shows prepared draws as an operational inbox and links to competition operation', async () => {
    competitionApi.drawWorkspace.mockResolvedValue({
      competitionId: competition.id,
      competitionRevision: 4,
      competitionStatus: 'LOCKED',
      configuration,
      execution: null,
      publication: null,
    });

    render(<DrawsClient />);

    expect(await screen.findByRole('heading', { name: 'Sorteos oficiales', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sorteos/ })).toHaveAttribute('href', '/draws');
    expect(screen.getByText('Preparado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Operar Futsal Masculina' })).toHaveAttribute('href', '/competitions/competition-1');
  });

  it('exposes the public publication when a draw is already published', async () => {
    competitionApi.drawWorkspace.mockResolvedValue({
      competitionId: competition.id,
      competitionRevision: 4,
      competitionStatus: 'LOCKED',
      configuration,
      execution: {
        confirmedAt: '2026-08-21T12:10:00.000Z',
        confirmedBy: { displayName: 'Confirmador', id: 'actor-2' },
        evidenceHash: 'evidence',
        executedAt: '2026-08-21T12:05:00.000Z',
        executedBy: { displayName: 'Ejecutor', id: 'actor-1' },
        id: 'draw-1',
        matchCount: 4,
        result: { formatCode: 'GROUP_STAGE', groups: [] },
        revision: 2,
        seedCommitment: 'commitment',
        seedHex: 'seed',
        status: 'CONFIRMED',
      },
      publication: { id: 'publication-1', publishedAt: '2026-08-21T12:15:00.000Z', verificationCode: 'ABC123' },
    });

    render(<DrawsClient />);

    await waitFor(() => expect(screen.getByText('Publicado')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Publicación' })).toHaveAttribute('href', '/draws/publication-1');
  });

  it('does not disguise a failed draw workspace as a competition without a draw', async () => {
    competitionApi.drawWorkspace.mockRejectedValue(new Error('workspace unavailable'));

    render(<DrawsClient />);

    expect(await screen.findByText('Estado no disponible')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No fue posible recuperar el estado de 1 competencia');
    expect(screen.getByRole('link', { name: 'Operar Futsal Masculina' })).toHaveAttribute('href', '/competitions/competition-1');
  });
});
