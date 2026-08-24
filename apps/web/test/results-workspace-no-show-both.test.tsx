import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultsWorkspacePanel } from '../components/results-workspace-panel';
import type { ResultsWorkspace } from '../lib/competition-api';

const api = vi.hoisted(() => ({
  annulMatchResult: vi.fn(),
  confirmGroupQualification: vi.fn(),
  confirmMatchResult: vi.fn(),
  recordMatchResult: vi.fn(),
}));
vi.mock('../lib/competition-api', async (importOriginal) => ({
  ...await importOriginal(),
  ...api,
}));

const workspace: ResultsWorkspace = {
  competitionId: 'competition-1',
  competitionStatus: 'LOCKED',
  groups: [],
  matches: [{
    group: null,
    id: 'match-1',
    ordinal: 1,
    participantA: { displayName: 'Colegio A', id: 'participant-a' },
    participantB: { displayName: 'Colegio B', id: 'participant-b' },
    result: null,
    roundNumber: 1,
    status: 'PENDING_RESULT',
    winnerParticipantId: null,
  }],
  resultProfile: 'SCORE_BASED',
};

describe('ResultsWorkspacePanel double no-show', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends NO_SHOW_BOTH as an administrative resolution without score fields', async () => {
    api.recordMatchResult.mockResolvedValue(workspace);
    render(
      <ResultsWorkspacePanel
        actorId="actor-1"
        canAnnul={false}
        canOperate
        onChange={vi.fn()}
        onError={vi.fn()}
        workspace={workspace}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cargar resultado' }));
    fireEvent.change(screen.getByLabelText('Cómo terminó el encuentro'), {
      target: { value: 'NO_SHOW_BOTH' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a confirmación' }));

    await waitFor(() => expect(api.recordMatchResult).toHaveBeenCalledWith(
      'match-1',
      { profile: 'ADMINISTRATIVE', outcome: 'NO_SHOW_BOTH' },
    ));
    const payload = api.recordMatchResult.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty('scoreA');
    expect(payload).not.toHaveProperty('scoreB');
  });
});
