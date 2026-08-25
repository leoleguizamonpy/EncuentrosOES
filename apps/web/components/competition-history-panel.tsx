'use client';

import { Card, Chip } from '@heroui/react';

import type {
  CompetitionHistoryView,
  HistoryExecutionView,
  HistoryMatchView,
  HistoryResultView,
} from '../lib/competition-history-api';
import { DataTable, type DataTableColumn, SectionPanel } from '../ui';

type HistoryStanding = HistoryExecutionView['groups'][number]['standings'][number];

function numberField(value: unknown, field: string): number | null {
  if (typeof value !== 'object' || value === null || !(field in value)) return null;
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === 'number' ? candidate : null;
}

function stringField(value: unknown, field: string): string | null {
  if (typeof value !== 'object' || value === null || !(field in value)) return null;
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === 'string' ? candidate : null;
}

function objectField(value: unknown, field: string): unknown {
  if (typeof value !== 'object' || value === null || !(field in value)) return null;
  return (value as Record<string, unknown>)[field];
}

function latestVisibleResult(match: HistoryMatchView): HistoryResultView | null {
  const active = [...match.results].reverse().find((result) => result.status !== 'ANNULLED');
  return active ?? match.results.at(-1) ?? null;
}

function administrativeLabel(outcome: string): string {
  const labels: Readonly<Record<string, string>> = {
    ABANDONED_A: 'Abandono del participante A',
    ABANDONED_B: 'Abandono del participante B',
    NO_SHOW_A: 'Incomparecencia del participante A',
    NO_SHOW_B: 'Incomparecencia del participante B',
    NO_SHOW_BOTH: 'Incomparecencia de ambos participantes',
    WITHDRAWN_A: 'Retirada del participante A',
    WITHDRAWN_B: 'Retirada del participante B',
  };
  return labels[outcome] ?? 'Resolución administrativa';
}

function scoreLabel(execution: HistoryExecutionView, result: HistoryResultView): string {
  if (result.status === 'ANNULLED') return 'Resultado anulado';
  const profile = stringField(result.detail, 'profile');
  if (profile === 'ADMINISTRATIVE') {
    const outcome = stringField(result.detail, 'outcome');
    return outcome === null ? 'Resolución administrativa' : administrativeLabel(outcome);
  }
  if (execution.resultProfile === 'SET_BASED') {
    const a = numberField(result.resolved, 'setsWonA');
    const b = numberField(result.resolved, 'setsWonB');
    return a === null || b === null ? 'Resultado registrado' : `${String(a)} — ${String(b)} sets`;
  }
  const a = numberField(result.detail, 'scoreA');
  const b = numberField(result.detail, 'scoreB');
  if (a === null || b === null) return 'Resultado registrado';
  const tieBreak = objectField(result.detail, 'tieBreak');
  const penaltyA = numberField(tieBreak, 'scoreA');
  const penaltyB = numberField(tieBreak, 'scoreB');
  return penaltyA === null || penaltyB === null ? `${String(a)} — ${String(b)}` : `${String(a)} — ${String(b)} · penales ${String(penaltyA)} — ${String(penaltyB)}`;
}

function standingColumns(setBased: boolean): readonly DataTableColumn<HistoryStanding>[] {
  const columns: DataTableColumn<HistoryStanding>[] = [
    { id: 'position', label: 'Pos.', render: (row) => <>{row.position}{row.tied ? '=' : ''}</> },
    { id: 'participant', label: 'Participante', render: (row) => <strong>{row.participant.displayName}</strong> },
    { id: 'played', label: 'J', render: (row) => row.played },
    { id: 'wins', label: 'G', render: (row) => row.wins },
  ];
  if (!setBased) columns.push({ id: 'draws', label: 'E', render: (row) => row.draws });
  columns.push(
    { id: 'losses', label: 'P', render: (row) => row.losses },
    { id: 'points', label: 'Pts.', render: (row) => <strong>{row.tablePoints}</strong> },
  );
  if (setBased) columns.push(
    { id: 'sets', label: 'SG', render: (row) => row.setDifference },
    { id: 'difference', label: 'DP', render: (row) => row.sportPointDifference },
  );
  else columns.push(
    { id: 'for', label: 'GF', render: (row) => row.scoreFor },
    { id: 'against', label: 'GC', render: (row) => row.scoreAgainst },
    { id: 'difference', label: 'DG', render: (row) => row.scoreDifference },
  );
  return columns;
}

