'use client';

import { Alert, Chip, Input } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';

import {
  competitions,
  resultsWorkspace,
  type CompetitionSummary,
  type ResultMatchView,
} from '../lib/competition-api';
import { AppShell } from './app-shell';
import styles from './matches-client.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type MatchFilter = 'ALL' | 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'PENDING_RESULT';

interface MatchRow {
  readonly competition: CompetitionSummary;
  readonly match: ResultMatchView;
}

interface CompetitionMatchesLoad {
  readonly failed: boolean;
  readonly rows: readonly MatchRow[];
}

const statusLabel: Readonly<Record<ResultMatchView['status'], string>> = {
  PENDING_RESULT: 'Pendiente de resultado',
  RESULT_CONFIRMED: 'Resultado confirmado',
  RESULT_PENDING_CONFIRMATION: 'Pendiente de confirmación',
};

function filterOf(status: ResultMatchView['status']): Exclude<MatchFilter, 'ALL'> {
  if (status === 'RESULT_CONFIRMED') return 'CONFIRMED';
  if (status === 'RESULT_PENDING_CONFIRMATION') return 'PENDING_CONFIRMATION';
  return 'PENDING_RESULT';
}

function scoreOf(match: ResultMatchView): string {
  if (match.result === null) return 'VS';
  if (match.result.detail.profile === 'SCORE_BASED') return `${String(match.result.detail.scoreA)} — ${String(match.result.detail.scoreB)}`;
  return `${String(match.result.resolved.setsWonA)} — ${String(match.result.resolved.setsWonB)} sets`;
}

function locationOf(match: ResultMatchView): string {
  return match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`;
}

function statusColor(status: ResultMatchView['status']): 'default' | 'success' | 'warning' {
  if (status === 'RESULT_CONFIRMED') return 'success';
  if (status === 'RESULT_PENDING_CONFIRMATION') return 'warning';
  return 'default';
}

function MatchesWorkspace(): React.JSX.Element {
  const [rows, setRows] = useState<readonly MatchRow[] | null>(null);
  const [failedCompetitionCount, setFailedCompetitionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MatchFilter>('ALL');

  async function reload(): Promise<void> {
    const list = await competitions();
    const loaded = await Promise.all(list.map(async (competition): Promise<CompetitionMatchesLoad> => {
      if (competition.status !== 'LOCKED' && competition.status !== 'FINALIZED') return { failed: false, rows: [] };
      try {
        const workspace = await resultsWorkspace(competition.id);
        return { failed: false, rows: workspace.matches.map((match) => ({ competition, match } satisfies MatchRow)) };
      } catch {
        return { failed: true, rows: [] };
      }
    }));
    setFailedCompetitionCount(loaded.filter((entry) => entry.failed).length);
    setRows(loaded.flatMap((entry) => entry.rows));
  }

  useEffect(() => {
    let mounted = true;
    void reload()
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los encuentros.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (rows === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return rows.filter(({ competition, match }) => {
      const identity = `${competition.edition.name} ${competition.event.name} ${competition.sport.name} ${competition.modality.name} ${match.participantA.displayName} ${match.participantB.displayName}`.toLocaleLowerCase('es-PY');
      const matchesText = normalized.length === 0 || identity.includes(normalized);
      const matchesState = filter === 'ALL' || filterOf(match.status) === filter;
      return matchesText && matchesState;
    });
  }, [filter, query, rows]);

  async function retry(): Promise<void> {
    setLoading(true);
    setError(null);
    try { await reload(); }
    catch (caught: unknown) { setRows(null); setFailedCompetitionCount(0); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <WorkspaceState detail="Recuperando partidos y resultados desde el servidor." title="Cargando encuentros…" />;
  if (rows === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Encuentros." tone="error" />;

  const pendingResults = rows.filter(({ match }) => match.status === 'PENDING_RESULT').length;
  const pendingConfirmations = rows.filter(({ match }) => match.status === 'RESULT_PENDING_CONFIRMATION').length;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div className={styles.headingCopy}><span className="eyebrow eyebrow--dark">Competencia</span><h2>Encuentros</h2><p>Lee el estado de cada partido como una mesa de control: marcador, fase, contexto y acción operativa en una sola línea.</p></div>
      <div className={styles.summary} aria-label="Resumen de encuentros">
        <div className={styles.summaryItem}><strong>{pendingResults}</strong><span>Sin resultado</span></div>
        <div className={styles.summaryItem}><strong>{pendingConfirmations}</strong><span>Por confirmar</span></div>
      </div>
    </section>

    {failedCompetitionCount === 0 ? null : <Alert status="warning" role="status"><Alert.Indicator /><Alert.Content><Alert.Title>Datos parciales</Alert.Title><Alert.Description>No fue posible recuperar los encuentros de {failedCompetitionCount} {failedCompetitionCount === 1 ? 'competencia' : 'competencias'}. Los datos disponibles de las demás competencias siguen visibles.</Alert.Description></Alert.Content></Alert>}

    <section aria-label="Filtros de encuentros" className={styles.toolbar}>
      <Input aria-label="Buscar encuentro" placeholder="Buscar competencia o participante…" value={query} onChange={(event) => setQuery(event.target.value)} variant="secondary" />
      <select aria-label="Filtrar por estado" value={filter} onChange={(event) => setFilter(event.target.value as MatchFilter)}>
        <option value="ALL">Todos los estados</option>
        <option value="PENDING_RESULT">Pendientes de resultado</option>
        <option value="PENDING_CONFIRMATION">Pendientes de confirmación</option>
        <option value="CONFIRMED">Confirmados</option>
      </select>
      <span className={styles.counter}>{filtered.length} de {rows.length}</span>
    </section>

    <section aria-label="Listado de encuentros" className={styles.board}>
      {filtered.length === 0 ? <div className={styles.empty}><strong>{rows.length === 0 ? 'No hay encuentros materializados.' : 'No encontramos encuentros.'}</strong><p>{rows.length === 0 ? 'Los encuentros aparecerán después de confirmar un sorteo oficial.' : 'Ajusta la búsqueda o el filtro para ver otros partidos.'}</p></div> : filtered.map(({ competition, match }) => <article className={styles.row} key={match.id}>
        <span className={styles.phase}>{match.group === null ? `R${String(match.roundNumber)}` : match.group.label}</span>
        <div className={styles.matchIdentity}>
          <strong>{match.participantA.displayName} · {match.participantB.displayName}</strong>
          <div className={styles.matchMeta}><span className={styles.score}>{scoreOf(match)}</span><small>{locationOf(match)} · Encuentro {String(match.ordinal)}</small></div>
        </div>
        <div className={styles.context}><strong>{competition.sport.name} · {competition.modality.name}</strong><small>{competition.edition.name} / {competition.event.name}</small></div>
        <Chip color={statusColor(match.status)} size="sm" variant="soft">{statusLabel[match.status]}</Chip>
        <a className={styles.action} href={`/competitions/${competition.id}#results-workspace`}>Operar</a>
      </article>)}
    </section>
  </div>;
}

export function MatchesClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="matches" title="Encuentros"><MatchesWorkspace /></AppShell>}</SessionBoundary>;
}
