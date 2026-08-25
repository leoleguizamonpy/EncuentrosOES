'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  competitions,
  resultsWorkspace,
  type CompetitionSummary,
  type ResultMatchView,
} from '../lib/competition-api';
import { DataList, DataRow, ListToolbar, Notice, PageHeader, PageLayout, StatusBadge } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type MatchFilter = 'ALL' | 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'PENDING_RESULT';
const FILTER_OPTIONS: readonly { readonly label: string; readonly value: MatchFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Pendientes de resultado', value: 'PENDING_RESULT' },
  { label: 'Pendientes de confirmación', value: 'PENDING_CONFIRMATION' },
  { label: 'Confirmados', value: 'CONFIRMED' },
];

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

function locationOf(match: ResultMatchView): string { return match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`; }
function toneOf(status: ResultMatchView['status']): 'default' | 'success' | 'warning' { return status === 'RESULT_CONFIRMED' ? 'success' : status === 'RESULT_PENDING_CONFIRMATION' ? 'warning' : 'default'; }

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
      try { const workspace = await resultsWorkspace(competition.id); return { failed: false, rows: workspace.matches.map((match) => ({ competition, match } satisfies MatchRow)) }; }
      catch { return { failed: true, rows: [] }; }
    }));
    setFailedCompetitionCount(loaded.filter((entry) => entry.failed).length); setRows(loaded.flatMap((entry) => entry.rows));
  }

  useEffect(() => { let mounted = true; void reload().catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los encuentros.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => {
    if (rows === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return rows.filter(({ competition, match }) => {
      const identity = `${competition.edition.name} ${competition.event.name} ${competition.sport.name} ${competition.modality.name} ${match.participantA.displayName} ${match.participantB.displayName}`.toLocaleLowerCase('es-PY');
      return (normalized.length === 0 || identity.includes(normalized)) && (filter === 'ALL' || filterOf(match.status) === filter);
    });
  }, [filter, query, rows]);

  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setRows(null); setFailedCompetitionCount(0); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando partidos y resultados desde el servidor." title="Cargando encuentros…" />;
  if (rows === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Encuentros." tone="error" />;

  const pendingResults = rows.filter(({ match }) => match.status === 'PENDING_RESULT').length;
  const pendingConfirmations = rows.filter(({ match }) => match.status === 'RESULT_PENDING_CONFIRMATION').length;

  return <PageLayout>
    <PageHeader description="Consulta marcador, fase, contexto y estado operativo de cada partido desde una sola vista." eyebrow="Competencia" title="Encuentros" trailing={<span aria-label={`${pendingResults} sin resultado y ${pendingConfirmations} por confirmar`}><StatusBadge label={`${pendingResults} sin resultado`} tone={pendingResults > 0 ? 'warning' : 'success'} /> <StatusBadge label={`${pendingConfirmations} por confirmar`} tone={pendingConfirmations > 0 ? 'warning' : 'success'} /></span>} />
    {failedCompetitionCount === 0 ? null : <Notice description={`No fue posible recuperar los encuentros de ${failedCompetitionCount} ${failedCompetitionCount === 1 ? 'competencia' : 'competencias'}. Los datos disponibles de las demás competencias siguen visibles.`} title="Datos parciales" tone="warning" />}
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setFilter} query={query} searchLabel="Buscar encuentro" searchPlaceholder="Buscar competencia o participante…" status={filter} statusLabel="Filtrar por estado" statusOptions={FILTER_OPTIONS} total={rows.length} />
    <DataList empty={{ description: rows.length === 0 ? 'Los encuentros aparecerán después de confirmar un sorteo oficial.' : 'Ajusta la búsqueda o el filtro para ver otros partidos.', title: rows.length === 0 ? 'No hay encuentros materializados.' : 'No encontramos encuentros.' }} isEmpty={filtered.length === 0} label="Listado de encuentros">
      {filtered.map(({ competition, match }) => <DataRow ariaLabel={`Operar encuentro ${match.participantA.displayName} contra ${match.participantB.displayName}`} description={`${locationOf(match)} · Encuentro ${String(match.ordinal)} · ${competition.edition.name} / ${competition.event.name}`} href={`/competitions/${competition.id}#results-workspace`} key={match.id} meta={`${scoreOf(match)} · ${competition.sport.name} · ${competition.modality.name}`} status={<StatusBadge label={statusLabel[match.status]} tone={toneOf(match.status)} />} title={`${match.participantA.displayName} · ${match.participantB.displayName}`} visual={match.group === null ? `R${String(match.roundNumber)}` : match.group.label} />)}
    </DataList>
  </PageLayout>;
}

export function MatchesClient(): React.JSX.Element { return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="matches" title="Encuentros"><MatchesWorkspace /></AppShell>}</SessionBoundary>; }
