'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  adminCatalog,
  createEdition,
  updateEdition,
  type AdminCatalog,
  type AdminEdition,
} from '../lib/catalog-admin-api';
import { ActionButton, DataList, DataRow, EntityDrawer, Field, FormActions, ListToolbar, Notice, PageHeader, StatusBadge, TextField } from '../ui';
import organizationStyles from '../features/organization/organization.module.css';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type EditionStatusFilter = 'ALL' | 'CLOSED' | 'OPEN';
const STATUS_OPTIONS: readonly { readonly label: string; readonly value: EditionStatusFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Abiertas', value: 'OPEN' },
  { label: 'Cerradas', value: 'CLOSED' },
];

function EditionDrawer({ edition, onClose, onSaved }: { readonly edition: AdminEdition | null; readonly onClose: () => void; readonly onSaved: (message: string) => Promise<void> }): React.JSX.Element {
  const [name, setName] = useState(edition?.name ?? '');
  const [year, setYear] = useState(edition?.year ?? new Date().getFullYear());
  const [status, setStatus] = useState<'CLOSED' | 'OPEN'>(edition?.status ?? 'OPEN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      if (edition === null) { await createEdition({ name, status, year }); await onSaved('Edición creada correctamente.'); }
      else { await updateEdition(edition.id, { name, status, year }); await onSaved('Edición actualizada correctamente.'); }
      onClose();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar la edición.'); }
    finally { setSaving(false); }
  }

  return <EntityDrawer eyebrow="Organización" onClose={onClose} title={edition === null ? 'Nueva edición' : 'Editar edición'}>
    {error === null ? null : <Notice description={error} tone="danger" />}
    <form className={organizationStyles.form} onSubmit={(event) => void submit(event)}>
      <TextField label="Nombre *" onChange={(event) => setName(event.target.value)} placeholder="OES 2027" required value={name} />
      <TextField label="Año *" max="2100" min="2020" onChange={(event) => setYear(Number(event.target.value))} required type="number" value={String(year)} />
      <Field label="Estado *"><select onChange={(event) => setStatus(event.target.value as 'CLOSED' | 'OPEN')} value={status}><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></Field>
      <FormActions onCancel={onClose} submitLabel={saving ? 'Guardando…' : 'Guardar edición'} submitting={saving} />
    </form>
  </EntityDrawer>;
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
  useEffect(() => { let active = true; void adminCatalog().then((loaded) => { if (active) setCatalog(loaded); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'No fue posible cargar las ediciones.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  const filtered = useMemo(() => {
    if (catalog === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return catalog.editions.filter((item) => (normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || String(item.year).includes(normalized)) && (statusFilter === 'ALL' || item.status === statusFilter));
  }, [catalog, query, statusFilter]);

  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); }
  function startEdit(item: AdminEdition): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); }
  async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando los ciclos OES desde el servidor." title="Cargando ediciones…" />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;

  return <div className={organizationStyles.workspace}>
    <PageHeader action={{ label: '+ Nueva edición', onPress: startCreate }} description="Administra los ciclos anuales OES y controla cuándo están abiertos o cerrados." eyebrow="Organización" title="Ediciones" />
    {error === null ? null : <Notice description={error} tone="danger" />}{notice === null ? null : <Notice description={notice} tone="success" />}
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} searchLabel="Buscar edición" searchPlaceholder="Buscar por nombre o año…" status={statusFilter} statusLabel="Filtrar por estado" statusOptions={STATUS_OPTIONS} total={catalog.editions.length} />
    <DataList empty={{ action: <ActionButton onPress={startCreate}>+ Nueva edición</ActionButton>, description: catalog.editions.length === 0 ? 'Crea la edición que agrupará los eventos y competencias de un ciclo OES.' : 'Ajusta la búsqueda o el filtro para ver otras ediciones.', title: catalog.editions.length === 0 ? 'No hay ediciones todavía.' : 'No encontramos resultados.' }} isEmpty={filtered.length === 0} label="Listado de ediciones">
      {filtered.map((item) => <DataRow description="Edición OES" key={item.id} meta={item.year} onPress={() => startEdit(item)} status={<StatusBadge label={item.status === 'OPEN' ? 'Abierta' : 'Cerrada'} tone={item.status === 'OPEN' ? 'success' : 'default'} />} title={item.name} visual={String(item.year).slice(-2)} />)}
    </DataList>
    {drawerOpen ? <EditionDrawer edition={editing} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}
  </div>;
}

export function EditionsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="editions" title="Ediciones"><EditionsWorkspace /></AppShell>}</SessionBoundary>; }
