'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  adminCatalog,
  createCombination,
  createEvent,
  updateCombination,
  updateEvent,
  type AdminCatalog,
  type AdminCombination,
  type AdminEvent,
} from '../lib/catalog-admin-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';

interface EventDrawerProps {
  readonly catalog: AdminCatalog;
  readonly event: AdminEvent | null;
  readonly onClose: () => void;
  readonly onReload: () => Promise<AdminCatalog>;
  readonly onSaved: (message: string) => Promise<void>;
}

function combinationKey(eventId: string, sportId: string, modalityId: string): string {
  return `${eventId}:${sportId}:${modalityId}`;
}

function EventDrawer({ catalog, event, onClose, onReload, onSaved }: EventDrawerProps): React.JSX.Element {
  const [name, setName] = useState(event?.name ?? '');
  const [code, setCode] = useState(event?.code ?? '');
  const [active, setActive] = useState(event?.active ?? true);
  const [localCatalog, setLocalCatalog] = useState(catalog);
  const [saving, setSaving] = useState(false);
  const [relationBusy, setRelationBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventCombinations = useMemo(() => event === null
    ? []
    : localCatalog.combinations.filter((item) => item.eventId === event.id), [event, localCatalog.combinations]);

  function findCombination(sportId: string, modalityId: string): AdminCombination | undefined {
    return eventCombinations.find((item) => item.sportId === sportId && item.modalityId === modalityId);
  }

  async function submit(eventSubmit: SyntheticEvent<HTMLFormElement>): Promise<void> {
    eventSubmit.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (event === null) {
        await createEvent({ code, name });
        await onSaved('Evento creado correctamente.');
      } else {
        await updateEvent(event.id, { active, code, name });
        await onSaved('Evento actualizado correctamente.');
      }
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el evento.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCombination(sportId: string, modalityId: string): Promise<void> {
    if (event === null) return;
    const key = combinationKey(event.id, sportId, modalityId);
    setRelationBusy(key);
    setError(null);
    try {
      const current = findCombination(sportId, modalityId);
      if (current === undefined) await createCombination({ eventId: event.id, modalityId, sportId });
      else await updateCombination({ active: !current.active, eventId: event.id, modalityId, sportId });
      setLocalCatalog(await onReload());
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizar deportes y modalidades.');
    } finally {
      setRelationBusy(null);
    }
  }

  return (
    <>
      <button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" />
      <aside aria-labelledby="event-drawer-title" aria-modal="true" className={styles.drawer} role="dialog">
        <div className={styles.drawerHeader}>
          <div><span className="eyebrow eyebrow--dark">Organización</span><h3 id="event-drawer-title">{event === null ? 'Nuevo evento' : 'Editar evento'}</h3></div>
          <button aria-label="Cerrar" className={styles.closeButton} onClick={onClose} type="button">×</button>
        </div>
        {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
        <form className={styles.form} onSubmit={(submitEvent) => void submit(submitEvent)}>
          <span className="eyebrow eyebrow--dark">General</span>
          <label>Nombre *<input required value={name} onChange={(changeEvent) => setName(changeEvent.target.value)} placeholder="Colegiales" /></label>
          <label>Código *<input required value={code} onChange={(changeEvent) => setCode(changeEvent.target.value)} placeholder="COLEGIALES" /></label>
          {event === null ? null : <label className={styles.checkRow}><input checked={active} type="checkbox" onChange={(changeEvent) => setActive(changeEvent.target.checked)} /> Evento activo</label>}
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={onClose} type="button">Cancelar</button>
            <button className={styles.saveButton} disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar evento'}</button>
          </div>
        </form>

        {event === null ? null : <section aria-labelledby="event-relations-title" style={{ marginTop: 32 }}>
          <span className="eyebrow eyebrow--dark">Configuración contextual</span>
          <h4 id="event-relations-title" style={{ fontSize: 18, marginBottom: 8 }}>Deportes y modalidades</h4>
          <p style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.6, marginBottom: 18 }}>Habilita únicamente las combinaciones válidas para este evento. Esta es la representación de producto de Evento + Deporte + Modalidad.</p>
          {localCatalog.sports.filter((sport) => sport.active).length === 0 || localCatalog.modalities.filter((modality) => modality.active).length === 0
            ? <p className={styles.error}>Necesitas al menos un deporte y una modalidad activos antes de configurar este evento.</p>
            : localCatalog.sports.filter((sport) => sport.active).map((sport) => <div key={sport.id} style={{ borderTop: '1px solid var(--line)', padding: '14px 0' }}>
              <strong style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>{sport.name}</strong>
              {localCatalog.modalities.filter((modality) => modality.active).map((modality) => {
                const current = findCombination(sport.id, modality.id);
                const checked = current?.active ?? false;
                const key = combinationKey(event.id, sport.id, modality.id);
                return <label className={styles.checkRow} key={modality.id} style={{ marginBottom: 9 }}><input aria-label={`${sport.name} · ${modality.name}`} checked={checked} disabled={relationBusy !== null} type="checkbox" onChange={() => void toggleCombination(sport.id, modality.id)} /> {modality.name}{relationBusy === key ? ' · actualizando…' : ''}</label>;
              })}
            </div>)}
        </section>}
      </aside>
    </>
  );
}

function EventsWorkspace(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEvent | null>(null);

  async function reload(): Promise<AdminCatalog> {
    const loaded = await adminCatalog();
    setCatalog(loaded);
    return loaded;
  }

  useEffect(() => {
    let mounted = true;
    void adminCatalog()
      .then((loaded) => { if (mounted) setCatalog(loaded); })
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los eventos.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (catalog === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return catalog.events.filter((item) => {
      const matchesText = normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized);
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active);
      return matchesText && matchesStatus;
    });
  }, [catalog, query, statusFilter]);

  function startCreate(): void {
    setEditing(null);
    setDrawerOpen(true);
    setError(null);
    setNotice(null);
  }

  function startEdit(item: AdminEvent): void {
    setEditing(item);
    setDrawerOpen(true);
    setError(null);
    setNotice(null);
  }

  async function saved(message: string): Promise<void> {
    await reload();
    setNotice(message);
    setError(null);
  }

  async function retry(): Promise<void> {
    setLoading(true);
    setError(null);
    try { await reload(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="empty-state"><strong>Cargando eventos…</strong><p>Recuperando la estructura organizativa desde el servidor.</p></div>;
  if (catalog === null) return <div className="empty-state"><strong>No fue posible cargar este módulo.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  return (
    <div className={styles.workspace}>
      <section className={styles.heading}>
        <div><span className="eyebrow eyebrow--dark">Organización</span><h2>Eventos</h2><p>Administra Colegiales, Universitarios y otros eventos OES junto con los deportes y modalidades válidos para cada uno.</p></div>
        <button className={styles.primaryButton} onClick={startCreate} type="button">+ Nuevo evento</button>
      </section>
      {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
      {notice === null ? null : <p className={styles.notice} role="status">{notice}</p>}
      <section aria-label="Filtros de eventos" className={styles.toolbar}>
        <input aria-label="Buscar evento" placeholder="Buscar por nombre o código…" value={query} onChange={(changeEvent) => setQuery(changeEvent.target.value)} />
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(changeEvent) => setStatusFilter(changeEvent.target.value as StatusFilter)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select>
        <span />
        <span className={styles.counter}>{filtered.length} de {catalog.events.length}</span>
      </section>
      <section aria-label="Listado de eventos" className={styles.tableCard}>
        <div className={styles.tableHeader}><span>Código</span><span>Evento</span><span>Configuración</span><span>Estado</span><span>Acción</span></div>
        {filtered.length === 0 ? <div className={styles.empty}><strong>{catalog.events.length === 0 ? 'No hay eventos todavía.' : 'No encontramos resultados.'}</strong><p>{catalog.events.length === 0 ? 'Crea los eventos que agruparán instituciones y competencias, como Colegiales o Universitarios.' : 'Ajusta la búsqueda o el filtro para ver otros eventos.'}</p>{catalog.events.length === 0 ? <button className={styles.primaryButton} onClick={startCreate} type="button">+ Nuevo evento</button> : null}</div> : filtered.map((item) => {
          const combinations = catalog.combinations.filter((combination) => combination.eventId === item.id && combination.active);
          const institutions = catalog.institutions.filter((institution) => institution.eventId === item.id && institution.active).length;
          return <article className={styles.row} key={item.id}><span className={styles.logo}>{item.code.slice(0, 2)}</span><div className={styles.identity}><strong>{item.name}</strong><small>{institutions} {institutions === 1 ? 'institución asociada' : 'instituciones asociadas'}</small></div><span className={styles.eventName}>{combinations.length} {combinations.length === 1 ? 'combinación habilitada' : 'combinaciones habilitadas'}</span><span className={[styles.status, item.active ? styles.active : styles.inactive].filter(Boolean).join(' ')}>{item.active ? 'Activo' : 'Inactivo'}</span><button className={styles.editButton} onClick={() => startEdit(item)} type="button">Configurar</button></article>;
        })}
      </section>
      {drawerOpen ? <EventDrawer catalog={catalog} event={editing} onClose={() => setDrawerOpen(false)} onReload={reload} onSaved={saved} /> : null}
    </div>
  );
}

export function EventsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="events" title="Eventos"><EventsWorkspace /></AppShell>}</SessionBoundary>;
}
