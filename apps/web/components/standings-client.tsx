'use client';

import { useEffect, useMemo, useState } from 'react';

import standingsStyles from '../features/competition/standings.module.css';
import {
  competitions,
  resultsWorkspace,
  type CompetitionSummary,
  type ResultsWorkspace,
  type StandingRowView,
} from '../lib/competition-api';
import { ActionLink, DataTable, type DataTableColumn, ListToolbar, Notice, PageHeader, PageLayout, Panel, PanelStack, StatusBadge } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type StandingFilter = 'ALL' | 'COMPLETE' | 'PARTIAL' | 'QUALIFIED' | 'PENDING_QUALIFICATION';
const FILTER_OPTIONS: readonly { readonly label: string; readonly value: StandingFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Tabla parcial', value: 'PARTIAL' },
  { label: 'Tabla completa', value: 'COMPLETE' },
  { label: 'Clasificación por confirmar', value: 'PENDING_QUALIFICATION' },
  { label: 'Clasificación confirmada', value: 'QUALIFIED' },
];

interface StandingGroup {
  readonly competition: CompetitionSummary;
  readonly group: ResultsWorkspace['groups'][number];
  readonly resultProfile: ResultsWorkspace['resultProfile'];
}

interface CompetitionStandingsLoad {
  readonly failed: boolean;
  readonly groups: readonly StandingGroup[];
}

function groupState(group: StandingGroup['group']): Exclude<StandingFilter, 'ALL'> {
  if (group.qualification?.status === 'CONFIRMED') return 'QUALIFIED';
  if (group.qualification?.status === 'PENDING_CONFIRMATION') return 'PENDING_QUALIFICATION';
  return group.complete ? 'COMPLETE' : 'PARTIAL';
}

function stateLabel(group: StandingGroup['group']): string {
  if (group.qualification?.status === 'CONFIRMED') return 'Clasificación confirmada';
  if (group.qualification?.status === 'PENDING_CONFIRMATION') return 'Clasificación por confirmar';
  return group.complete ? 'Tabla completa' : 'Tabla parcial';
}

function columnsFor(setBased: boolean): readonly DataTableColumn<StandingRowView>[] {
  const common: DataTableColumn<StandingRowView>[] = [
    { id: 'position', label: 'Pos.', render: (row) => `${row.position}${row.tied ? '=' : ''}` },
    { id: 'participant', label: 'Participante', render: (row) => row.participant.displayName },
    { align: 'right', id: 'played', label: 'J', render: (row) => row.played },
    { align: 'right', id: 'wins', label: 'G', render: (row) => row.wins },
  ];
  if (setBased) return [...common,
    { align: 'right', id: 'losses', label: 'P', render: (row) => row.losses },
    { align: 'right', id: 'points', label: 'Pts.', render: (row) => <strong>{row.tablePoints}</strong> },
    { align: 'right', id: 'setDifference', label: 'SG', render: (row) => row.setDifference },
    { align: 'right', id: 'sportPointDifference', label: 'DP', render: (row) => row.sportPointDifference },
  ];
  return [...common,
    { align: 'right', id: 'draws', label: 'E', render: (row) => row.draws },
    { align: 'right', id: 'losses', label: 'P', render: (row) => row.losses },
    { align: 'right', id: 'points', label: 'Pts.', render: (row) => <strong>{row.tablePoints}</strong> },
    { align: 'right', id: 'scoreFor', label: 'GF', render: (row) => row.scoreFor },
    { align: 'right', id: 'scoreAgainst', label: 'GC', render: (row) => row.scoreAgainst },
    { align: 'right', id: 'scoreDifference', label: 'DG', render: (row) => row.scoreDifference },
  ];
}

