import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GeneralChampionshipClient } from '../components/general-championship-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const generalApi = vi.hoisted(() => ({
  generalChampionshipCatalog: vi.fn(),
  generalChampionshipByScope: vi.fn(),
  generalChampionshipOptions: vi.fn(),
  activateGeneralChampionship: vi.fn(),
  addGeneralPlacementContribution: vi.fn(),
  addGeneralSpecialContribution: vi.fn(),
  annulGeneralContribution: vi.fn(),
  confirmGeneralContribution: vi.fn(),
  createGeneralChampionship: vi.fn(),
  finalizeGeneralChampionship: vi.fn(),
  saveGeneralScoring: vi.fn(),
  syncGeneralChampionship: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/general-championship-api', () => generalApi);

const actor = { displayName: 'Superadmin OES', id: 'actor-1', role: 'SUPERADMIN' };
const catalog = {
  editions: [{ id: 'edition-1', name: 'OES 2026', year: 2026 }],
  events: [{ id: 'event-1', name: 'Colegiales' }],
};

const championship = {
  champion: null,
  contributions: [
    { automatic: true, confirmedAt: '2026-08-26T10:00:00.000Z', confirmedBy: { id: 'actor-1', name: 'Superadmin OES' }, description: 'Campeón confirmado de Futsal Masculino.', id: 'c1', institution: { id: 'inst-1', name: 'Colegio Nacional Dr. Víctor Natalicio Vasconsellos' }, points: 100, recordedAt: '2026-08-26T09:00:00.000Z', recordedBy: { id: 'actor-1', name: 'Sistema OES' }, revision: 1, source: { competitionId: 'competition-1', label: 'Futsal · Masculino', placement: 1 }, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED', title: 'Futsal · Masculino — Campeón' },
    { automatic: true, confirmedAt: '2026-08-26T10:05:00.000Z', confirmedBy: { id: 'actor-1', name: 'Superadmin OES' }, description: 'Campeón confirmado de Futsal Femenino.', id: 'c2', institution: { id: 'inst-1', name: 'Colegio Nacional Dr. Víctor Natalicio Vasconsellos' }, points: 100, recordedAt: '2026-08-26T09:05:00.000Z', recordedBy: { id: 'actor-1', name: 'Sistema OES' }, revision: 1, source: { competitionId: 'competition-2', label: 'Futsal · Femenino', placement: 1 }, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED', title: 'Futsal · Femenino — Campeón' },
    { automatic: true, confirmedAt: '2026-08-26T10:10:00.000Z', confirmedBy: { id: 'actor-1', name: 'Superadmin OES' }, description: 'Subcampeón confirmado de Voleibol Masculino.', id: 'c3', institution: { id: 'inst-1', name: 'Colegio Nacional Dr. Víctor Natalicio Vasconsellos' }, points: 70, recordedAt: '2026-08-26T09:10:00.000Z', recordedBy: { id: 'actor-1', name: 'Sistema OES' }, revision: 1, source: { competitionId: 'competition-3', label: 'Voleibol · Masculino', placement: 2 }, sourceType: 'COMPETITION_PLACEMENT', status: 'CONFIRMED', title: 'Voleibol · Masculino — Subcampeón' },
    { automatic: false, confirmedAt: null, confirmedBy: null, description: 'Reconocimiento oficial que todavía requiere confirmación.', id: 'c4', institution: { id: 'inst-1', name: 'Colegio Nacional Dr. Víctor Natalicio Vasconsellos' }, points: 50, recordedAt: '2026-08-26T09:20:00.000Z', recordedBy: { id: 'actor-2', name: 'Admin OES' }, revision: 1, source: null, sourceType: 'SPECIAL', status: 'PENDING_CONFIRMATION', title: 'Mejor Hinchada' },
  ],
  edition: { id: 'edition-1', name: 'OES 2026', year: 2026 },
  event: { id: 'event-1', name: 'Colegiales' },
  id: 'general-1',
  name: 'Campeonato General Colegiales 2026',
  revision: 8,
  rules: [
    { label: 'Campeón', placement: 1, points: 100 },
    { label: 'Subcampeón', placement: 2, points: 70 },
    { label: 'Tercer lugar', placement: 3, points: 50 },
    { label: 'Cuarto lugar', placement: 4, points: 25 },
  ],
  standings: [
    { contributionCount: 3, institution: { id: 'inst-1', name: 'Colegio Nacional Dr. Víctor Natalicio Vasconsellos' }, placementContributionCount: 3, position: 1, specialContributionCount: 0, tied: false, totalPoints: 270 },
    { contributionCount: 2, institution: { id: 'inst-2', name: 'Colegio San Juan Bautista' }, placementContributionCount: 2, position: 2, specialContributionCount: 0, tied: false, totalPoints: 240 },
  ],
  status: 'ACTIVE',
};

describe('GeneralChampionshipClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    generalApi.generalChampionshipCatalog.mockResolvedValue(catalog);
    generalApi.generalChampionshipByScope.mockResolvedValue(championship);
    generalApi.generalChampionshipOptions.mockResolvedValue({ competitions: [], institutions: [{ id: 'inst-1', name: 'Colegio Nacional Dr. Víctor Natalicio Vasconsellos' }] });
  });

  it('shows the derived 270-point total and its auditable sports ledger without counting a pending special contribution', async () => {
    render(<GeneralChampionshipClient />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Campeonato General' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Campeonato General/ })).toHaveAttribute('href', '/general-championship');
    expect(screen.getByRole('table', { name: 'Tabla del Campeonato General' })).toBeInTheDocument();
    expect(screen.getAllByText('270')).toHaveLength(1);
    expect(screen.getByText('Futsal · Masculino — Campeón')).toBeInTheDocument();
    expect(screen.getByText('Futsal · Femenino — Campeón')).toBeInTheDocument();
    expect(screen.getByText('Voleibol · Masculino — Subcampeón')).toBeInTheDocument();
    expect(screen.getByText('Mejor Hinchada')).toBeInTheDocument();
    expect(screen.getByText('Por confirmar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('shows the creation state when the selected scope has no general championship yet', async () => {
    generalApi.generalChampionshipByScope.mockResolvedValue(null);

    render(<GeneralChampionshipClient />);

    expect(await screen.findByText('No existe un Campeonato General para Colegiales.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear Campeonato General' })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected end of JSON input/)).not.toBeInTheDocument();
    expect(screen.queryByText('Actualizando tabla general…')).not.toBeInTheDocument();
  });
});
