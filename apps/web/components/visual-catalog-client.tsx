'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import organizationStyles from '../features/organization/organization.module.css';
import {
  adminCatalog,
  catalogAssetUrl,
  createModality,
  createSport,
  iconFromFile,
  updateModality,
  updateSport,
  type AdminCatalog,
  type AdminVisualItem,
} from '../lib/catalog-admin-api';
import { ActionButton, DataList, DataRow, EntityDrawer, FormActions, ListToolbar, Notice, PageHeader, StatusBadge, TextField } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';
type VisualCatalogKind = 'modality' | 'sport';
const STATUS_OPTIONS: readonly { readonly label: string; readonly value: StatusFilter }[] = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Activos', value: 'ACTIVE' },
  { label: 'Inactivos', value: 'INACTIVE' },
];

interface VisualCatalogCopy {
  readonly activeLabel: string;
  readonly createLabel: string;
  readonly description: string;
  readonly emptyDescription: string;
  readonly emptyLabel: string;
  readonly itemLabel: string;
  readonly loadingLabel: string;
  readonly plural: string;
  readonly singular: string;
  readonly placeholderCode: string;
  readonly placeholderName: string;
}

const copy: Record<VisualCatalogKind, VisualCatalogCopy> = {
  modality: {
    activeLabel: 'Modalidad activa',
    createLabel: '+ Nueva modalidad',
    description: 'Administra las modalidades disponibles para las competencias y su identidad visual.',
    emptyDescription: 'Carga las modalidades que podrán utilizarse al configurar las competencias.',
    emptyLabel: 'No hay modalidades todavía.',
    itemLabel: 'Modalidad OES',
    loadingLabel: 'Cargando modalidades…',
    plural: 'Modalidades',
    singular: 'modalidad',
    placeholderCode: 'MASC',
    placeholderName: 'Masculina',
  },
  sport: {
    activeLabel: 'Deporte activo',
    createLabel: '+ Nuevo deporte',
    description: 'Administra los deportes disponibles para las competencias y su identidad visual.',
    emptyDescription: 'Carga los deportes que podrán utilizarse al configurar las competencias.',
    emptyLabel: 'No hay deportes todavía.',
    itemLabel: 'Deporte OES',
    loadingLabel: 'Cargando deportes…',
    plural: 'Deportes',
    singular: 'deporte',
    placeholderCode: 'FUTSAL',
    placeholderName: 'Futsal',
  },
};

function itemsFromCatalog(catalog: AdminCatalog, kind: VisualCatalogKind): readonly AdminVisualItem[] { return kind === 'sport' ? catalog.sports : catalog.modalities; }

async function createItem(kind: VisualCatalogKind, code: string, name: string, file: File | null): Promise<void> {
  const icon = await iconFromFile(file);
  if (kind === 'sport') await createSport({ code, icon, name });
  else await createModality({ code, icon, name });
}

async function updateItem(kind: VisualCatalogKind, item: AdminVisualItem, base: { readonly active: boolean; readonly code: string; readonly name: string }, file: File | null, removeIcon: boolean): Promise<void> {
  if (kind === 'sport') {
    if (removeIcon) await updateSport(item.id, { ...base, icon: null });
    else if (file === null) await updateSport(item.id, base);
    else await updateSport(item.id, { ...base, icon: await iconFromFile(file) });
    return;
  }
  if (removeIcon) await updateModality(item.id, { ...base, icon: null });
  else if (file === null) await updateModality(item.id, base);
  else await updateModality(item.id, { ...base, icon: await iconFromFile(file) });
}

