'use client';

import { Card, Chip } from '@heroui/react';

import type {
  CompetitionHistoryView,
  HistoryExecutionView,
  HistoryMatchView,
  HistoryResultView,
} from '../lib/competition-history-api';

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

function HistoricalMatch({ execution, match }: { readonly execution: HistoryExecutionView; readonly match: HistoryMatchView }): React.JSX.Element {
  const result = latestVisibleResult(match);
  const annulledCount = match.results.filter(({ status }) => status === 'ANNULLED').length;
  return <tr><td>{match.groupLabel === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.groupLabel}`}</td><th>{match.participantA.displayName}</th><td>{result === null ? '—' : scoreLabel(execution, result)}</td><th>{match.participantB.displayName}</th><td>{result?.status === 'CONFIRMED' ? 'Confirmado' : result?.status === 'PENDING_CONFIRMATION' ? 'Pendiente' : result?.status === 'ANNULLED' ? 'Anulado' : 'Sin resultado'}{annulledCount > 0 ? ` · ${String(annulledCount)} anulado(s)` : ''}</td></tr>;
}

function GroupStandingTable({ execution, group }: { readonly execution: HistoryExecutionView; readonly group: HistoryExecutionView['groups'][number] }): React.JSX.Element {
  const setBased = execution.resultProfile === 'SET_BASED';
  return <div className="standing-scroll"><table><thead><tr><th>Pos.</th><th>Participante</th><th>J</th><th>G</th>{setBased ? null : <th>E</th>}<th>P</th><th>Pts.</th>{setBased ? <><th>SG</th><th>DP</th></> : <><th>GF</th><th>GC</th><th>DG</th></>}</tr></thead><tbody>{group.standings.map((row) => <tr key={row.participant.id}><td>{row.position}{row.tied ? '=' : ''}</td><th>{row.participant.displayName}</th><td>{row.played}</td><td>{row.wins}</td>{setBased ? null : <td>{row.draws}</td>}<td>{row.losses}</td><td><strong>{row.tablePoints}</strong></td>{setBased ? <><td>{row.setDifference}</td><td>{row.sportPointDifference}</td></> : <><td>{row.scoreFor}</td><td>{row.scoreAgainst}</td><td>{row.scoreDifference}</td></>}</tr>)}</tbody></table></div>;
}

function ExecutionHistory({ execution }: { readonly execution: HistoryExecutionView }): React.JSX.Element {
  const title = execution.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Eliminación directa · Ronda ${String(execution.roundNumber)}`;
  return <Card className="standing-card competition-history__execution">
    <Card.Header><div><span>{execution.status === 'ANNULLED' ? 'Ejecución anulada' : 'Ejecución oficial'}</span><strong>{title}</strong></div><Chip color={execution.status === 'ANNULLED' ? 'danger' : 'default'} size="sm" variant="soft">{execution.status === 'ANNULLED' ? 'Anulada' : 'Histórico'}</Chip></Card.Header>
    <Card.Content>
      {execution.status === 'ANNULLED' && execution.annulmentReason !== null ? <p className="readonly-note">Motivo: {execution.annulmentReason}</p> : null}
      {execution.bye === null ? null : <p className="format-proof format-proof--ready"><strong>BYE:</strong> {execution.bye.participant.displayName} · pases libres previos: {execution.bye.priorByeCount}</p>}
      {execution.groups.map((group) => <section key={group.id} className="competition-history__group" aria-label={`Historial del grupo ${group.label}`}><div className="section-title"><div><span className="eyebrow eyebrow--dark">Tabla final</span><h3>Grupo {group.label}</h3></div><Chip size="sm" variant="soft">{group.standings.length}</Chip></div><GroupStandingTable execution={execution} group={group} />{group.qualified.length === 0 ? null : <p className="format-proof format-proof--ready">Clasificados: {group.qualified.map(({ displayName }) => displayName).join(' · ')}</p>}</section>)}
      {execution.matches.length === 0 ? <p className="setup-empty">Esta ejecución no materializó encuentros.</p> : <div className="standing-scroll"><table><thead><tr><th>Fase</th><th>Participante A</th><th>Resultado</th><th>Participante B</th><th>Estado</th></tr></thead><tbody>{execution.matches.map((match) => <HistoricalMatch execution={execution} key={match.id} match={match} />)}</tbody></table></div>}
    </Card.Content>
  </Card>;
}

export function CompetitionHistoryPanel({ history }: { readonly history: CompetitionHistoryView }): React.JSX.Element {
  return <Card className="setup-card competition-history" id="competition-history" aria-labelledby="competition-history-title">
    <Card.Content>
      <div className="section-title"><div><span className="eyebrow eyebrow--dark">Historial</span><h3 id="competition-history-title">Recorrido completo</h3></div><Chip size="sm" variant="soft">{history.executions.length}</Chip></div>
      <p className="readonly-note">Las rondas anteriores permanecen consultables aunque la competencia avance a un nuevo sorteo.</p>
      {history.executions.length === 0 ? <div className="setup-empty">El historial aparecerá después del primer sorteo oficial confirmado.</div> : <div className="competition-history__list">{history.executions.map((execution) => <ExecutionHistory execution={execution} key={execution.id} />)}</div>}
    </Card.Content>
  </Card>;
}
