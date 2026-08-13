import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionsClient } from '../components/competitions-client';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const competitionApi = vi.hoisted(() => ({
  competitionCatalog: vi.fn(),
  competitions: vi.fn(),
  createCompetition: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/competition-api', () => competitionApi);

const actor = { displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' };
const edition = { id: 'edition-1', name: 'OES 2026', year: 2026 };
const combination = {
  event: { code: 'COLEGIALES', id: 'event-1', name: 'Colegiales' },
  modality: { code: 'MALE', id: 'modality-1', name: 'Masculina' },
  sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' },
};
const catalog = {
  combinations: [combination],
  editions: [edition],
};
const created = {
  createdAt: '2026-08-13T18:00:00.000Z',
  edition,
  event: combination.event,
  formatCode: null,
  id: 'competition-1',
  modality: combination.modality,
  participantCount: 0,
  revision: 1,
  sport: combination.sport,
  status: 'DRAFT',
};

describe('CompetitionsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replace.mockReset();
    authApi.currentActor.mockReset().mockResolvedValue(actor);
    authApi.logout.mockReset().mockResolvedValue(undefined);
    competitionApi.competitionCatalog.mockReset().mockResolvedValue(catalog);
    competitionApi.competitions.mockReset().mockResolvedValue([]);
    competitionApi.createCompetition.mockReset().mockResolvedValue(created);
  });

  it('restores the registry and creates the first persisted competition', async () => {
    render(<CompetitionsClient />);
    expect(await screen.findByRole('heading', { name: 'Competencias' })).toBeInTheDocument();
    expect(screen.getByText('Aún no hay competencias.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Crear competencia' });
    if (!(button instanceof HTMLButtonElement) || button.form === null) throw new Error('Expected competition form');
    fireEvent.submit(button.form);
    await waitFor(() => expect(competitionApi.createCompetition).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Futsal · Masculina' })).toBeInTheDocument());
    expect(screen.getByText('OES 2026 / Colegiales')).toBeInTheDocument();
    expect(competitionApi.createCompetition).toHaveBeenCalledWith({
      editionId: 'edition-1',
      eventId: 'event-1',
      modalityId: 'modality-1',
      sportId: 'sport-1',
    });
  });
});
