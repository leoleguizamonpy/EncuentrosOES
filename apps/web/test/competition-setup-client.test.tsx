import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionSetupClient } from '../components/competition-setup-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const competitionApi = vi.hoisted(() => ({
  addCompetitionParticipant: vi.fn(),
  confirmOfficialDraw: vi.fn(),
  confirmMatchResult: vi.fn(),
  competitionDetail: vi.fn(),
  configureCompetitionFormat: vi.fn(),
  drawWorkspace: vi.fn(),
  executeOfficialDraw: vi.fn(),
  freezeCompetitionRuleSet: vi.fn(),
  prepareOfficialDraw: vi.fn(),
  recordMatchResult: vi.fn(),
  resultsWorkspace: vi.fn(),
  saveCompetitionRuleSet: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/competition-api', () => competitionApi);

const base = {
  createdAt: '2026-08-13T18:00:00.000Z',
  edition: { id: 'edition-1', name: 'OES 2026', year: 2026 },
  event: { code: 'COL', id: 'event-1', name: 'Colegiales' },
  formatCode: null,
  groupCount: null,
  id: 'competition-1',
  institutions: [
    { code: 'A', id: 'institution-1', name: 'Colegio A', selected: true },
    { code: 'B', id: 'institution-2', name: 'Colegio B', selected: false },
  ],
  modality: { code: 'MALE', id: 'modality-1', name: 'Masculina' },
  participantCount: 3,
  participants: [
    { displayName: 'Colegio A', enabledAt: '2026-08-13T18:00:00.000Z', id: 'participant-1', institutionId: 'institution-1', status: 'ENABLED' },
    { displayName: 'Colegio C', enabledAt: '2026-08-13T18:00:00.000Z', id: 'participant-2', institutionId: 'institution-3', status: 'ENABLED' },
    { displayName: 'Colegio D', enabledAt: '2026-08-13T18:00:00.000Z', id: 'participant-3', institutionId: 'institution-4', status: 'ENABLED' },
  ],
  revision: 4,
  ruleSet: null,
  sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' },
  status: 'DRAFT',
  validGroupCounts: [1],
} as const;

describe('CompetitionSetupClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue({ displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' });
    authApi.logout.mockResolvedValue(undefined);
    competitionApi.competitionDetail.mockResolvedValue(base);
    competitionApi.drawWorkspace.mockResolvedValue({ competitionId: 'competition-1', competitionRevision: 4, competitionStatus: 'DRAFT', configuration: null, execution: null, publication: null });
    competitionApi.resultsWorkspace.mockResolvedValue({ competitionId: 'competition-1', competitionStatus: 'DRAFT', groups: [], matches: [], resultProfile: null });
    competitionApi.addCompetitionParticipant.mockResolvedValue({ ...base, participantCount: 4, revision: 5 });
    competitionApi.configureCompetitionFormat.mockResolvedValue({ ...base, formatCode: 'GROUP_STAGE', groupCount: 1, revision: 5 });
  });

  it('restores participants and adds another institution with the current revision', async () => {
    render(<CompetitionSetupClient competitionId="competition-1" />);
    expect(await screen.findByRole('heading', { name: 'Preparar la competencia.' })).toBeInTheDocument();
    expect(screen.getByText('Colegio A')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'institution-2' } });

    const addButton = screen.getByRole('button', { name: 'Agregar' });
    if (!(addButton instanceof HTMLButtonElement) || addButton.form === null) throw new Error('Expected participant form');
    fireEvent.submit(addButton.form);
    await waitFor(() => expect(competitionApi.addCompetitionParticipant).toHaveBeenCalledWith('competition-1', 'institution-2', 4));
  });

  it('persists the selected valid group count', async () => {
    render(<CompetitionSetupClient competitionId="competition-1" />);
    expect(await screen.findByRole('heading', { name: 'Preparar la competencia.' })).toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: 'Guardar formato' });
    if (!(saveButton instanceof HTMLButtonElement) || saveButton.form === null) throw new Error('Expected format form');
    fireEvent.submit(saveButton.form);
    await waitFor(() => expect(competitionApi.configureCompetitionFormat).toHaveBeenCalledWith('competition-1', {
      expectedRevision: 4,
      formatCode: 'GROUP_STAGE',
      groupCount: 1,
    }));
  });

  it('keeps operators in read-only mode', async () => {
    authApi.currentActor.mockResolvedValue({ displayName: 'Consulta OES', id: 'actor-2', role: 'OPERATOR' });
    render(<CompetitionSetupClient competitionId="competition-1" />);
    expect(await screen.findByText('Tu rol permite consultar esta configuración, pero no modificarla.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar formato' })).not.toBeInTheDocument();
  });
});