function matchColumns(execution: HistoryExecutionView): readonly DataTableColumn<HistoryMatchView>[] {
  return [
    { id: 'phase', label: 'Fase', render: (match) => match.groupLabel === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.groupLabel}` },
    { id: 'participantA', label: 'Participante A', render: (match) => <strong>{match.participantA.displayName}</strong> },
    { id: 'result', label: 'Resultado', render: (match) => { const result = latestVisibleResult(match); return result === null ? '—' : scoreLabel(execution, result); } },
    { id: 'participantB', label: 'Participante B', render: (match) => <strong>{match.participantB.displayName}</strong> },
    { id: 'status', label: 'Estado', render: (match) => { const result = latestVisibleResult(match); const annulledCount = match.results.filter(({ status }) => status === 'ANNULLED').length; const state = result?.status === 'CONFIRMED' ? 'Confirmado' : result?.status === 'PENDING_CONFIRMATION' ? 'Pendiente' : result?.status === 'ANNULLED' ? 'Anulado' : 'Sin resultado'; return `${state}${annulledCount > 0 ? ` · ${String(annulledCount)} anulado(s)` : ''}`; } },
  ];
}

function GroupStandingTable({ execution, group }: { readonly execution: HistoryExecutionView; readonly group: HistoryExecutionView['groups'][number] }): React.JSX.Element {
  const setBased = execution.resultProfile === 'SET_BASED';
  return <DataTable columns={standingColumns(setBased)} getRowKey={(row) => row.participant.id} label={`Tabla final del grupo ${group.label}`} rows={group.standings} width={setBased ? 'medium' : 'wide'} />;
}

function ExecutionHistory({ execution }: { readonly execution: HistoryExecutionView }): React.JSX.Element {
  const title = execution.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Eliminación directa · Ronda ${String(execution.roundNumber)}`;
  return <Card className="standing-card competition-history__execution">
    <Card.Header><div><span>{execution.status === 'ANNULLED' ? 'Ejecución anulada' : 'Ejecución oficial'}</span><strong>{title}</strong></div><Chip color={execution.status === 'ANNULLED' ? 'danger' : 'default'} size="sm" variant="soft">{execution.status === 'ANNULLED' ? 'Anulada' : 'Histórico'}</Chip></Card.Header>
    <Card.Content>
      {execution.status === 'ANNULLED' && execution.annulmentReason !== null ? <p className="readonly-note">Motivo: {execution.annulmentReason}</p> : null}
      {execution.bye === null ? null : <p className="format-proof format-proof--ready"><strong>BYE:</strong> {execution.bye.participant.displayName} · pases libres previos: {execution.bye.priorByeCount}</p>}
      {execution.groups.map((group) => <section key={group.id} className="competition-history__group" aria-label={`Historial del grupo ${group.label}`}><header><span>Tabla final</span><h4>Grupo {group.label}</h4><Chip size="sm" variant="soft">{group.standings.length}</Chip></header><GroupStandingTable execution={execution} group={group} />{group.qualified.length === 0 ? null : <p className="format-proof format-proof--ready">Clasificados: {group.qualified.map(({ displayName }) => displayName).join(' · ')}</p>}</section>)}
      {execution.matches.length === 0 ? <p className="setup-empty">Esta ejecución no materializó encuentros.</p> : <DataTable columns={matchColumns(execution)} getRowKey={(match) => match.id} label={`Encuentros históricos de ${title}`} rows={execution.matches} width="wide" />}
    </Card.Content>
  </Card>;
}

export function CompetitionHistoryPanel({ history }: { readonly history: CompetitionHistoryView }): React.JSX.Element {
  return <SectionPanel className="competition-history" id="competition-history" eyebrow="Historial" title="Recorrido completo" status={<Chip size="sm" variant="soft">{history.executions.length}</Chip>}>
    <p className="readonly-note">Las rondas anteriores permanecen consultables aunque la competencia avance a un nuevo sorteo.</p>
    {history.executions.length === 0 ? <div className="setup-empty">El historial aparecerá después del primer sorteo oficial confirmado.</div> : <div className="competition-history__list">{history.executions.map((execution) => <ExecutionHistory execution={execution} key={execution.id} />)}</div>}
  </SectionPanel>;
}
