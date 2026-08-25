'use client';

import { Card, Chip } from '@heroui/react';

import type {
  CompetitionHistoryView,
  HistoryExecutionView,
  HistoryMatchView,
  HistoryResultView,
} from '../lib/competition-history-api';
import { DataTable, type DataTableColumn, SectionPanel } from '../ui';
import styles from './competition-history-panel.module.css';

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

function resultState(match: HistoryMatchView): { readonly color: 'danger' | 'default' | 'success' | 'warning'; readonly label: string } {
  const result = latestVisibleResult(match);
  const annulledCount = match.results.filter(({ status }) => status === 'ANNULLED').length;
  if (result?.status === 'CONFIRMED') return { color: 'success', label: annulledCount > 0 ? `Confirmado · ${String(annulledCount)} anulado(s)` : 'Confirmado' };
  if (result?.status === 'PENDING_CONFIRMATION') return { color: 'warning', label: 'Pendiente' };
  if (result?.status === 'ANNULLED') return { color: 'danger', label: 'Anulado' };
  return { color: 'default', label: 'Sin resultado' };
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
    { id: 'participantA', label: 'Participante A', render: (match) => <strong>{match.participantA.displayName}</strong> },
    { id: 'result', label: 'Resultado', render: (match) => { const result = latestVisibleResult(match); return <span className={styles.score ?? ''}>{result === null ? '—' : scoreLabel(execution, result)}</span>; } },
    { id: 'participantB', label: 'Participante B', render: (match) => <strong>{match.participantB.displayName}</strong> },
    { id: 'status', label: 'Estado', render: (match) => { const state = resultState(match); return <Chip color={state.color} size="sm" variant="soft">{state.label}</Chip>; } },
  ];
}

function GroupStandingBlock({ execution, group }: { readonly execution: HistoryExecutionView; readonly group: HistoryExecutionView['groups'][number] }): React.JSX.Element {
  const setBased = execution.resultProfile === 'SET_BASED';
  return <section className={styles.groupBlock ?? ''} aria-labelledby={`history-group-${group.id}`}>
    <header className={styles.groupHeader ?? ''}>
      <div><span>Tabla final</span><h5 id={`history-group-${group.id}`}>Grupo {group.label}</h5></div>
      <Chip size="sm" variant="soft">{group.standings.length} equipos</Chip>
    </header>
    <DataTable columns={standingColumns(setBased)} getRowKey={(row) => row.participant.id} label={`Tabla final del grupo ${group.label}`} rows={group.standings} width={setBased ? 'medium' : 'wide'} />
    {group.qualified.length === 0 ? null : <p className={styles.qualifiers ?? ''}><strong>Clasificados:</strong> {group.qualified.map(({ displayName }) => displayName).join(' · ')}</p>}
  </section>;
}

function ResultsZone({ execution }: { readonly execution: HistoryExecutionView }): React.JSX.Element {
  if (execution.matches.length === 0) return <p className={styles.empty ?? ''}>Esta ejecución no materializó encuentros.</p>;

  if (execution.formatCode === 'GROUP_STAGE') {
    const labels = [...new Set(execution.matches.map(({ groupLabel }) => groupLabel).filter((label): label is string => label !== null))];
    return <div className={styles.resultsStack ?? ''}>{labels.map((label) => {
      const matches = execution.matches.filter((match) => match.groupLabel === label);
      return <section className={styles.resultGroup ?? ''} key={label} aria-label={`Resultados del grupo ${label}`}>
        <div className={styles.resultGroupTitle ?? ''}><span>Grupo {label}</span><Chip size="sm" variant="soft">{matches.length} partidos</Chip></div>
        <DataTable columns={matchColumns(execution)} getRowKey={(match) => match.id} label={`Resultados históricos del grupo ${label}`} rows={matches} width="wide" />
      </section>;
    })}</div>;
  }

  return <DataTable columns={matchColumns(execution)} getRowKey={(match) => match.id} label={`Resultados históricos de la ronda ${String(execution.roundNumber)}`} rows={execution.matches} width="wide" />;
}

