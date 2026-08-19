import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChampionPanel } from '../components/champion-panel';
import type { ChampionView } from '../lib/champion-api';
import type { DrawWorkspace, ResultsWorkspace } from '../lib/competition-api';

const api = vi.hoisted(() => ({ confirmChampion: vi.fn(), proposeChampion: vi.fn() }));
vi.mock('../lib/champion-api', async (importOriginal) => ({ ...await importOriginal(), ...api }));

const draw: DrawWorkspace = {
  competitionId: 'competition-1',
  competitionRevision: 7,
  competitionStatus: 'LOCKED',
  configuration: { canonicalHash: 'hash', formatCode: 'KNOCKOUT', groupCount: null, id: 'configuration-final', participantCount: 2, revision: 2, roundNumber: 3, status: 'FROZEN' },
  execution: {
    confirmedAt: '2026-08-19T17:00:00.000Z', confirmedBy: { displayName: 'Autoridad Dos', id: 'actor-2' }, evidenceHash: 'evidence',
    executedAt: '2026-08-19T16:55:00.000Z', executedBy: { displayName: 'Autoridad Uno', id: 'actor-1' }, id: 'execution-final', matchCount: 1,
    result: { bye: null, formatCode: 'KNOCKOUT', pairings: [{ ordinal: 1, participantA: { displayName: 'Colegio A', id: 'participant-a' }, participantB: { displayName: 'Colegio B', id: 'participant-b' } }], roundNumber: 3 },
    revision: 2, seedCommitment: 'commitment', seedHex: 'seed', status: 'CONFIRMED',
  },
  publication: null,
};

const results: ResultsWorkspace = {
  competitionId: 'competition-1', competitionStatus: 'LOCKED', groups: [], resultProfile: 'SCORE_BASED',
  matches: [{ group: null, id: 'match-final', ordinal: 1, participantA: { displayName: 'Colegio A', id: 'participant-a' }, participantB: { displayName: 'Colegio B', id: 'participant-b' }, result: null, roundNumber: 3, status: 'RESULT_CONFIRMED', winnerParticipantId: 'participant-a' }],
};

const proposal: ChampionView = {
  competitionId: 'competition-1', competitionRevision: 8, confirmedAt: null, confirmedBy: null,
  participantDisplayName: 'Colegio A', participantId: 'participant-a', proposalId: '00000000-0000-4000-8000-000000000099',
  proposedAt: '2026-08-19T17:05:00.000Z', proposedBy: 'actor-1', sourceExecutionId: 'execution-final', sourceMatchId: 'match-final',
  sourceResultId: 'result-final', sourceRoundNumber: 3, status: 'PENDING_CONFIRMATION',
};

describe('ChampionPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proposes only after a resolved final', async () => {
    api.proposeChampion.mockResolvedValue(proposal);
    const onChange = vi.fn();
    render(<ChampionPanel actorId="actor-1" canOperate champion={null} competitionId="competition-1" draw={draw} onChange={onChange} onError={vi.fn()} results={results} />);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer campeón' }));
    await waitFor(() => expect(api.proposeChampion).toHaveBeenCalledWith('competition-1', 7));
    expect(onChange).toHaveBeenCalledWith(proposal);
  });

  it('requires a different authority to confirm and finalize', async () => {
    const confirmed: ChampionView = { ...proposal, competitionRevision: 9, confirmedAt: '2026-08-19T17:06:00.000Z', confirmedBy: 'actor-2', status: 'CONFIRMED' };
    api.confirmChampion.mockResolvedValue(confirmed);
    const onChange = vi.fn();
    const { rerender } = render(<ChampionPanel actorId="actor-1" canOperate champion={proposal} competitionId="competition-1" draw={draw} onChange={onChange} onError={vi.fn()} results={results} />);
    expect(screen.getByText(/Otra autoridad debe confirmar al campeón/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar campeón y finalizar' })).not.toBeInTheDocument();

    rerender(<ChampionPanel actorId="actor-2" canOperate champion={proposal} competitionId="competition-1" draw={draw} onChange={onChange} onError={vi.fn()} results={results} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar campeón y finalizar' }));
    await waitFor(() => expect(api.confirmChampion).toHaveBeenCalledWith('competition-1', proposal.proposalId, 8));
    expect(onChange).toHaveBeenCalledWith(confirmed);
  });

  it('stays hidden when the latest knockout round is not a real final', () => {
    const { container } = render(<ChampionPanel actorId="actor-1" canOperate champion={null} competitionId="competition-1" draw={{ ...draw, execution: draw.execution === null ? null : { ...draw.execution, result: { ...draw.execution.result, bye: { participant: { displayName: 'Colegio C', id: 'participant-c' }, priorByeCount: 0 } } } }} onChange={vi.fn()} onError={vi.fn()} results={results} />);
    expect(container).toBeEmptyDOMElement();
  });
});
