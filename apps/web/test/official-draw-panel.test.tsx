import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OfficialDrawPanel } from '../components/official-draw-panel';
import type { CompetitionDetail, DrawWorkspace } from '../lib/competition-api';

const api = vi.hoisted(() => ({
  confirmOfficialDraw: vi.fn(),
  executeOfficialDraw: vi.fn(),
  prepareOfficialDraw: vi.fn(),
}));
vi.mock('../lib/competition-api', () => api);

const detail: CompetitionDetail = {
  createdAt: '2026-08-13T18:00:00.000Z', edition: { id: 'edition-1', name: 'OES 2026', year: 2026 },
  event: { code: 'COL', id: 'event-1', name: 'Colegiales' }, formatCode: 'GROUP_STAGE', groupCount: 1,
  id: 'competition-1', institutions: [], modality: { code: 'MALE', id: 'modality-1', name: 'Masculina' },
  participantCount: 3, participants: [], revision: 7,
  ruleSet: { allowDraws: true, canonicalHash: '1'.repeat(64), drawPoints: 1, frozenAt: '2026-08-13T18:00:00.000Z', id: 'rules-1', lossPoints: 0, resultProfile: 'SCORE_BASED', revision: 2, status: 'FROZEN', tieBreakCriteria: ['TABLE_POINTS'], winPoints: 3 },
  sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' }, status: 'DRAFT', validGroupCounts: [1],
};

const empty: DrawWorkspace = { competitionId: detail.id, competitionRevision: 7, competitionStatus: 'DRAFT', configuration: null, execution: null };
const prepared: DrawWorkspace = {
  ...empty, competitionRevision: 9, competitionStatus: 'LOCKED',
  configuration: { canonicalHash: '2'.repeat(64), formatCode: 'GROUP_STAGE', groupCount: 1, id: 'configuration-1', participantCount: 3, revision: 2, roundNumber: 0, status: 'FROZEN' },
};
const pending: DrawWorkspace = {
  ...prepared,
  execution: {
    confirmedAt: null, confirmedBy: null, evidenceHash: '3'.repeat(64), executedAt: '2026-08-13T18:02:00.000Z',
    executedBy: { displayName: 'Administrador Uno', id: 'actor-1' }, id: 'execution-1', matchCount: 0,
    result: { formatCode: 'GROUP_STAGE', groups: [{ label: 'A', members: [{ displayName: 'Colegio A', id: 'participant-a' }, { displayName: 'Colegio B', id: 'participant-b' }, { displayName: 'Colegio C', id: 'participant-c' }], ordinal: 1 }] },
    revision: 1, seedCommitment: '4'.repeat(64), seedHex: null, status: 'PENDING_CONFIRMATION',
  },
};

describe('OfficialDrawPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires explicit confirmation before locking the official configuration', async () => {
    api.prepareOfficialDraw.mockResolvedValue(prepared);
    render(<OfficialDrawPanel actorId="actor-1" canOperate detail={detail} onChange={vi.fn()} onError={vi.fn()} workspace={empty} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preparar sorteo oficial' }));
    expect(api.prepareOfficialDraw).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y bloquear' }));
    await waitFor(() => expect(api.prepareOfficialDraw).toHaveBeenCalledWith('competition-1', 7));
  });

  it('executes on the server and prevents the executor from self-confirming', async () => {
    api.executeOfficialDraw.mockResolvedValue(pending);
    const { rerender } = render(<OfficialDrawPanel actorId="actor-1" canOperate detail={detail} onChange={vi.fn()} onError={vi.fn()} workspace={prepared} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar sorteo' }));
    await waitFor(() => expect(api.executeOfficialDraw).toHaveBeenCalledWith('configuration-1', 2));
    rerender(<OfficialDrawPanel actorId="actor-1" canOperate detail={detail} onChange={vi.fn()} onError={vi.fn()} workspace={pending} />);
    expect(screen.getByText(/no puede confirmarlo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar sorteo y generar encuentros' })).not.toBeInTheDocument();
  });

  it('lets another authority confirm and materialize the matches', async () => {
    if (pending.execution === null) throw new Error('Expected pending execution');
    const confirmed: DrawWorkspace = { ...pending, execution: { ...pending.execution, confirmedAt: '2026-08-13T18:03:00.000Z', confirmedBy: { displayName: 'Administrador Dos', id: 'actor-2' }, matchCount: 3, revision: 2, seedHex: '5'.repeat(64), status: 'CONFIRMED' } };
    api.confirmOfficialDraw.mockResolvedValue(confirmed);
    render(<OfficialDrawPanel actorId="actor-2" canOperate detail={detail} onChange={vi.fn()} onError={vi.fn()} workspace={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar sorteo y generar encuentros' }));
    await waitFor(() => expect(api.confirmOfficialDraw).toHaveBeenCalledWith('execution-1', 1));
  });
});
