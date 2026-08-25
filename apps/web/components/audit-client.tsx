'use client';

import { useEffect, useMemo, useState } from 'react';

import { auditTimeline, type AuditTimelineEntry } from '../lib/audit-api';
import { DataList, DataRow, ListToolbar, PageHeader, PageLayout, StatusBadge } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const CONTROL_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type AuditFilter = 'ALL' | 'COMPETITION' | 'DRAW' | 'RESULT' | 'QUALIFICATION' | 'OTHER';
const FILTER_OPTIONS: readonly { readonly label: string; readonly value: AuditFilter }[] = [
  { label: 'Todos los dominios', value: 'ALL' },
  { label: 'Competencias', value: 'COMPETITION' },
  { label: 'Sorteos', value: 'DRAW' },
  { label: 'Resultados', value: 'RESULT' },
  { label: 'Clasificación', value: 'QUALIFICATION' },
  { label: 'Otros', value: 'OTHER' },
];

function familyOf(entry: AuditTimelineEntry): Exclude<AuditFilter, 'ALL'> {
  const value = `${entry.resourceType} ${entry.actionCode}`.toUpperCase();
  if (value.includes('DRAW')) return 'DRAW';
  if (value.includes('RESULT') || value.includes('MATCH')) return 'RESULT';
  if (value.includes('QUALIFICATION')) return 'QUALIFICATION';
  if (value.includes('COMPETITION')) return 'COMPETITION';
  return 'OTHER';
}

function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'medium' }).format(date); }
function revisionLabel(entry: AuditTimelineEntry): string { return entry.revisionBefore === null && entry.revisionAfter === null ? 'Sin revisión' : `${entry.revisionBefore === null ? '—' : String(entry.revisionBefore)} → ${entry.revisionAfter === null ? '—' : String(entry.revisionAfter)}`; }

function AuditWorkspace(): React.JSX.Element {
  const [entries, setEntries] = useState<readonly AuditTimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('ALL');

  async function reload(): Promise<void> { setLoading(true); setError(null); try { setEntries(await auditTimeline()); } catch (caught: unknown) { setEntries(null); setError(caught instanceof Error ? caught.message : 'No fue posible cargar la auditoría.'); } finally { setLoading(false); } }
  useEffect(() => { let mounted = true; void auditTimeline().then((value) => { if (mounted) setEntries(value); }).catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar la auditoría.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => {
    if (entries === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return entries.filter((entry) => { const identity = `${entry.actionCode} ${entry.resourceType} ${entry.resourceId} ${entry.competitionId ?? ''} ${entry.actor.displayName ?? ''} ${entry.actor.role} ${entry.reason ?? ''} ${entry.correlationId}`.toLocaleLowerCase('es-PY'); return (filter === 'ALL' || familyOf(entry) === filter) && (normalized.length === 0 || identity.includes(normalized)); });
  }, [entries, filter, query]);

  if (loading) return <WorkspaceState detail="Recuperando la evidencia persistida del sistema." title="Cargando auditoría…" />;
  if (entries === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void reload()} title="No fue posible cargar Auditoría." tone="error" />;

  return <PageLayout>
    <PageHeader description="Consulta la bitácora persistida de acciones críticas con actor, recurso, revisiones, correlación y motivo." eyebrow="Control" title="Auditoría" />
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setFilter} query={query} searchLabel="Buscar en auditoría" searchPlaceholder="Buscar acción, actor, recurso o correlación…" status={filter} statusLabel="Filtrar auditoría por dominio" statusOptions={FILTER_OPTIONS} total={entries.length} />
    <DataList empty={{ description: entries.length === 0 ? 'Las acciones críticas aparecerán aquí cuando sean registradas.' : 'Ajusta la búsqueda o el filtro.', title: entries.length === 0 ? 'Aún no hay trazas de auditoría.' : 'No encontramos trazas.' }} isEmpty={filtered.length === 0} label="Trazas de auditoría">
      {filtered.map((entry) => <DataRow description={`${entry.actor.displayName ?? 'Sistema'} · ${entry.actor.role} · ${formatDate(entry.occurredAt)}`} key={entry.id} meta={`${entry.resourceType} · ${entry.resourceId}${entry.competitionId === null ? '' : ` · competencia ${entry.competitionId}`}`} status={<StatusBadge label={revisionLabel(entry)} />} title={entry.actionCode} visual={familyOf(entry).slice(0, 2)} />)}
    </DataList>
  </PageLayout>;
}

export function AuditClient(): React.JSX.Element { return <SessionBoundary allowedRoles={CONTROL_ROLES}>{(actor) => <AppShell actor={actor} active="audit" title="Auditoría"><AuditWorkspace /></AppShell>}</SessionBoundary>; }
