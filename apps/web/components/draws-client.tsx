'use client';

import { Alert, Chip, Input } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';

import {
  competitions,
  drawWorkspace,
  type CompetitionSummary,
  type DrawWorkspace,
} from '../lib/competition-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type DrawFilter = 'ALL' | 'CONFIRMED' | 'NOT_READY' | 'PENDING' | 'PREPARED' | 'PUBLISHED';

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

function chipColor(filter: DrawFilter): 'accent' | 'default' | 'success' | 'warning' {
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
      try {
        return { competition, loadFailed: false, workspace: await drawWorkspace(competition.id) } satisfies DrawRow;
      } catch {
        return { competition, loadFailed: true, workspace: null } satisfies DrawRow;
      }
    }));
    setRows(loaded);
  }

  useEffect(() => {
    let mounted = true;
    void reload()
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los sorteos.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (rows === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return rows.filter((row) => {
      const identity = `${row.competition.edition.name} ${row.competition.event.name} ${row.competition.sport.name} ${row.competition.modality.name}`.toLocaleLowerCase('es-PY');
      const matchesText = normalized.length === 0 || identity.includes(normalized);
      const state = stateOf(row);
      const matchesState = filter === 'ALL' || state.filter === filter;
      return matchesText && matchesState;
    });
  }, [filter, query, rows]);

  async function retry(): Promise<void> {
    setLoading(true);
    setError(null);
    try { await reload(); }
    catch (caught: unknown) { setRows(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <WorkspaceState detail="Recuperando el estado oficial de las competencias." title="Cargando sorteos…" />;
  if (rows === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Sorteos." tone="error" />;

  const failedCount = rows.filter((row) => row.loadFailed).length;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Competencia</span><h2>Sorteos</h2><p>Consulta qué competencias están listas para sortear, cuáles esperan confirmación y cuáles ya fueron publicadas oficialmente.</p></div>
    </section>
    {failedCount === 0 ? null : <Alert status="warning" role="status"><Alert.Indicator /><Alert.Content><Alert.Title>Estado parcial</Alert.Title><Alert.Description>No fue posible recuperar el estado de {failedCount} {failedCount === 1 ? 'competencia' : 'competencias'}. Esas filas se muestran como “Estado no disponible” en lugar de asumir que no tienen sorteo.</Alert.Description></Alert.Content></Alert>}
    <section aria-label="Filtros de sorteos" className={styles.toolbar}>
      <Input aria-label="Buscar sorteo" placeholder="Buscar por edición, evento, deporte o modalidad…" value={query} onChange={(event) => setQuery(event.target.value)} variant="secondary" />
      <select aria-label="Filtrar por estado" value={filter} onChange={(event) => setFilter(event.target.value as DrawFilter)}>
        <option value="ALL">Todos los estados</option>
        <option value="PENDING">Pendientes</option>
        <option value="PREPARED">Preparados</option>
        <option value="CONFIRMED">Confirmados</option>
        <option value="PUBLISHED">Publicados</option>
        <option value="NOT_READY">No listos</option>
      </select>
      <span />
      <span className={styles.counter}>{filtered.length} de {rows.length}</span>
    </section>
    <section aria-label="Listado de sorteos" className={styles.tableCard}>
      <div className={styles.tableHeader}><span>Formato</span><span>Competencia</span><span>Contexto</span><span>Estado</span><span>Acción</span></div>
      {filtered.length === 0 ? <div className={styles.empty}><strong>{rows.length === 0 ? 'No hay competencias todavía.' : 'No encontramos sorteos.'}</strong><p>{rows.length === 0 ? 'Crea y configura una competencia antes de preparar su sorteo oficial.' : 'Ajusta la búsqueda o el filtro para ver otros sorteos.'}</p></div> : filtered.map((row) => {
        const state = stateOf(row);
        const publication = row.workspace?.publication ?? null;
        return <article className={styles.row} key={row.competition.id}>
          <span className={styles.logo}>{row.competition.formatCode === 'GROUP_STAGE' ? 'GR' : row.competition.formatCode === 'KNOCKOUT' ? 'KO' : '—'}</span>
          <div className={styles.identity}><strong>{row.competition.sport.name} · {row.competition.modality.name}</strong><small>{row.competition.edition.name} / {row.competition.event.name}</small></div>
          <span className={styles.eventName}>{formatLabel(row.competition.formatCode)} · {row.competition.participantCount} participantes</span>
          <Chip color={chipColor(state.filter)} size="sm" variant="soft">{state.label}</Chip>
          <span style={{ display: 'grid', gap: 6 }}><a className={styles.editButton} href={`/competitions/${row.competition.id}`} style={{ alignItems: 'center', display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>Operar</a>{publication === null ? null : <a href={`/draws/${publication.id}`} style={{ fontSize: 9, textAlign: 'center' }}>Ver publicación</a>}</span>
        </article>;
      })}
    </section>
  </div>;
}

export function DrawsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="draws" title="Sorteos"><DrawsWorkspace /></AppShell>}</SessionBoundary>;
}