function StandingsWorkspace(): React.JSX.Element {
  const [groups, setGroups] = useState<readonly StandingGroup[] | null>(null);
  const [failedCompetitionCount, setFailedCompetitionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StandingFilter>('ALL');

  async function reload(): Promise<void> {
    const list = await competitions();
    const loaded = await Promise.all(list.map(async (competition): Promise<CompetitionStandingsLoad> => {
      if (competition.status !== 'LOCKED' && competition.status !== 'FINALIZED') return { failed: false, groups: [] };
      try { const workspace = await resultsWorkspace(competition.id); return { failed: false, groups: workspace.groups.map((group) => ({ competition, group, resultProfile: workspace.resultProfile } satisfies StandingGroup)) }; }
      catch { return { failed: true, groups: [] }; }
    }));
    setFailedCompetitionCount(loaded.filter((entry) => entry.failed).length); setGroups(loaded.flatMap((entry) => entry.groups));
  }

  useEffect(() => { let mounted = true; void reload().catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar la clasificación.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => {
    if (groups === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return groups.filter(({ competition, group }) => {
      const participants = group.standings.map((row) => row.participant.displayName).join(' ');
      const identity = `${competition.edition.name} ${competition.event.name} ${competition.sport.name} ${competition.modality.name} ${group.label} ${participants}`.toLocaleLowerCase('es-PY');
      return (normalized.length === 0 || identity.includes(normalized)) && (filter === 'ALL' || groupState(group) === filter);
    });
  }, [filter, groups, query]);

  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setGroups(null); setFailedCompetitionCount(0); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando tablas oficiales desde el servidor." title="Cargando clasificación…" />;
  if (groups === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Clasificación." tone="error" />;

  const confirmed = groups.filter(({ group }) => group.qualification?.status === 'CONFIRMED').length;
  const pending = groups.filter(({ group }) => group.qualification?.status === 'PENDING_CONFIRMATION').length;

  return <PageLayout>
    <PageHeader description="Consulta las tablas calculadas por el motor competitivo y el estado oficial de los clasificados desde la misma fuente de verdad." eyebrow="Competencia" title="Clasificación" />
    {failedCompetitionCount === 0 ? null : <Notice description={`No fue posible recuperar tablas de ${failedCompetitionCount} ${failedCompetitionCount === 1 ? 'competencia' : 'competencias'}. Las tablas disponibles de las demás competencias siguen visibles.`} title="Tablas parciales" tone="warning" />}
    <div aria-label="Resumen de clasificación" className={standingsStyles.summary}><StatusBadge label={`${confirmed} grupos confirmados`} tone="success" /><StatusBadge label={`${pending} por confirmar`} tone={pending > 0 ? 'warning' : 'default'} /></div>
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setFilter} query={query} searchLabel="Buscar clasificación" searchPlaceholder="Buscar competencia, grupo o participante…" status={filter} statusLabel="Filtrar clasificación por estado" statusOptions={FILTER_OPTIONS} total={groups.length} />
    {filtered.length === 0 ? <Panel><div className={standingsStyles.qualification}><strong>{groups.length === 0 ? 'Aún no hay tablas de grupos.' : 'No encontramos clasificaciones.'}</strong><small>{groups.length === 0 ? 'Las tablas aparecerán cuando existan encuentros de fase de grupos.' : 'Ajusta la búsqueda o el filtro.'}</small></div></Panel> : <PanelStack>{filtered.map(({ competition, group, resultProfile }) => {
      const setBased = resultProfile === 'SET_BASED'; const qualification = group.qualification;
      return <Panel key={`${competition.id}-${group.id}`} header={<><div className={standingsStyles.identity}><strong>{competition.sport.name} · {competition.modality.name} · Grupo {group.label}</strong><small>{competition.edition.name} / {competition.event.name}</small></div><StatusBadge label={stateLabel(group)} tone={qualification?.status === 'CONFIRMED' ? 'success' : qualification?.status === 'PENDING_CONFIRMATION' ? 'warning' : 'default'} /></>} footer={qualification === null ? undefined : <><div className={standingsStyles.qualification}><strong>1.º {qualification.firstParticipant.displayName} · 2.º {qualification.secondParticipant.displayName}</strong><small>{qualification.status === 'CONFIRMED' ? `Confirmado por ${qualification.confirmedBy?.displayName ?? 'autoridad'}` : 'Propuesta pendiente de confirmación independiente'}</small></div><ActionLink href={`/competitions/${competition.id}#results-workspace`}>Ver competencia</ActionLink></>}>
        <DataTable columns={columnsFor(setBased)} getRowKey={(row) => row.participant.id} label={`${competition.sport.name} ${competition.modality.name} Grupo ${group.label}`} rows={group.standings} width={setBased ? 'medium' : 'wide'} />
      </Panel>;
    })}</PanelStack>}
  </PageLayout>;
}

export function StandingsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="standings" title="Clasificación"><StandingsWorkspace /></AppShell>}</SessionBoundary>; }