function executionTitle(execution: HistoryExecutionView): string {
  return execution.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Eliminación directa · Ronda ${String(execution.roundNumber)}`;
}

function ExecutionHistory({ execution }: { readonly execution: HistoryExecutionView }): React.JSX.Element {
  const title = executionTitle(execution);
  const isGroupStage = execution.formatCode === 'GROUP_STAGE';
  return <Card className={styles.executionCard ?? ''}>
    <Card.Header className={styles.executionHeader ?? ''}>
      <div className={styles.executionTitle ?? ''}>
        <span>{execution.status === 'ANNULLED' ? 'Ejecución anulada' : 'Ejecución oficial'}</span>
        <strong>{title}</strong>
      </div>
      <Chip color={execution.status === 'ANNULLED' ? 'danger' : 'default'} size="sm" variant="soft">{execution.status === 'ANNULLED' ? 'Anulada' : 'Histórico'}</Chip>
    </Card.Header>
    <Card.Content className={styles.executionContent ?? ''}>
      {execution.status === 'ANNULLED' && execution.annulmentReason !== null ? <p className={styles.contextNote ?? ''}>Motivo de anulación: {execution.annulmentReason}</p> : null}
      {execution.bye === null ? null : <p className={styles.contextNote ?? ''}><strong>BYE:</strong> {execution.bye.participant.displayName} · pases libres previos: {execution.bye.priorByeCount}</p>}

      {isGroupStage ? <section className={styles.zone ?? ''} aria-labelledby={`standings-${execution.id}`}>
        <header className={styles.zoneHeader ?? ''}>
          <div className={styles.zoneHeaderCopy ?? ''}>
            <span>Clasificación</span>
            <h4 id={`standings-${execution.id}`}>Tabla final de grupos</h4>
            <p>Esta sección representa el puntaje y el orden final. No es un listado de resultados de partidos.</p>
          </div>
          <Chip size="sm" variant="soft">{execution.groups.length} {execution.groups.length === 1 ? 'grupo' : 'grupos'}</Chip>
        </header>
        <div className={styles.groupsGrid ?? ''}>{execution.groups.map((group) => <GroupStandingBlock execution={execution} group={group} key={group.id} />)}</div>
      </section> : null}

      <section className={styles.zone ?? ''} aria-labelledby={`results-${execution.id}`}>
        <header className={styles.zoneHeader ?? ''}>
          <div className={styles.zoneHeaderCopy ?? ''}>
            <span>Partidos</span>
            <h4 id={`results-${execution.id}`}>{isGroupStage ? 'Resultados de la fase' : 'Resultados eliminatorios'}</h4>
            <p>{isGroupStage ? 'Marcadores oficiales organizados por grupo, separados de la clasificación.' : 'Cruces y marcadores oficiales correspondientes exclusivamente a esta ronda.'}</p>
          </div>
          <Chip size="sm" variant="soft">{execution.matches.length} {execution.matches.length === 1 ? 'encuentro' : 'encuentros'}</Chip>
        </header>
        <ResultsZone execution={execution} />
      </section>
    </Card.Content>
  </Card>;
}

export function CompetitionHistoryPanel({ history }: { readonly history: CompetitionHistoryView }): React.JSX.Element {
  const groupExecutions = history.executions.filter(({ formatCode }) => formatCode === 'GROUP_STAGE').length;
  const knockoutExecutions = history.executions.filter(({ formatCode }) => formatCode === 'KNOCKOUT').length;

  return <SectionPanel className={styles.panel ?? ''} id="competition-history" eyebrow="Historial" title="Recorrido completo" status={<Chip size="sm" variant="soft">{history.executions.length}</Chip>}>
    <div className={styles.intro ?? ''}>
      <p>El historial conserva la evidencia oficial de cada etapa. La clasificación de grupos y los resultados de partidos se presentan como conceptos distintos para evitar interpretaciones incorrectas.</p>
      <div className={styles.summary ?? ''} aria-label="Resumen del historial">
        {groupExecutions > 0 ? <Chip size="sm" variant="soft">{groupExecutions} fase de grupos</Chip> : null}
        {knockoutExecutions > 0 ? <Chip size="sm" variant="soft">{knockoutExecutions} {knockoutExecutions === 1 ? 'ronda eliminatoria' : 'rondas eliminatorias'}</Chip> : null}
      </div>
    </div>

    {history.executions.length === 0 ? <p className={styles.empty ?? ''}>El historial aparecerá después del primer sorteo oficial confirmado.</p> : <>
      <ol className={styles.sequence ?? ''} aria-label="Secuencia competitiva histórica">
        {history.executions.map((execution, index) => <li key={execution.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{executionTitle(execution)}</strong></li>)}
      </ol>
      <div className={styles.list ?? ''}>{history.executions.map((execution) => <ExecutionHistory execution={execution} key={execution.id} />)}</div>
    </>}
  </SectionPanel>;
}
