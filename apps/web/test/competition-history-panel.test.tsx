import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CompetitionHistoryPanel } from '../components/competition-history-panel';
import type { CompetitionHistoryView } from '../lib/competition-history-api';

const history: CompetitionHistoryView = {
  competitionId: 'competition-1',
  executions: [
    {
      annulledAt: null,
      annulmentReason: null,
      bye: null,
      confirmedAt: '2026-08-20T12:00:00.000Z',
      executedAt: '2026-08-20T11:55:00.000Z',
      formatCode: 'GROUP_STAGE',
      groups: [{
        id: 'group-a',
        label: 'A',
        ordinal: 1,
        qualified: [{ displayName: 'Colegio A', id: 'a' }, { displayName: 'Colegio B', id: 'b' }],
        standings: [
          { draws: 0, losses: 0, participant: { displayName: 'Colegio A', id: 'a' }, played: 2, position: 1, scoreAgainst: 1, scoreDifference: 4, scoreFor: 5, setDifference: 0, setsLost: 0, setsWon: 0, sportPointDifference: 4, sportPointsAgainst: 1, sportPointsFor: 5, tablePoints: 6, tied: false, wins: 2 },
          { draws: 0, losses: 1, participant: { displayName: 'Colegio B', id: 'b' }, played: 2, position: 2, scoreAgainst: 3, scoreDifference: 0, scoreFor: 3, setDifference: 0, setsLost: 0, setsWon: 0, sportPointDifference: 0, sportPointsAgainst: 3, sportPointsFor: 3, tablePoints: 3, tied: false, wins: 1 },
        ],
      }],
      id: 'draw-groups',
      matches: [{
        groupLabel: 'A', id: 'match-g', ordinal: 1,
        participantA: { displayName: 'Colegio A', id: 'a' }, participantB: { displayName: 'Colegio B', id: 'b' },
        results: [{ annulledAt: null, annulmentReason: null, confirmedAt: '2026-08-20T12:10:00.000Z', detail: { profile: 'SCORE_BASED', scoreA: 3, scoreB: 1 }, id: 'result-g', recordedAt: '2026-08-20T12:05:00.000Z', resolved: { scoreA: 3, scoreB: 1 }, status: 'CONFIRMED' }],
        roundNumber: 0, status: 'RESULT_CONFIRMED', winnerParticipantId: 'a',
      }],
      publication: null,
      resultProfile: 'SCORE_BASED',
      roundNumber: 0,
      status: 'CONFIRMED',
    },
    {
      annulledAt: null,
      annulmentReason: null,
      bye: { participant: { displayName: 'Colegio A', id: 'a' }, priorByeCount: 0 },
      confirmedAt: '2026-08-21T12:00:00.000Z',
      executedAt: '2026-08-21T11:55:00.000Z',
      formatCode: 'KNOCKOUT',
      groups: [],
      id: 'draw-knockout',
      matches: [{
        groupLabel: null, id: 'match-k', ordinal: 1,
        participantA: { displayName: 'Colegio B', id: 'b' }, participantB: { displayName: 'Colegio C', id: 'c' },
        results: [{ annulledAt: null, annulmentReason: null, confirmedAt: '2026-08-21T12:10:00.000Z', detail: { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 }, id: 'result-k', recordedAt: '2026-08-21T12:05:00.000Z', resolved: { scoreA: 2, scoreB: 0 }, status: 'CONFIRMED' }],
        roundNumber: 1, status: 'RESULT_CONFIRMED', winnerParticipantId: 'b',
      }],
      publication: null,
      resultProfile: 'SCORE_BASED',
      roundNumber: 1,
      status: 'CONFIRMED',
    },
  ],
};

describe('CompetitionHistoryPanel', () => {
  it('separates group standings from match results while preserving previous knockout rounds', () => {
    render(<CompetitionHistoryPanel history={history} />);

    expect(screen.getByText('Recorrido completo')).toBeInTheDocument();
    expect(screen.getAllByText('Fase de grupos')).toHaveLength(2);
    expect(screen.getAllByText('Eliminación directa · Ronda 1')).toHaveLength(2);
    expect(screen.getByText('Tabla final de grupos')).toBeInTheDocument();
    expect(screen.getByText('Resultados de la fase')).toBeInTheDocument();
    expect(screen.getByText('Resultados eliminatorios')).toBeInTheDocument();
    expect(screen.getByText(/Clasificados:/)).toHaveTextContent('Colegio A · Colegio B');
    expect(screen.getByText(/BYE:/)).toBeInTheDocument();
    expect(screen.getByText('3 — 1')).toBeInTheDocument();
    expect(screen.getByText('2 — 0')).toBeInTheDocument();

    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(3);
    const standings = screen.getByRole('table', { name: 'Tabla final del grupo A' });
    expect(within(standings).getByText('6')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Resultados históricos del grupo A' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Resultados históricos de la ronda 1' })).toBeInTheDocument();
  });
});
