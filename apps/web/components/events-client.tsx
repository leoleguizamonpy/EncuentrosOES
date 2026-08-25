'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import organizationStyles from '../features/organization/organization.module.css';
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
import { ActionButton, DataList, DataRow, EntityDrawer, FormActions, ListToolbar, Notice, PageHeader, StatusBadge, TextField } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';
const STATUS_OPTIONS: readonly { readonly label: string; readonly value: StatusFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Activos', value: 'ACTIVE' },
  { label: 'Inactivos', value: 'INACTIVE' },
];

function combinationKey(eventId: string, sportId: string, modalityId: string): string { return `${eventId}:${sportId}:${modalityId}`; }

function EventDrawer({ catalog, event, onClose, onReload, onSaved }: { readonly catalog: AdminCatalog; readonly event: AdminEvent | null; readonly onClose: () => void; readonly onReload: () => Promise<AdminCatalog>; readonly onSaved: (message: string) => Promise<void> }): React.JSX.Element {
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
    try {
      if (event === null) { await createEvent({ code, name }); await onSaved('Evento creado correctamente.'); }
      else { await updateEvent(event.id, { active, code, name }); await onSaved('Evento actualizado correctamente.'); }
      onClose();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el evento.'); }
    finally { setSaving(false); }
  }

  async function toggleCombination(sportId: string, modalityId: string): Promise<void> {
    if (event === null) return;
    const key = combinationKey(event.id, sportId, modalityId); setRelationBusy(key); setError(null);
    try {
      const current = findCombination(sportId, modalityId);
      if (current === undefined) await createCombination({ eventId: event.id, modalityId, sportId });
      else await updateCombination({ active: !current.active, eventId: event.id, modalityId, sportId });
      setLocalCatalog(await onReload());
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible actualizar deportes y modalidades.'); }
    finally { setRelationBusy(null); }
  }

  const activeSports = localCatalog.sports.filter((sport) => sport.active);
  const activeModalities = localCatalog.modalities.filter((modality) => modality.active);

  return <EntityDrawer eyebrow="Organización" onClose={onClose} title={event === null ? 'Nuevo evento' : 'Editar evento'}>
    {error === null ? null : <Notice description={error} tone="danger" />}
    <form className={organizationStyles.form} onSubmit={(submitEvent) => void submit(submitEvent)}>
      <TextField label="Nombre *" onChange={(changeEvent) => setName(changeEvent.target.value)} placeholder="Colegiales" required value={name} />
      <TextField label="Código *" onChange={(changeEvent) => setCode(changeEvent.target.value)} placeholder="COLEGIALES" required value={code} />
      {event === null ? null : <label className={organizationStyles.checkRow}><input checked={active} type="checkbox" onChange={(changeEvent) => setActive(changeEvent.target.checked)} /> Evento activo</label>}
      <FormActions onCancel={onClose} submitLabel={saving ? 'Guardando…' : 'Guardar evento'} submitting={saving} />
    </form>
    {event === null ? null : <section aria-labelledby="event-relations-title" className={organizationStyles.relations}>
      <div><span className={organizationStyles.fieldLabel}>Configuración contextual</span><h4 id="event-relations-title">Deportes y modalidades</h4><p className={organizationStyles.relationIntro}>Habilita únicamente las combinaciones válidas para este evento. Esta es la representación de producto de Evento + Deporte + Modalidad.</p></div>
      {activeSports.length === 0 || activeModalities.length === 0 ? <Notice description="Necesitas al menos un deporte y una modalidad activos antes de configurar este evento." tone="warning" /> : activeSports.map((sport) => <div className={organizationStyles.relationGroup} key={sport.id}><strong className={organizationStyles.relationGroupTitle}>{sport.name}</strong>{activeModalities.map((modality) => { const current = findCombination(sport.id, modality.id); const checked = current?.active ?? false; const key = combinationKey(event.id, sport.id, modality.id); return <label className={organizationStyles.checkRow} key={modality.id}><input aria-label={`${sport.name} · ${modality.name}`} checked={checked} disabled={relationBusy !== null} type="checkbox" onChange={() => void toggleCombination(sport.id, modality.id)} /> {modality.name}{relationBusy === key ? ' · actualizando…' : ''}</label>; })}</div>)}
    </section>}
  </EntityDrawer>;
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

  async function reload(): Promise<AdminCatalog> { const loaded = await adminCatalog(); setCatalog(loaded); return loaded; }
  useEffect(() => { let mounted = true; void adminCatalog().then((loaded) => { if (mounted) setCatalog(loaded); }).catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los eventos.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => {
    if (catalog === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return catalog.events.filter((item) => (normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized)) && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active)));
  }, [catalog, query, statusFilter]);

  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); }
  function startEdit(item: AdminEvent): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); }
  async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando la estructura organizativa desde el servidor." title="Cargando eventos…" />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;

  return <div className={organizationStyles.workspace}>
    <PageHeader action={{ label: '+ Nuevo evento', onPress: startCreate }} description="Administra los eventos OES y las combinaciones de deporte y modalidad disponibles." eyebrow="Organización" title="Eventos" />
    {error === null ? null : <Notice description={error} tone="danger" />}{notice === null ? null : <Notice description={notice} tone="success" />}
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} searchLabel="Buscar evento" searchPlaceholder="Buscar por nombre o código…" status={statusFilter} statusLabel="Filtrar por estado" statusOptions={STATUS_OPTIONS} total={catalog.events.length} />
    <DataList empty={{ action: <ActionButton onPress={startCreate}>+ Nuevo evento</ActionButton>, description: catalog.events.length === 0 ? 'Crea los eventos que agruparán instituciones y competencias, como Colegiales o Universitarios.' : 'Ajusta la búsqueda o el filtro para ver otros eventos.', title: catalog.events.length === 0 ? 'No hay eventos todavía.' : 'No encontramos resultados.' }} isEmpty={filtered.length === 0} label="Listado de eventos">
      {filtered.map((item) => { const combinations = catalog.combinations.filter((combination) => combination.eventId === item.id && combination.active); const institutions = catalog.institutions.filter((institution) => institution.eventId === item.id && institution.active).length; return <DataRow description={`${String(institutions)} ${institutions === 1 ? 'institución asociada' : 'instituciones asociadas'}`} key={item.id} meta={`${String(combinations.length)} ${combinations.length === 1 ? 'combinación habilitada' : 'combinaciones habilitadas'}`} onPress={() => startEdit(item)} status={<StatusBadge label={item.active ? 'Activo' : 'Inactivo'} tone={item.active ? 'success' : 'default'} />} title={item.name} visual={item.code.slice(0, 2)} />; })}
    </DataList>
    {drawerOpen ? <EventDrawer catalog={catalog} event={editing} onClose={() => setDrawerOpen(false)} onReload={reload} onSaved={saved} /> : null}
  </div>;
}

export function EventsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="events" title="Eventos"><EventsWorkspace /></AppShell>}</SessionBoundary>; }
