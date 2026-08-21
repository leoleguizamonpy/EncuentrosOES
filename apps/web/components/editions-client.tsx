'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  adminCatalog,
  createEdition,
  updateEdition,
  type AdminCatalog,
  type AdminEdition,
} from '../lib/catalog-admin-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type EditionStatusFilter = 'ALL' | 'CLOSED' | 'OPEN';

interface EditionDrawerProps {
  readonly edition: AdminEdition | null;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => Promise<void>;
}

function EditionDrawer({ edition, onClose, onSaved }: EditionDrawerProps): React.JSX.Element {
  const [name, setName] = useState(edition?.name ?? '');
  const [year, setYear] = useState(edition?.year ?? new Date().getFullYear());
  const [status, setStatus] = useState<'CLOSED' | 'OPEN'>(edition?.status ?? 'OPEN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (edition === null) {
        await createEdition({ name, status, year });
        await onSaved('Edición creada correctamente.');
      } else {
        await updateEdition(edition.id, { name, status, year });
        await onSaved('Edición actualizada correctamente.');
      }
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar la edición.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" />
    <aside aria-labelledby="edition-drawer-title" aria-modal="true" className={styles.drawer} role="dialog">
      <div className={styles.drawerHeader}><div><span className="eyebrow eyebrow--dark">Organización</span><h3 id="edition-drawer-title">{edition === null ? 'Nueva edición' : 'Editar edición'}</h3></div><button aria-label="Cerrar" className={styles.closeButton} onClick={onClose} type="button">×</button></div>
      {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <label>Nombre *<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="OES 2027" /></label>
        <label>Año *<input max="2100" min="2020" required type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
        <label>Estado *<select value={status} onChange={(event) => setStatus(event.target.value as 'CLOSED' | 'OPEN')}><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label>
        <div className={styles.actions}><button className={styles.secondaryButton} onClick={onClose} type="button">Cancelar</button><button className={styles.saveButton} disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar edición'}</button></div>
      </form>
    </aside>
  </>;
}

function EditionsWorkspace(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EditionStatusFilter>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEdition | null>(null);

  async function reload(): Promise<void> { setCatalog(await adminCatalog()); }

  useEffect(() => {
    let active = true;
    void adminCatalog().then((loaded) => { if (active) setCatalog(loaded); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'No fue posible cargar las ediciones.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (catalog === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return catalog.editions.filter((item) => {
      const matchesText = normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || String(item.year).includes(normalized);
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [catalog, query, statusFilter]);

  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); }
  function startEdit(item: AdminEdition): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); }
  async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <div className="empty-state"><strong>Cargando ediciones…</strong><p>Recuperando los ciclos OES desde el servidor.</p></div>;
  if (catalog === null) return <div className="empty-state"><strong>No fue posible cargar este módulo.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  return <div className={styles.workspace}>
    <section className={styles.heading}><div><span className="eyebrow eyebrow--dark">Organización</span><h2>Ediciones</h2><p>Administra cada ciclo anual de OES y controla cuándo una edición queda abierta o cerrada para su operación.</p></div><button className={styles.primaryButton} onClick={startCreate} type="button">+ Nueva edición</button></section>
    {error === null ? null : <p className={styles.error} role="alert">{error}</p>}{notice === null ? null : <p className={styles.notice} role="status">{notice}</p>}
    <section aria-label="Filtros de ediciones" className={styles.toolbar}><input aria-label="Buscar edición" placeholder="Buscar por nombre o año…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EditionStatusFilter)}><option value="ALL">Todos los estados</option><option value="OPEN">Abiertas</option><option value="CLOSED">Cerradas</option></select><span /><span className={styles.counter}>{filtered.length} de {catalog.editions.length}</span></section>
    <section aria-label="Listado de ediciones" className={styles.tableCard}><div className={styles.tableHeader}><span>Año</span><span>Edición</span><span>Ciclo</span><span>Estado</span><span>Acción</span></div>{filtered.length === 0 ? <div className={styles.empty}><strong>{catalog.editions.length === 0 ? 'No hay ediciones todavía.' : 'No encontramos resultados.'}</strong><p>{catalog.editions.length === 0 ? 'Crea la edición que agrupará los eventos y competencias de un ciclo OES.' : 'Ajusta la búsqueda o el filtro para ver otras ediciones.'}</p>{catalog.editions.length === 0 ? <button className={styles.primaryButton} onClick={startCreate} type="button">+ Nueva edición</button> : null}</div> : filtered.map((item) => <article className={styles.row} key={item.id}><span className={styles.logo}>{String(item.year).slice(-2)}</span><div className={styles.identity}><strong>{item.name}</strong><small>Edición OES</small></div><span className={styles.eventName}>{item.year}</span><span className={[styles.status, item.status === 'OPEN' ? styles.active : styles.inactive].filter(Boolean).join(' ')}>{item.status === 'OPEN' ? 'Abierta' : 'Cerrada'}</span><button className={styles.editButton} onClick={() => startEdit(item)} type="button">Editar</button></article>)}</section>
    {drawerOpen ? <EditionDrawer edition={editing} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}
  </div>;
}

export function EditionsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="editions" title="Ediciones"><EditionsWorkspace /></AppShell>}</SessionBoundary>;
}
