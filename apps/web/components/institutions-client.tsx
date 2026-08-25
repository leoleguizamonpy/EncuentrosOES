'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import organizationStyles from '../features/organization/organization.module.css';
import {
  adminCatalog,
  catalogAssetUrl,
  createInstitution,
  iconFromFile,
  updateInstitution,
  type AdminCatalog,
  type AdminInstitution,
} from '../lib/catalog-admin-api';
import { ActionButton, DataList, DataRow, EntityDrawer, Field, FormActions, ListToolbar, Notice, PageHeader, StatusBadge, TextField } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';
const STATUS_OPTIONS: readonly { readonly label: string; readonly value: StatusFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Activas', value: 'ACTIVE' },
  { label: 'Inactivas', value: 'INACTIVE' },
];

function InstitutionDrawer({ catalog, institution, onClose, onSaved }: { readonly catalog: AdminCatalog; readonly institution: AdminInstitution | null; readonly onClose: () => void; readonly onSaved: (message: string) => Promise<void> }): React.JSX.Element {
  const [eventId, setEventId] = useState(institution?.eventId ?? catalog.events[0]?.id ?? '');
  const [name, setName] = useState(institution?.name ?? '');
  const [code, setCode] = useState(institution?.code ?? '');
  const [active, setActive] = useState(institution?.active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (file === null) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const currentAsset = institution?.iconAssetId ?? null;
  const visibleAsset = preview ?? (removeIcon || currentAsset === null ? null : catalogAssetUrl(currentAsset));

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      if (eventId.length === 0) throw new Error('Selecciona un evento.');
      if (institution === null) { await createInstitution({ code, eventId, icon: await iconFromFile(file), name }); await onSaved('Institución creada correctamente.'); }
      else {
        const base = { active, code, eventId, name };
        if (removeIcon) await updateInstitution(institution.id, { ...base, icon: null });
        else if (file === null) await updateInstitution(institution.id, base);
        else await updateInstitution(institution.id, { ...base, icon: await iconFromFile(file) });
        await onSaved('Institución actualizada correctamente.');
      }
      onClose();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar la institución.'); }
    finally { setSaving(false); }
  }

  return <EntityDrawer eyebrow="Organización" onClose={onClose} title={institution === null ? 'Nueva institución' : 'Editar institución'}>
    {error === null ? null : <Notice description={error} tone="danger" />}
    <form className={organizationStyles.form} onSubmit={(event) => void submit(event)}>
      <Field label="Evento *"><select onChange={(event) => setEventId(event.target.value)} required value={eventId}><option value="">Seleccionar evento</option>{catalog.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <TextField label="Nombre *" onChange={(event) => setName(event.target.value)} placeholder="Escuela Nacional de Comercio" required value={name} />
      <TextField label="Código *" onChange={(event) => setCode(event.target.value)} placeholder="ENC" required value={code} />
      <section><span className={organizationStyles.fieldLabel}>Identidad visual</span><div className={organizationStyles.assetBox}><div className={organizationStyles.assetPreview}>{visibleAsset === null ? <span aria-hidden="true">+</span> : <img alt="Vista previa del escudo" src={visibleAsset} />}</div><div className={organizationStyles.assetMeta}><strong>Escudo de la institución</strong><input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /><small>PNG, JPG/JPEG o WEBP · máximo 1,5 MB.</small></div></div></section>
      {institution === null ? null : <label className={organizationStyles.checkRow}><input checked={removeIcon} disabled={currentAsset === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Retirar escudo actual</label>}
      {institution === null ? null : <label className={organizationStyles.checkRow}><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Institución activa</label>}
      <FormActions onCancel={onClose} submitLabel={saving ? 'Guardando…' : 'Guardar institución'} submitting={saving} />
    </form>
  </EntityDrawer>;
}

function InstitutionsWorkspace(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminInstitution | null>(null);

  async function reload(): Promise<void> { setCatalog(await adminCatalog()); }
  useEffect(() => { let active = true; void adminCatalog().then((loaded) => { if (active) setCatalog(loaded); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'No fue posible cargar las instituciones.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const eventNames = useMemo(() => new Map(catalog?.events.map((item) => [item.id, item.name]) ?? []), [catalog]);
  const filtered = useMemo(() => {
    if (catalog === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return catalog.institutions.filter((item) => (normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized)) && (eventFilter === 'ALL' || item.eventId === eventFilter) && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active)));
  }, [catalog, eventFilter, query, statusFilter]);

  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); }
  function startEdit(item: AdminInstitution): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); }
  async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando la organización desde el servidor." title="Cargando instituciones…" />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;

  const canCreate = catalog.events.length > 0;
  return <div className={organizationStyles.workspace}>
    <PageHeader action={canCreate ? { label: '+ Nueva institución', onPress: startCreate } : undefined} description="Administra las instituciones OES, su evento asociado y su identidad visual." eyebrow="Organización" title="Instituciones" />
    {canCreate ? null : <Notice description="Antes de crear una institución debes crear al menos un evento." tone="warning" />}
    {error === null ? null : <Notice description={error} tone="danger" />}{notice === null ? null : <Notice description={notice} tone="success" />}
    <ListToolbar count={filtered.length} extraFilter={<select aria-label="Filtrar por evento" onChange={(event) => setEventFilter(event.target.value)} value={eventFilter}><option value="ALL">Todos los eventos</option>{catalog.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} searchLabel="Buscar institución" searchPlaceholder="Buscar por nombre o código…" status={statusFilter} statusLabel="Filtrar por estado" statusOptions={STATUS_OPTIONS} total={catalog.institutions.length} />
    <DataList empty={{ action: catalog.institutions.length === 0 && canCreate ? <ActionButton onPress={startCreate}>+ Nueva institución</ActionButton> : undefined, description: catalog.institutions.length === 0 ? 'Carga las instituciones que podrán participar en los eventos OES.' : 'Ajusta la búsqueda o los filtros para ver otras instituciones.', title: catalog.institutions.length === 0 ? 'No hay instituciones todavía.' : 'No encontramos resultados.' }} isEmpty={filtered.length === 0} label="Listado de instituciones">
      {filtered.map((item) => <DataRow description={item.code} key={item.id} meta={eventNames.get(item.eventId) ?? 'Evento no disponible'} onPress={() => startEdit(item)} status={<StatusBadge label={item.active ? 'Activa' : 'Inactiva'} tone={item.active ? 'success' : 'default'} />} title={item.name} visual={item.iconAssetId === null ? item.code.slice(0, 2) : <img alt={`Escudo de ${item.name}`} src={catalogAssetUrl(item.iconAssetId)} />} />)}
    </DataList>
    {drawerOpen ? <InstitutionDrawer catalog={catalog} institution={editing} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}
  </div>;
}

export function InstitutionsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="institutions" title="Instituciones"><InstitutionsWorkspace /></AppShell>}</SessionBoundary>; }
