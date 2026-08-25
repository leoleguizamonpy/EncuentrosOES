'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  competitions,
  drawWorkspace,
  type CompetitionSummary,
  type DrawWorkspace,
} from '../lib/competition-api';
import { ActionLink, DataList, DataRow, ListToolbar, Notice, PageHeader, PageLayout, StatusBadge } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type DrawFilter = 'ALL' | 'CONFIRMED' | 'NOT_READY' | 'PENDING' | 'PREPARED' | 'PUBLISHED';
const FILTER_OPTIONS: readonly { readonly label: string; readonly value: DrawFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Pendientes', value: 'PENDING' },
  { label: 'Preparados', value: 'PREPARED' },
  { label: 'Confirmados', value: 'CONFIRMED' },
  { label: 'Publicados', value: 'PUBLISHED' },
  { label: 'No listos', value: 'NOT_READY' },
];

interface DrawRow {
  readonly competition: CompetitionSummary;
  readonly loadFailed: boolean;
  readonly workspace: DrawWorkspace | null;
}

function stateOf(row: DrawRow): Readonly<{ filter: DrawFilter; label: string }> {
  const { competition, loadFailed, workspace } = row;
  if (loadFailed) return { filter: 'NOT_READY', label: 'Estado no disponible' };
  if (workspace?.publication !== null && workspace?.publication !== undefined) return { filter: 'PUBLISHED', label: 'Publicado' };
  if (workspace?.execution?.status === 'CONFIRMED') return { filter: 'CONFIRMED', label: 'Confirmado' };
  if (workspace?.execution?.status === 'PENDING_CONFIRMATION') return { filter: 'PENDING', label: 'Pendiente de confirmación' };
  if (workspace?.configuration !== null && workspace?.configuration !== undefined) return { filter: 'PREPARED', label: 'Preparado' };
  if (competition.status === 'LOCKED') return { filter: 'PENDING', label: 'Pendiente de preparar' };
  return { filter: 'NOT_READY', label: competition.status === 'FINALIZED' ? 'Finalizada' : 'Competencia no bloqueada' };
}

function formatLabel(formatCode: CompetitionSummary['formatCode']): string {
  if (formatCode === 'GROUP_STAGE') return 'Fase de grupos';
  if (formatCode === 'KNOCKOUT') return 'Eliminación directa';
  return 'Sin formato';
}

function toneOf(filter: DrawFilter): 'accent' | 'default' | 'success' | 'warning' {
  if (filter === 'PUBLISHED' || filter === 'CONFIRMED') return 'success';
  if (filter === 'PENDING') return 'warning';
  if (filter === 'PREPARED') return 'accent';
  return 'default';
}

function DrawsWorkspace(): React.JSX.Element {
  const [rows, setRows] = useState<readonly DrawRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DrawFilter>('ALL');
  const [loading, setLoading] = useState(true);

  async function reload(): Promise<void> {
    const list = await competitions();
    const loaded = await Promise.all(list.map(async (competition) => {
      if (competition.status !== 'LOCKED' && competition.status !== 'FINALIZED') return { competition, loadFailed: false, workspace: null } satisfies DrawRow;
      try { return { competition, loadFailed: false, workspace: await drawWorkspace(competition.id) } satisfies DrawRow; }
      catch { return { competition, loadFailed: true, workspace: null } satisfies DrawRow; }
    }));
    setRows(loaded);
  }

  useEffect(() => { let mounted = true; void reload().catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los sorteos.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => {
    if (rows === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return rows.filter((row) => {
      const identity = `${row.competition.edition.name} ${row.competition.event.name} ${row.competition.sport.name} ${row.competition.modality.name}`.toLocaleLowerCase('es-PY');
      const state = stateOf(row);
      return (normalized.length === 0 || identity.includes(normalized)) && (filter === 'ALL' || state.filter === filter);
    });
  }, [filter, query, rows]);

  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setRows(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando el estado oficial de las competencias." title="Cargando sorteos…" />;
  if (rows === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Sorteos." tone="error" />;

  const failedCount = rows.filter((row) => row.loadFailed).length;
  return <PageLayout>
    <PageHeader description="Identifica qué competencias están listas, cuáles requieren confirmación y cuáles ya tienen evidencia pública." eyebrow="Control de sorteos" title="Sorteos oficiales" />
    {failedCount === 0 ? null : <Notice description={`No fue posible recuperar el estado de ${String(failedCount)} ${failedCount === 1 ? 'competencia' : 'competencias'}. Esas filas se muestran como “Estado no disponible” en lugar de asumir que no tienen sorteo.`} title="Estado parcial" tone="warning" />}
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setFilter} query={query} searchLabel="Buscar sorteo" searchPlaceholder="Buscar edición, evento, deporte o modalidad…" status={filter} statusLabel="Filtrar por estado" statusOptions={FILTER_OPTIONS} total={rows.length} />
    <DataList empty={{ description: rows.length === 0 ? 'Crea y configura una competencia antes de preparar su sorteo oficial.' : 'Ajusta la búsqueda o el filtro para ver otros sorteos.', title: rows.length === 0 ? 'No hay competencias todavía.' : 'No encontramos sorteos.' }} isEmpty={filtered.length === 0} label="Listado de sorteos">
      {filtered.map((row) => {
        const state = stateOf(row); const publication = row.workspace?.publication ?? null;
        return <DataRow action={publication === null ? undefined : <ActionLink href={`/draws/${publication.id}`}>Publicación</ActionLink>} ariaLabel={`Operar ${row.competition.sport.name} ${row.competition.modality.name}`} description={`${row.competition.edition.name} / ${row.competition.event.name}`} href={`/competitions/${row.competition.id}`} key={row.competition.id} meta={`${formatLabel(row.competition.formatCode)} · ${String(row.competition.participantCount)} participantes`} status={<StatusBadge label={state.label} tone={toneOf(state.filter)} />} title={`${row.competition.sport.name} · ${row.competition.modality.name}`} visual={row.competition.formatCode === 'GROUP_STAGE' ? 'GR' : row.competition.formatCode === 'KNOCKOUT' ? 'KO' : '—'} />;
      })}
    </DataList>
  </PageLayout>;
}

export function DrawsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="draws" eyebrow="Competencia" title="Sorteos"><DrawsWorkspace /></AppShell>}</SessionBoundary>; }
