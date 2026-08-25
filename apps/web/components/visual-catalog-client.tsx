'use client';

import { Alert, Button, Chip, Input } from '@heroui/react';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

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
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';
type VisualCatalogKind = 'modality' | 'sport';

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

function itemsFromCatalog(catalog: AdminCatalog, kind: VisualCatalogKind): readonly AdminVisualItem[] {
  return kind === 'sport' ? catalog.sports : catalog.modalities;
}

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

interface DrawerProps {
  readonly item: AdminVisualItem | null;
  readonly kind: VisualCatalogKind;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => Promise<void>;
}

function VisualDrawer({ item, kind, onClose, onSaved }: DrawerProps): React.JSX.Element {
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
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const currentAsset = item?.iconAssetId ?? null;
  const visibleAsset = preview ?? (removeIcon || currentAsset === null ? null : catalogAssetUrl(currentAsset));

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (item === null) await createItem(kind, code, name, file);
      else await updateItem(kind, item, { active, code, name }, file, removeIcon);
      await onSaved(`${labels.singular.charAt(0).toLocaleUpperCase('es-PY')}${labels.singular.slice(1)} ${item === null ? 'creado' : 'actualizado'} correctamente.`);
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : `No fue posible guardar ${labels.singular}.`);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" />
    <aside aria-labelledby="visual-drawer-title" aria-modal="true" className={styles.drawer} role="dialog">
      <div className={styles.drawerHeader}><div><span className="eyebrow eyebrow--dark">Organización</span><h3 id="visual-drawer-title">{item === null ? labels.createLabel.replace('+ ', '') : `Editar ${labels.singular}`}</h3></div><Button aria-label="Cerrar" isIconOnly onPress={onClose} variant="ghost">×</Button></div>
      {error === null ? null : <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Title>No fue posible guardar</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <label>Nombre *<Input required value={name} onChange={(event) => setName(event.target.value)} placeholder={labels.placeholderName} variant="secondary" /></label>
        <label>Código *<Input required value={code} onChange={(event) => setCode(event.target.value)} placeholder={labels.placeholderCode} variant="secondary" /></label>
        <div><span className="eyebrow eyebrow--dark">Identidad visual</span><div className={styles.assetBox}><div className={styles.assetPreview}>{visibleAsset === null ? <span aria-hidden="true">+</span> : <img alt="Vista previa del icono" src={visibleAsset} />}</div><div className={styles.assetMeta}><strong>Icono de {labels.singular}</strong><input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /><small>PNG, JPG/JPEG o WEBP · máximo 1,5 MB.</small></div></div></div>
        {item === null ? null : <label className={styles.checkRow}><input checked={removeIcon} disabled={currentAsset === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Retirar icono actual</label>}
        {item === null ? null : <label className={styles.checkRow}><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> {labels.activeLabel}</label>}
        <div className={styles.actions}><Button onPress={onClose} type="button" variant="secondary">Cancelar</Button><Button isDisabled={saving} type="submit" variant="primary">{saving ? 'Guardando…' : `Guardar ${labels.singular}`}</Button></div>
      </form>
    </aside>
  </>;
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

  useEffect(() => {
    let active = true;
    void adminCatalog().then((loaded) => { if (active) setCatalog(loaded); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : `No fue posible cargar ${labels.plural.toLocaleLowerCase('es-PY')}.`); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [labels.plural]);

  const items = useMemo(() => catalog === null ? [] : itemsFromCatalog(catalog, kind), [catalog, kind]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return items.filter((item) => (normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized)) && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active)));
  }, [items, query, statusFilter]);

  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); }
  function startEdit(item: AdminVisualItem): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); }
  async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> {
    setLoading(true);
    setError(null);
    try { await reload(); }
    catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <WorkspaceState detail="Recuperando la organización desde el servidor." title={labels.loadingLabel} />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;

  return <div className={styles.workspace}>
    <section className={styles.heading}><div><span className="eyebrow eyebrow--dark">Organización</span><h2>{labels.plural}</h2><p>{labels.description}</p></div><Button onPress={startCreate} variant="primary">{labels.createLabel}</Button></section>
    {error === null ? null : <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}{notice === null ? null : <Alert status="success" role="status"><Alert.Indicator /><Alert.Content><Alert.Description>{notice}</Alert.Description></Alert.Content></Alert>}
    <section aria-label={`Filtros de ${labels.plural.toLocaleLowerCase('es-PY')}`} className={styles.toolbar}><Input aria-label={`Buscar ${labels.singular}`} placeholder="Buscar por nombre o código…" value={query} onChange={(event) => setQuery(event.target.value)} variant="secondary" /><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select><span /><span className={styles.counter}>{filtered.length} de {items.length}</span></section>
    <section aria-label={`Listado de ${labels.plural.toLocaleLowerCase('es-PY')}`} className={styles.tableCard}><div className={styles.tableHeader}><span>Icono</span><span>{labels.singular}</span><span>Código</span><span>Estado</span><span aria-hidden="true" /></div>{filtered.length === 0 ? <div className={styles.empty}><strong>{items.length === 0 ? labels.emptyLabel : 'No encontramos resultados.'}</strong><p>{items.length === 0 ? labels.emptyDescription : 'Ajusta la búsqueda o el filtro para ver otros registros.'}</p>{items.length === 0 ? <Button onPress={startCreate} variant="primary">{labels.createLabel}</Button> : null}</div> : filtered.map((item) => <article aria-label={`Editar ${item.name}`} className={styles.row} key={item.id} onClick={() => startEdit(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); startEdit(item); } }} role="button" tabIndex={0}><span className={styles.logo}>{item.iconAssetId === null ? item.code.slice(0, 2) : <img alt={`Icono de ${item.name}`} src={catalogAssetUrl(item.iconAssetId)} />}</span><div className={styles.identity}><strong>{item.name}</strong><small>{labels.itemLabel}</small></div><span className={styles.eventName}>{item.code}</span><Chip color={item.active ? 'success' : 'default'} size="sm" variant="soft">{item.active ? 'Activo' : 'Inactivo'}</Chip><span aria-hidden="true" className={styles.rowArrow}>→</span></article>)}</section>
    {drawerOpen ? <VisualDrawer item={editing} kind={kind} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}
  </div>;
}

export function VisualCatalogClient({ kind }: { readonly kind: VisualCatalogKind }): React.JSX.Element {
  const labels = copy[kind];
  const active = kind === 'sport' ? 'sports' : 'modalities';
  return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active={active} title={labels.plural}><VisualCatalogWorkspace kind={kind} /></AppShell>}</SessionBoundary>;
}
