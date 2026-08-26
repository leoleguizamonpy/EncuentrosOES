import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionRulesPanel } from '../components/competition-rules-panel';
import type { CompetitionDetail, CompetitionRuleSet } from '../lib/competition-api';

const competitionApi = vi.hoisted(() => ({
  freezeCompetitionRuleSet: vi.fn(),
  saveCompetitionRuleSet: vi.fn(),
}));
vi.mock('../lib/competition-api', () => competitionApi);

const base: CompetitionDetail = {
  createdAt: '2026-08-13T18:00:00.000Z',
  edition: { id: 'edition-1', name: 'OES 2026', year: 2026 },
  event: { code: 'COL', id: 'event-1', name: 'Colegiales' },
  formatCode: 'GROUP_STAGE',
  groupCount: 1,
  id: 'competition-1',
  institutions: [],
  modality: { code: 'MALE', id: 'modality-1', name: 'Masculina' },
  participantCount: 3,
  participants: [],
  revision: 4,
  ruleSet: null,
  sport: { code: 'FUTSAL', id: 'sport-1', name: 'Futsal' },
  status: 'DRAFT',
  validGroupCounts: [1],
};

const draftRuleSet = {
  allowDraws: true,
  canonicalHash: null,
  drawPoints: 1,
  frozenAt: null,
  id: 'rule-set-1',
  lossPoints: 0,
  resultProfile: 'SCORE_BASED',
  revision: 1,
  status: 'DRAFT',
  tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'SCORE_DIFFERENCE'],
  winPoints: 3,
} satisfies CompetitionRuleSet;

const draft: CompetitionDetail = {
  ...base,
  ruleSet: draftRuleSet,
};

describe('CompetitionRulesPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes scoring and tie-break configuration as distinct semantic zones', () => {
    render(<CompetitionRulesPanel canEdit detail={base} onChange={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Perfil de puntuación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Orden de desempate' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tipo de resultado' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Prioridad de criterios de desempate' })).toBeInTheDocument();
  });

  it('saves an explicit scoring template with ordered criteria', async () => {
    const onChange = vi.fn();
    competitionApi.saveCompetitionRuleSet.mockResolvedValue(draft);
    render(<CompetitionRulesPanel canEdit detail={base} onChange={onChange} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar plantilla' }));

    await waitFor(() => expect(competitionApi.saveCompetitionRuleSet).toHaveBeenCalledWith('competition-1', {
      allowDraws: true,
      drawPoints: 1,
      expectedRevision: null,
      lossPoints: 0,
      resultProfile: 'SCORE_BASED',
      tieBreakCriteria: ['TABLE_POINTS', 'WINS', 'HEAD_TO_HEAD_TABLE_POINTS', 'SCORE_DIFFERENCE', 'SCORE_FOR'],
      winPoints: 3,
    }));
    expect(onChange).toHaveBeenCalledWith(draft);
  });

  it('requires a second action before irreversibly freezing the current revision', async () => {
    const frozen = { ...draft, ruleSet: { ...draftRuleSet, canonicalHash: 'a'.repeat(64), frozenAt: '2026-08-13T18:02:00.000Z', revision: 2, status: 'FROZEN' as const } };
    competitionApi.freezeCompetitionRuleSet.mockResolvedValue(frozen);
    render(<CompetitionRulesPanel canEdit detail={draft} onChange={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Congelar reglas' }));
    expect(competitionApi.freezeCompetitionRuleSet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar congelamiento' }));

    await waitFor(() => expect(competitionApi.freezeCompetitionRuleSet).toHaveBeenCalledWith('competition-1', 1));
  });

  it('renders a frozen template as read-only evidence', () => {
    const frozen: CompetitionDetail = { ...draft, ruleSet: { ...draftRuleSet, canonicalHash: 'b'.repeat(64), frozenAt: '2026-08-13T18:02:00.000Z', revision: 2, status: 'FROZEN' } };
    render(<CompetitionRulesPanel canEdit={false} detail={frozen} onChange={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByText('Plantilla inmutable')).toBeInTheDocument();
    expect(screen.getByText('Ver hash verificable')).toBeInTheDocument();
    expect(screen.getByText('b'.repeat(64))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar borrador' })).not.toBeInTheDocument();
  });
});
