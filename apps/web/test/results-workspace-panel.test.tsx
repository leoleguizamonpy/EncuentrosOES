import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultsWorkspacePanel } from '../components/results-workspace-panel';
import type { ResultsWorkspace } from '../lib/competition-api';

const api = vi.hoisted(() => ({ annulMatchResult: vi.fn(), confirmGroupQualification: vi.fn(), confirmMatchResult: vi.fn(), recordMatchResult: vi.fn() }));
vi.mock('../lib/competition-api', async (importOriginal) => ({ ...await importOriginal(), ...api }));

const participantA = { displayName: 'Colegio A', id: 'participant-a' };
const participantB = { displayName: 'Colegio B', id: 'participant-b' };
const workspace: ResultsWorkspace = {
  competitionId: 'competition-1',
  competitionStatus: 'LOCKED',
  groups: [{
    complete: false,
    id: 'group-a',
    label: 'A',
    ordinal: 1,
    qualification: null,
    standings: [{ draws: 0, losses: 0, participant: participantA, played: 1, position: 1, scoreAgainst: 1, scoreDifference: 2, scoreFor: 3, setDifference: 0, setsLost: 0, setsWon: 0, sportPointDifference: 2, sportPointsAgainst: 1, sportPointsFor: 3, tablePoints: 3, tied: false, wins: 1 }],
  }],
  matches: [{
    group: { id: 'group-a', label: 'A' }, id: 'match-1', ordinal: 1,
    participantA, participantB, roundNumber: 0,
    result: { confirmedAt: '2026-08-13T18:05:00.000Z', confirmedBy: { displayName: 'Autoridad Dos', id: 'actor-2' }, detail: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 }, id: 'result-1', recordedAt: '2026-08-13T18:04:00.000Z', recordedBy: { displayName: 'Autoridad Uno', id: 'actor-1' }, resolved: { scoreA: 3, scoreB: 1, setsWonA: 0, setsWonB: 0, winnerParticipantId: participantA.id }, revision: 2, status: 'CONFIRMED' },
    status: 'RESULT_CONFIRMED', winnerParticipantId: participantA.id,
  }],
  resultProfile: 'SCORE_BASED',
};