function VisualDrawer({ item, kind, onClose, onSaved }: { readonly item: AdminVisualItem | null; readonly kind: VisualCatalogKind; readonly onClose: () => void; readonly onSaved: (message: string) => Promise<void> }): React.JSX.Element {
  const labels = copy[kind];
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);

  const currentAsset = item?.iconAssetId ?? null;
  const visibleAsset = preview ?? (removeIcon || currentAsset === null ? null : catalogAssetUrl(currentAsset));

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      if (item === null) await createItem(kind, code, name, file);
      else await updateItem(kind, item, { active, code, name }, file, removeIcon);
      const subject = `${labels.singular.charAt(0).toLocaleUpperCase('es-PY')}${labels.singular.slice(1)}`;
      await onSaved(`${subject} ${item === null ? 'creado' : 'actualizado'} correctamente.`); onClose();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : `No fue posible guardar ${labels.singular}.`); }
    finally { setSaving(false); }
  }

  return <EntityDrawer eyebrow="Organización" onClose={onClose} title={item === null ? labels.createLabel.replace('+ ', '') : `Editar ${labels.singular}`}>
    {error === null ? null : <Notice description={error} title="No fue posible guardar" tone="danger" />}
    <form className={organizationStyles.form} onSubmit={(event) => void submit(event)}>
      <TextField label="Nombre *" onChange={(event) => setName(event.target.value)} placeholder={labels.placeholderName} required value={name} />
      <TextField label="Código *" onChange={(event) => setCode(event.target.value)} placeholder={labels.placeholderCode} required value={code} />
      <section>
        <span className={organizationStyles.fieldLabel}>Identidad visual</span>
        <div className={organizationStyles.assetBox}>
          <div className={organizationStyles.assetPreview}>{visibleAsset === null ? <span aria-hidden="true">+</span> : <img alt="Vista previa del icono" src={visibleAsset} />}</div>
          <div className={organizationStyles.assetMeta}><strong>Icono de {labels.singular}</strong><input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /><small>PNG, JPG/JPEG o WEBP · máximo 1,5 MB.</small></div>
        </div>
      </section>
      {item === null ? null : <label className={organizationStyles.checkRow}><input checked={removeIcon} disabled={currentAsset === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Retirar icono actual</label>}
      {item === null ? null : <label className={organizationStyles.checkRow}><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> {labels.activeLabel}</label>}
      <FormActions onCancel={onClose} submitLabel={saving ? 'Guardando…' : `Guardar ${labels.singular}`} submitting={saving} />
    </form>
  </EntityDrawer>;
}

function VisualCatalogWorkspace({ kind }: { readonly kind: VisualCatalogKind }): React.JSX.Element {
  const labels = copy[kind];
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVisualItem | null>(null);

  async function reload(): Promise<void> { setCatalog(await adminCatalog()); }
  useEffect(() => { let active = true; void adminCatalog().then((loaded) => { if (active) setCatalog(loaded); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : `No fue posible cargar ${labels.plural.toLocaleLowerCase('es-PY')}.`); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [labels.plural]);

  const items = useMemo(() => catalog === null ? [] : itemsFromCatalog(catalog, kind), [catalog, kind]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return items.filter((item) => (normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized)) && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active)));
  }, [items, query, statusFilter]);

  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); }
  function startEdit(item: AdminVisualItem): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); }
  async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando la organización desde el servidor." title={labels.loadingLabel} />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;

  return <div className={organizationStyles.workspace}>
    <PageHeader action={{ label: labels.createLabel, onPress: startCreate }} description={labels.description} eyebrow="Organización" title={labels.plural} />
    {error === null ? null : <Notice description={error} tone="danger" />}{notice === null ? null : <Notice description={notice} tone="success" />}
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} searchLabel={`Buscar ${labels.singular}`} searchPlaceholder="Buscar por nombre o código…" status={statusFilter} statusLabel="Filtrar por estado" statusOptions={STATUS_OPTIONS} total={items.length} />
    <DataList empty={{ action: <ActionButton onPress={startCreate}>{labels.createLabel}</ActionButton>, description: items.length === 0 ? labels.emptyDescription : 'Ajusta la búsqueda o el filtro para ver otros registros.', title: items.length === 0 ? labels.emptyLabel : 'No encontramos resultados.' }} isEmpty={filtered.length === 0} label={`Listado de ${labels.plural.toLocaleLowerCase('es-PY')}`}>
      {filtered.map((item) => <DataRow description={labels.itemLabel} key={item.id} meta={item.code} onPress={() => startEdit(item)} status={<StatusBadge label={item.active ? 'Activo' : 'Inactivo'} tone={item.active ? 'success' : 'default'} />} title={item.name} visual={item.iconAssetId === null ? item.code.slice(0, 2) : <img alt={`Icono de ${item.name}`} src={catalogAssetUrl(item.iconAssetId)} />} />)}
    </DataList>
    {drawerOpen ? <VisualDrawer item={editing} kind={kind} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}
  </div>;
}

export function VisualCatalogClient({ kind }: { readonly kind: VisualCatalogKind }): React.JSX.Element {
  const labels = copy[kind]; const active = kind === 'sport' ? 'sports' : 'modalities';
  return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active={active} title={labels.plural}><VisualCatalogWorkspace kind={kind} /></AppShell>}</SessionBoundary>;
}
