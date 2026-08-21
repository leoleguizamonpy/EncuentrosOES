'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  competitions,
  resultsWorkspace,
  type CompetitionSummary,
  type ResultMatchView,
} from '../lib/competition-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type MatchFilter = 'ALL' | 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'PENDING_RESULT';

interface MatchRow {
  readonly competition: CompetitionSummary;
  readonly match: ResultMatchView;
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

function MatchesWorkspace(): React.JSX.Element {
  const [rows, setRows] = useState<readonly MatchRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MatchFilter>('ALL');

  async function reload(): Promise<void> {
    const list = await competitions();
    const workspaces = await Promise.all(list.map(async (competition) => {
      if (competition.status !== 'LOCKED' && competition.status !== 'FINALIZED') return [] as MatchRow[];
      try {
        const workspace = await resultsWorkspace(competition.id);
        return workspace.matches.map((match) => ({ competition, match } satisfies MatchRow));
      } catch {
        return [] as MatchRow[];
      }
    }));
    setRows(workspaces.flat());
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
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="empty-state"><strong>Cargando encuentros…</strong><p>Recuperando partidos y resultados desde el servidor.</p></div>;
  if (rows === null) return <div className="empty-state"><strong>No fue posible cargar Encuentros.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  const pendingResults = rows.filter(({ match }) => match.status === 'PENDING_RESULT').length;
  const pendingConfirmations = rows.filter(({ match }) => match.status === 'RESULT_PENDING_CONFIRMATION').length;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Competencia</span><h2>Encuentros</h2><p>Consulta todos los encuentros materializados, detecta resultados pendientes y entra a la competencia correspondiente para registrar o confirmar el marcador.</p></div>
    </section>
    {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
    <section aria-label="Resumen de encuentros" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
      <span className={styles.status + ' ' + styles.inactive}>{pendingResults} sin resultado</span>
      <span className={styles.status + ' ' + styles.inactive}>{pendingConfirmations} por confirmar</span>
    </section>
    <section aria-label="Filtros de encuentros" className={styles.toolbar}>
      <input aria-label="Buscar encuentro" placeholder="Buscar competencia o participante…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filtrar por estado" value={filter} onChange={(event) => setFilter(event.target.value as MatchFilter)}>
        <option value="ALL">Todos los estados</option>
        <option value="PENDING_RESULT">Pendientes de resultado</option>
        <option value="PENDING_CONFIRMATION">Pendientes de confirmación</option>
        <option value="CONFIRMED">Confirmados</option>
      </select>
      <span />
      <span className={styles.counter}>{filtered.length} de {rows.length}</span>
    </section>
    <section aria-label="Listado de encuentros" className={styles.tableCard}>
      <div className={styles.tableHeader}><span>Fase</span><span>Encuentro</span><span>Competencia</span><span>Estado</span><span>Acción</span></div>
      {filtered.length === 0 ? <div className={styles.empty}><strong>{rows.length === 0 ? 'No hay encuentros materializados.' : 'No encontramos encuentros.'}</strong><p>{rows.length === 0 ? 'Los encuentros aparecerán después de confirmar un sorteo oficial.' : 'Ajusta la búsqueda o el filtro para ver otros partidos.'}</p></div> : filtered.map(({ competition, match }) => <article className={styles.row} key={match.id}>
        <span className={styles.logo}>{match.group === null ? `R${String(match.roundNumber)}` : match.group.label}</span>
        <div className={styles.identity}><strong>{match.participantA.displayName} · {match.participantB.displayName}</strong><small>{locationOf(match)} · Encuentro {String(match.ordinal)} · {scoreOf(match)}</small></div>
        <span className={styles.eventName}>{competition.sport.name} · {competition.modality.name}<br />{competition.edition.name} / {competition.event.name}</span>
        <span className={[styles.status, match.status === 'RESULT_CONFIRMED' ? styles.active : styles.inactive].filter(Boolean).join(' ')}>{statusLabel[match.status]}</span>
        <a className={styles.editButton} href={`/competitions/${competition.id}#results-workspace`} style={{ alignItems: 'center', display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>Operar</a>
      </article>)}
    </section>
  </div>;
}

export function MatchesClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="matches" title="Encuentros"><MatchesWorkspace /></AppShell>}</SessionBoundary>;
}