describe('ResultsWorkspacePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows persisted matches and the automatically calculated table', () => {
    render(<ResultsWorkspacePanel actorId="actor-1" canAnnul={false} canOperate onChange={vi.fn()} onError={vi.fn()} workspace={workspace} />);
    expect(screen.getByText('3 — 1')).toBeInTheDocument();
    expect(screen.getByText('Resultado confirmado')).toBeInTheDocument();
    expect(screen.getByText(/confirmado por Autoridad Dos/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Colegio A')).toBeInTheDocument();
    expect(within(table).getByText('Pts.')).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
  });

  it('explains why there are no matches before draw confirmation', () => {
    render(<ResultsWorkspacePanel actorId="actor-1" canAnnul={false} canOperate onChange={vi.fn()} onError={vi.fn()} workspace={{ competitionId: 'competition-1', competitionStatus: 'LOCKED', groups: [], matches: [], resultProfile: null }} />);
    expect(screen.getByText(/cuando se confirme el sorteo oficial/i)).toBeInTheDocument();
  });

  it('records a score and requires a different authority to confirm it', async () => {
    const sourceGroup = workspace.groups[0];
    const sourceMatch = workspace.matches[0];
    const sourceResult = sourceMatch?.result;
    if (sourceGroup === undefined || sourceMatch === undefined || sourceResult === undefined || sourceResult === null) throw new Error('Expected result fixture');
    const empty: ResultsWorkspace = { ...workspace, groups: [{ ...sourceGroup, standings: [] }], matches: [{ ...sourceMatch, result: null, status: 'PENDING_RESULT', winnerParticipantId: null }] };
    api.recordMatchResult.mockResolvedValue(empty);
    const onChange = vi.fn();
    const { rerender } = render(<ResultsWorkspacePanel actorId="actor-1" canAnnul={false} canOperate onChange={onChange} onError={vi.fn()} workspace={empty} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar resultado' }));
    fireEvent.change(screen.getByLabelText('Marcador de Colegio A'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Marcador de Colegio B'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a confirmación' }));
    await waitFor(() => expect(api.recordMatchResult).toHaveBeenCalledWith('match-1', { profile: 'SCORE_BASED', scoreA: 4, scoreB: 2 }));

    const emptyMatch = empty.matches[0];
    if (emptyMatch === undefined) throw new Error('Expected empty result fixture');
    const pending: ResultsWorkspace = { ...empty, matches: [{ ...emptyMatch, result: { ...sourceResult, confirmedAt: null, confirmedBy: null, revision: 1, status: 'PENDING_CONFIRMATION' }, status: 'RESULT_PENDING_CONFIRMATION' }] };
    api.confirmMatchResult.mockResolvedValue(workspace);
    rerender(<ResultsWorkspacePanel actorId="actor-2" canAnnul={false} canOperate onChange={onChange} onError={vi.fn()} workspace={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    await waitFor(() => expect(api.confirmMatchResult).toHaveBeenCalledWith('result-1', 1));
  });

  it('records a tied knockout score with penalties kept separate', async () => {
    const sourceMatch = workspace.matches[0];
    if (sourceMatch === undefined) throw new Error('Expected match fixture');
    const knockout: ResultsWorkspace = {
      ...workspace,
      groups: [],
      matches: [{ ...sourceMatch, group: null, result: null, roundNumber: 1, status: 'PENDING_RESULT', winnerParticipantId: null }],
    };
    api.recordMatchResult.mockResolvedValue(knockout);
    render(<ResultsWorkspacePanel actorId="actor-1" canAnnul={false} canOperate onChange={vi.fn()} onError={vi.fn()} workspace={knockout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar resultado' }));
    fireEvent.change(screen.getByLabelText('Marcador de Colegio A'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Marcador de Colegio B'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Penales de Colegio A'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Penales de Colegio B'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a confirmación' }));
    await waitFor(() => expect(api.recordMatchResult).toHaveBeenCalledWith('match-1', {
      profile: 'SCORE_BASED', scoreA: 2, scoreB: 2,
      tieBreak: { method: 'PENALTIES', scoreA: 5, scoreB: 4 },
    }));
  });

  it('records a no-show as an administrative resolution instead of a fake score', async () => {
    const sourceMatch = workspace.matches[0];
    if (sourceMatch === undefined) throw new Error('Expected match fixture');
    const empty: ResultsWorkspace = { ...workspace, matches: [{ ...sourceMatch, result: null, status: 'PENDING_RESULT', winnerParticipantId: null }] };
    api.recordMatchResult.mockResolvedValue(empty);
    render(<ResultsWorkspacePanel actorId="actor-1" canAnnul={false} canOperate onChange={vi.fn()} onError={vi.fn()} workspace={empty} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar resultado' }));
    fireEvent.change(screen.getByLabelText('Cómo terminó el encuentro'), { target: { value: 'NO_SHOW_A' } });
    expect(screen.getByText(/0 puntos al ausente y 3 al presente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a confirmación' }));
    await waitFor(() => expect(api.recordMatchResult).toHaveBeenCalledWith('match-1', { profile: 'ADMINISTRATIVE', outcome: 'NO_SHOW_A' }));
  });

  it('shows the proposed qualifiers and lets another authority confirm them', async () => {
    const sourceGroup = workspace.groups[0];
    if (sourceGroup === undefined) throw new Error('Expected group fixture');
    const pending: ResultsWorkspace = {
      ...workspace,
      groups: [{
        ...sourceGroup,
        complete: true,
        qualification: {
          confirmedAt: null, confirmedBy: null,
          firstParticipant: participantA, id: 'qualification-1',
          proposedAt: '2026-08-13T18:06:00.000Z', proposedBy: { displayName: 'Autoridad Uno', id: 'actor-1' },
          revision: 1, secondParticipant: participantB, status: 'PENDING_CONFIRMATION',
        },
      }],
    };
    api.confirmGroupQualification.mockResolvedValue(pending);
    const onChange = vi.fn();
    const { rerender } = render(<ResultsWorkspacePanel actorId="actor-1" canAnnul={false} canOperate onChange={onChange} onError={vi.fn()} workspace={pending} />);
    expect(screen.getByText('Clasificación propuesta')).toBeInTheDocument();
    expect(screen.getByText(/Otra autoridad debe confirmar estos clasificados/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar clasificados' })).not.toBeInTheDocument();

    rerender(<ResultsWorkspacePanel actorId="actor-2" canAnnul={false} canOperate onChange={onChange} onError={vi.fn()} workspace={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar clasificados' }));
    await waitFor(() => expect(api.confirmGroupQualification).toHaveBeenCalledWith('qualification-1', 1));
  });

  it('lets a superadministrator annul a confirmed result with a formal reason', async () => {
    const sourceMatch = workspace.matches[0];
    if (sourceMatch === undefined) throw new Error('Expected match fixture');
    const next: ResultsWorkspace = { ...workspace, matches: [{ ...sourceMatch, result: null, status: 'PENDING_RESULT', winnerParticipantId: null }] };
    api.annulMatchResult.mockResolvedValue(next);
    const onChange = vi.fn();
    render(<ResultsWorkspacePanel actorId="super-1" canAnnul canOperate onChange={onChange} onError={vi.fn()} workspace={workspace} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anular resultado' }));
    fireEvent.change(screen.getByLabelText('Motivo formal de anulación'), { target: { value: 'Error formal de mesa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() => expect(api.annulMatchResult).toHaveBeenCalledWith('result-1', 2, 'Error formal de mesa'));
    expect(onChange).toHaveBeenCalledWith(next);
  });
});
