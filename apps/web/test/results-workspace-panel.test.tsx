import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultsWorkspacePanel } from '../components/results-workspace-panel';
import type { ResultsWorkspace } from '../lib/competition-api';

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
  it('shows persisted matches and the automatically calculated table', () => {
    render(<ResultsWorkspacePanel workspace={workspace} />);
    expect(screen.getByText('3 — 1')).toBeInTheDocument();
    expect(screen.getByText('Resultado confirmado')).toBeInTheDocument();
    expect(screen.getByText(/confirmado por Autoridad Dos/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Colegio A')).toBeInTheDocument();
    expect(within(table).getByText('Pts.')).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
  });

  it('explains why there are no matches before draw confirmation', () => {
    render(<ResultsWorkspacePanel workspace={{ competitionId: 'competition-1', competitionStatus: 'LOCKED', groups: [], matches: [], resultProfile: null }} />);
    expect(screen.getByText(/otra autoridad confirme el sorteo oficial/i)).toBeInTheDocument();
  });
});
