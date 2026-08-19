import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NextRoundPanel } from '../components/next-round-panel';
import type { DrawWorkspace, ResultsWorkspace } from '../lib/competition-api';

const api = vi.hoisted(() => ({ drawWorkspace: vi.fn(), prepareNextRound: vi.fn() }));
vi.mock('../lib/competition-api', async (importOriginal) => ({ ...await importOriginal(), drawWorkspace: api.drawWorkspace }));
vi.mock('../lib/continuity-api', () => ({ prepareNextRound: api.prepareNextRound }));

const draw: DrawWorkspace = {
  competitionId: 'competition-1',
  competitionRevision: 8,
  competitionStatus: 'LOCKED',
  configuration: { canonicalHash: 'hash-stage', formatCode: 'GROUP_STAGE', groupCount: 1, id: 'configuration-1', participantCount: 4, revision: 2, roundNumber: 0, status: 'FROZEN' },
  execution: {
    confirmedAt: '2026-08-19T15:00:00.000Z',
    confirmedBy: { displayName: 'Autoridad Dos', id: 'actor-2' },
    evidenceHash: 'evidence',
    executedAt: '2026-08-19T14:00:00.000Z',
    executedBy: { displayName: 'Autoridad Uno', id: 'actor-1' },
    id: 'draw-1',
    matchCount: 6,
    result: { formatCode: 'GROUP_STAGE', groups: [] },
    revision: 2,
    seedCommitment: 'commitment',
    seedHex: 'seed',
    status: 'CONFIRMED',
  },
  publication: null,
};

const qualification = {
  confirmedAt: '2026-08-19T16:00:00.000Z',
  confirmedBy: { displayName: 'Autoridad Dos', id: 'actor-2' },
  firstParticipant: { displayName: 'Colegio A', id: 'participant-a' },
  id: 'qualification-1',
  proposedAt: '2026-08-19T15:30:00.000Z',
  proposedBy: { displayName: 'Autoridad Uno', id: 'actor-1' },
  revision: 2,
  secondParticipant: { displayName: 'Colegio B', id: 'participant-b' },
  status: 'CONFIRMED' as const,
};

const results: ResultsWorkspace = {
  competitionId: 'competition-1',
  competitionStatus: 'LOCKED',
  groups: [{ complete: true, id: 'group-a', label: 'A', ordinal: 1, qualification, standings: [] }],
  matches: [{
    group: { id: 'group-a', label: 'A' },
    id: 'match-1',
    ordinal: 1,
    participantA: { displayName: 'Colegio A', id: 'participant-a' },
    participantB: { displayName: 'Colegio B', id: 'participant-b' },
    result: null,
    roundNumber: 0,
    status: 'RESULT_CONFIRMED',
    winnerParticipantId: 'participant-a',
  }],
  resultProfile: 'SCORE_BASED',
};

describe('NextRoundPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appears only after confirmed advances and refreshes the draw workspace', async () => {
    const refreshed: DrawWorkspace = {
      ...draw,
      competitionRevision: 9,
      configuration: { canonicalHash: 'hash-next', formatCode: 'KNOCKOUT', groupCount: null, id: 'configuration-2', participantCount: 2, revision: 2, roundNumber: 1, status: 'FROZEN' },
      execution: null,
    };
    api.prepareNextRound.mockResolvedValue({ competitionId: 'competition-1', competitionRevision: 9, configuration: { canonicalHash: 'hash-next', id: 'configuration-2', participantCount: 2, roundNumber: 1, status: 'FROZEN' } });
    api.drawWorkspace.mockResolvedValue(refreshed);
    const onChange = vi.fn();

    render(<NextRoundPanel canOperate competitionId="competition-1" draw={draw} onChange={onChange} onError={vi.fn()} results={results} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preparar ronda 1' }));

    await waitFor(() => expect(api.prepareNextRound).toHaveBeenCalledWith('competition-1', 8));
    expect(api.drawWorkspace).toHaveBeenCalledWith('competition-1');
    expect(onChange).toHaveBeenCalledWith(refreshed);
  });

  it('stays hidden while a group qualification is pending', () => {
    const sourceGroup = results.groups[0];
    if (sourceGroup === undefined) throw new Error('Expected group fixture');
    const pending: ResultsWorkspace = {
      ...results,
      groups: [{ ...sourceGroup, qualification: { ...qualification, confirmedAt: null, confirmedBy: null, status: 'PENDING_CONFIRMATION' } }],
    };
    const { container } = render(<NextRoundPanel canOperate competitionId="competition-1" draw={draw} onChange={vi.fn()} onError={vi.fn()} results={pending} />);
    expect(container).toBeEmptyDOMElement();
  });
});
