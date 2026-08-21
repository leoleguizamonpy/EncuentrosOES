'use client';

import { useEffect, useMemo, useState } from 'react';

import { auditTimeline, type AuditTimelineEntry } from '../lib/audit-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const CONTROL_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type AuditFilter = 'ALL' | 'COMPETITION' | 'DRAW' | 'RESULT' | 'QUALIFICATION' | 'OTHER';

function familyOf(entry: AuditTimelineEntry): Exclude<AuditFilter, 'ALL'> {
  const value = `${entry.resourceType} ${entry.actionCode}`.toUpperCase();
  if (value.includes('DRAW')) return 'DRAW';
  if (value.includes('RESULT') || value.includes('MATCH')) return 'RESULT';
  if (value.includes('QUALIFICATION')) return 'QUALIFICATION';
  if (value.includes('COMPETITION')) return 'COMPETITION';
  return 'OTHER';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function revisionLabel(entry: AuditTimelineEntry): string {
  if (entry.revisionBefore === null && entry.revisionAfter === null) return 'Sin revisión';
  return `${entry.revisionBefore === null ? '—' : String(entry.revisionBefore)} → ${entry.revisionAfter === null ? '—' : String(entry.revisionAfter)}`;
}

function AuditWorkspace(): React.JSX.Element {
  const [entries, setEntries] = useState<readonly AuditTimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('ALL');

  async function reload(): Promise<void> {
    setEntries(await auditTimeline());
  }

  useEffect(() => {
    let mounted = true;
    void reload()
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar la auditoría.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (entries === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return entries.filter((entry) => {
      const identity = `${entry.actionCode} ${entry.resourceType} ${entry.resourceId} ${entry.competitionId ?? ''} ${entry.actor.displayName ?? ''} ${entry.actor.role} ${entry.reason ?? ''} ${entry.correlationId}`.toLocaleLowerCase('es-PY');
      return (filter === 'ALL' || familyOf(entry) === filter) && (normalized.length === 0 || identity.includes(normalized));
    });
  }, [entries, filter, query]);

  async function retry(): Promise<void> {
    setLoading(true); setError(null);
    try { await reload(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="empty-state"><strong>Cargando auditoría…</strong><p>Recuperando la evidencia persistida del sistema.</p></div>;
  if (entries === null) return <div className="empty-state"><strong>No fue posible cargar Auditoría.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Control</span><h2>Auditoría</h2><p>Consulta la bitácora persistida de acciones críticas. Cada entrada conserva actor, recurso, revisiones, correlación y motivo cuando corresponde.</p></div>
    </section>
    {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
    <section aria-label="Filtros de auditoría" className={styles.toolbar}>
      <input aria-label="Buscar en auditoría" placeholder="Buscar acción, actor, recurso o correlación…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filtrar auditoría por dominio" value={filter} onChange={(event) => setFilter(event.target.value as AuditFilter)}>
        <option value="ALL">Todos los dominios</option>
        <option value="COMPETITION">Competencias</option>
        <option value="DRAW">Sorteos</option>
        <option value="RESULT">Resultados</option>
        <option value="QUALIFICATION">Clasificación</option>
        <option value="OTHER">Otros</option>
      </select>
      <span />
      <span className={styles.counter}>{filtered.length} de {entries.length} trazas</span>
    </section>
    <section aria-label="Trazas de auditoría" className={styles.tableCard}>
      <div className={styles.tableHeader}><span>Fecha</span><span>Acción</span><span>Recurso</span><span>Actor</span><span>Revisión</span></div>
      {filtered.length === 0 ? <div className={styles.empty}><strong>{entries.length === 0 ? 'Aún no hay trazas de auditoría.' : 'No encontramos trazas.'}</strong><p>{entries.length === 0 ? 'Las acciones críticas aparecerán aquí cuando sean registradas.' : 'Ajusta la búsqueda o el filtro.'}</p></div> : filtered.map((entry) => <article className={styles.row} key={entry.id}>
        <span className={styles.eventName}>{formatDate(entry.occurredAt)}</span>
        <div className={styles.identity}><strong>{entry.actionCode}</strong><small>{entry.reason ?? `Correlación ${entry.correlationId}`}</small></div>
        <div className={styles.identity}><strong>{entry.resourceType}</strong><small>{entry.resourceId}{entry.competitionId === null ? '' : ` · competencia ${entry.competitionId}`}</small></div>
        <span className={styles.eventName}>{entry.actor.displayName ?? 'Sistema'}<br />{entry.actor.role}</span>
        <span className={[styles.status, styles.inactive].filter(Boolean).join(' ')}>{revisionLabel(entry)}</span>
      </article>)}
    </section>
  </div>;
}

export function AuditClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={CONTROL_ROLES}>{(actor) => <AppShell actor={actor} active="audit" title="Auditoría"><AuditWorkspace /></AppShell>}</SessionBoundary>;
}
