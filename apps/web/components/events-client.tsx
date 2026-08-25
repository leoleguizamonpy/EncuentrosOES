'use client';

import { Alert, Button, Card, Chip, Input } from '@heroui/react';
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
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';

interface EventDrawerProps {
  readonly catalog: AdminCatalog;
  readonly event: AdminEvent | null;
  readonly onClose: () => void;
  readonly onReload: () => Promise<AdminCatalog>;
  readonly onSaved: (message: string) => Promise<void>;
}

function combinationKey(eventId: string, sportId: string, modalityId: string): string { return `${eventId}:${sportId}:${modalityId}`; }

function EventDrawer({ catalog, event, onClose, onReload, onSaved }: EventDrawerProps): React.JSX.Element {
  const [name, setName] = useState(event?.name ?? '');
  const [code, setCode] = useState(event?.code ?? '');
  const [active, setActive] = useState(event?.active ?? true);
  const [localCatalog, setLocalCatalog] = useState(catalog);
  const [saving, setSaving] = useState(false);
  const [relationBusy, setRelationBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventCombinations = useMemo(() => event === null ? [] : localCatalog.combinations.filter((item) => item.eventId === event.id), [event, localCatalog.combinations]);
  function findCombination(sportId: string, modalityId: string): AdminCombination | undefined { return eventCombinations.find((item) => item.sportId === sportId && item.modalityId === modalityId); }

  async function submit(eventSubmit: SyntheticEvent<HTMLFormElement>): Promise<void> {
    eventSubmit.preventDefault(); setError(null); setSaving(true);
    try { if (event === null) { await createEvent({ code, name }); await onSaved('Evento creado correctamente.'); } else { await updateEvent(event.id, { active, code, name }); await onSaved('Evento actualizado correctamente.'); } onClose(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el evento.'); }
    finally { setSaving(false); }
  }

  async function toggleCombination(sportId: string, modalityId: string): Promise<void> {
    if (event === null) return; const key = combinationKey(event.id, sportId, modalityId); setRelationBusy(key); setError(null);
    try { const current = findCombination(sportId, modalityId); if (current === undefined) await createCombination({ eventId: event.id, modalityId, sportId }); else await updateCombination({ active: !current.active, eventId: event.id, modalityId, sportId }); setLocalCatalog(await onReload()); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible actualizar deportes y modalidades.'); }
    finally { setRelationBusy(null); }
  }

  return <><button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" /><aside aria-labelledby="event-drawer-title" aria-modal="true" className={styles.drawer} role="dialog">
    <div className={styles.drawerHeader}><div><span className="eyebrow eyebrow--dark">Organización</span><h3 id="event-drawer-title">{event === null ? 'Nuevo evento' : 'Editar evento'}</h3></div><Button aria-label="Cerrar" isIconOnly onPress={onClose} variant="ghost">×</Button></div>
    {error === null ? null : <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
    <form className={styles.form} onSubmit={(submitEvent) => void submit(submitEvent)}><span className="eyebrow eyebrow--dark">General</span><label>Nombre *<Input required value={name} onChange={(changeEvent) => setName(changeEvent.target.value)} placeholder="Colegiales" variant="secondary" /></label><label>Código *<Input required value={code} onChange={(changeEvent) => setCode(changeEvent.target.value)} placeholder="COLEGIALES" variant="secondary" /></label>{event === null ? null : <label className={styles.checkRow}><input checked={active} type="checkbox" onChange={(changeEvent) => setActive(changeEvent.target.checked)} /> Evento activo</label>}<div className={styles.actions}><Button onPress={onClose} type="button" variant="secondary">Cancelar</Button><Button isDisabled={saving} type="submit" variant="primary">{saving ? 'Guardando…' : 'Guardar evento'}</Button></div></form>
    {event === null ? null : <section aria-labelledby="event-relations-title" style={{ marginTop: 32 }}><span className="eyebrow eyebrow--dark">Configuración contextual</span><h4 id="event-relations-title" style={{ fontSize: 18, marginBottom: 8 }}>Deportes y modalidades</h4><p style={{ color: 'var(--muted-foreground)', fontSize: 11, lineHeight: 1.6, marginBottom: 18 }}>Habilita únicamente las combinaciones válidas para este evento. Esta es la representación de producto de Evento + Deporte + Modalidad.</p>{localCatalog.sports.filter((sport) => sport.active).length === 0 || localCatalog.modalities.filter((modality) => modality.active).length === 0 ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Necesitas al menos un deporte y una modalidad activos antes de configurar este evento.</Alert.Description></Alert.Content></Alert> : localCatalog.sports.filter((sport) => sport.active).map((sport) => <Card key={sport.id} style={{ marginBottom: 10 }}><Card.Content style={{ padding: 16 }}><strong style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>{sport.name}</strong>{localCatalog.modalities.filter((modality) => modality.active).map((modality) => { const current = findCombination(sport.id, modality.id); const checked = current?.active ?? false; const key = combinationKey(event.id, sport.id, modality.id); return <label className={styles.checkRow} key={modality.id} style={{ marginBottom: 9 }}><input aria-label={`${sport.name} · ${modality.name}`} checked={checked} disabled={relationBusy !== null} type="checkbox" onChange={() => void toggleCombination(sport.id, modality.id)} /> {modality.name}{relationBusy === key ? ' · actualizando…' : ''}</label>; })}</Card.Content></Card>)}</section>}
  </aside></>;
}

function EventsWorkspace(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [query, setQuery] = useState(''); const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL'); const [drawerOpen, setDrawerOpen] = useState(false); const [editing, setEditing] = useState<AdminEvent | null>(null);
  async function reload(): Promise<AdminCatalog> { const loaded = await adminCatalog(); setCatalog(loaded); return loaded; }
  useEffect(() => { let mounted = true; void adminCatalog().then((loaded) => { if (mounted) setCatalog(loaded); }).catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los eventos.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);
  const filtered = useMemo(() => { if (catalog === null) return []; const normalized = query.trim().toLocaleLowerCase('es-PY'); return catalog.events.filter((item) => (normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized)) && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active))); }, [catalog, query, statusFilter]);
  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); } function startEdit(item: AdminEvent): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); } async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }
  if (loading) return <WorkspaceState detail="Recuperando la estructura organizativa desde el servidor." title="Cargando eventos…" />; if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;
  return <div className={styles.workspace}><section className={styles.heading}><div><span className="eyebrow eyebrow--dark">Organización</span><h2>Eventos</h2><p>Administra los eventos OES y las combinaciones de deporte y modalidad disponibles.</p></div><Button onPress={startCreate} variant="primary">+ Nuevo evento</Button></section>{error === null ? null : <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}{notice === null ? null : <Alert status="success"><Alert.Indicator /><Alert.Content><Alert.Description>{notice}</Alert.Description></Alert.Content></Alert>}<section aria-label="Filtros de eventos" className={styles.toolbar}><Input aria-label="Buscar evento" placeholder="Buscar por nombre o código…" value={query} onChange={(changeEvent) => setQuery(changeEvent.target.value)} variant="secondary" /><select aria-label="Filtrar por estado" value={statusFilter} onChange={(changeEvent) => setStatusFilter(changeEvent.target.value as StatusFilter)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select><span /><span className={styles.counter}>{filtered.length} de {catalog.events.length}</span></section><Card className={styles.tableCard ?? ''} aria-label="Listado de eventos"><Card.Content style={{ padding: 0 }}><div className={styles.tableHeader}><span>Código</span><span>Evento</span><span>Configuración</span><span>Estado</span><span aria-hidden="true" /></div>{filtered.length === 0 ? <div className={styles.empty}><strong>{catalog.events.length === 0 ? 'No hay eventos todavía.' : 'No encontramos resultados.'}</strong><p>{catalog.events.length === 0 ? 'Crea los eventos que agruparán instituciones y competencias, como Colegiales o Universitarios.' : 'Ajusta la búsqueda o el filtro para ver otros eventos.'}</p>{catalog.events.length === 0 ? <Button onPress={startCreate} variant="primary">+ Nuevo evento</Button> : null}</div> : filtered.map((item) => { const combinations = catalog.combinations.filter((combination) => combination.eventId === item.id && combination.active); const institutions = catalog.institutions.filter((institution) => institution.eventId === item.id && institution.active).length; return <article aria-label={`Configurar ${item.name}`} className={styles.row} key={item.id} onClick={() => startEdit(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); startEdit(item); } }} role="button" tabIndex={0}><span className={styles.logo}>{item.code.slice(0, 2)}</span><div className={styles.identity}><strong>{item.name}</strong><small>{institutions} {institutions === 1 ? 'institución asociada' : 'instituciones asociadas'}</small></div><span className={styles.eventName}>{combinations.length} {combinations.length === 1 ? 'combinación habilitada' : 'combinaciones habilitadas'}</span><Chip color={item.active ? 'success' : 'default'} size="sm" variant="soft">{item.active ? 'Activo' : 'Inactivo'}</Chip><span aria-hidden="true" className={styles.rowArrow}>→</span></article>; })}</Card.Content></Card>{drawerOpen ? <EventDrawer catalog={catalog} event={editing} onClose={() => setDrawerOpen(false)} onReload={reload} onSaved={saved} /> : null}</div>;
}

export function EventsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="events" title="Eventos"><EventsWorkspace /></AppShell>}</SessionBoundary>; }
