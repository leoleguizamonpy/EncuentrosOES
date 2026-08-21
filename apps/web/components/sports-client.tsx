'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  adminCatalog,
  catalogAssetUrl,
  createSport,
  iconFromFile,
  updateSport,
  type AdminCatalog,
  type AdminVisualItem,
} from '../lib/catalog-admin-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';

interface SportDrawerProps {
  readonly sport: AdminVisualItem | null;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => Promise<void>;
}

function SportDrawer({ sport, onClose, onSaved }: SportDrawerProps): React.JSX.Element {
  const [name, setName] = useState(sport?.name ?? '');
  const [code, setCode] = useState(sport?.code ?? '');
  const [active, setActive] = useState(sport?.active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const currentAsset = sport?.iconAssetId ?? null;
  const visibleAsset = preview ?? (removeIcon || currentAsset === null ? null : catalogAssetUrl(currentAsset));

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (sport === null) {
        await createSport({ code, icon: await iconFromFile(file), name });
        await onSaved('Deporte creado correctamente.');
      } else {
        const base = { active, code, name };
        if (removeIcon) await updateSport(sport.id, { ...base, icon: null });
        else if (file === null) await updateSport(sport.id, base);
        else await updateSport(sport.id, { ...base, icon: await iconFromFile(file) });
        await onSaved('Deporte actualizado correctamente.');
      }
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el deporte.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" />
      <aside aria-labelledby="sport-drawer-title" aria-modal="true" className={styles.drawer} role="dialog">
        <div className={styles.drawerHeader}>
          <div><span className="eyebrow eyebrow--dark">Organización</span><h3 id="sport-drawer-title">{sport === null ? 'Nuevo deporte' : 'Editar deporte'}</h3></div>
          <button aria-label="Cerrar" className={styles.closeButton} onClick={onClose} type="button">×</button>
        </div>
        {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label>Nombre *<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Futsal" /></label>
          <label>Código *<input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="FUTSAL" /></label>
          <div>
            <span className="eyebrow eyebrow--dark">Identidad visual</span>
            <div className={styles.assetBox}>
              <div className={styles.assetPreview}>{visibleAsset === null ? <span aria-hidden="true">+</span> : <img alt="Vista previa del icono" src={visibleAsset} />}</div>
              <div className={styles.assetMeta}>
                <strong>Icono del deporte</strong>
                <input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} />
                <small>PNG, JPG/JPEG o WEBP · máximo 1,5 MB.</small>
              </div>
            </div>
          </div>
          {sport === null ? null : <label className={styles.checkRow}><input checked={removeIcon} disabled={currentAsset === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Retirar icono actual</label>}
          {sport === null ? null : <label className={styles.checkRow}><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Deporte activo</label>}
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={onClose} type="button">Cancelar</button>
            <button className={styles.saveButton} disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar deporte'}</button>
          </div>
        </form>
      </aside>
    </>
  );
}

function SportsWorkspace(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVisualItem | null>(null);

  async function reload(): Promise<void> {
    setCatalog(await adminCatalog());
  }

  useEffect(() => {
    let active = true;
    void adminCatalog()
      .then((loaded) => { if (active) setCatalog(loaded); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los deportes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (catalog === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return catalog.sports.filter((item) => {
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

  function startEdit(item: AdminVisualItem): void {
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
    try {
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="empty-state"><strong>Cargando deportes…</strong><p>Recuperando el catálogo deportivo desde el servidor.</p></div>;
  if (catalog === null) return <div className="empty-state"><strong>No fue posible cargar este módulo.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  return (
    <div className={styles.workspace}>
      <section className={styles.heading}>
        <div><span className="eyebrow eyebrow--dark">Organización</span><h2>Deportes</h2><p>Administra los deportes disponibles para las competencias OES y su identidad visual dentro del sistema.</p></div>
        <button className={styles.primaryButton} onClick={startCreate} type="button">+ Nuevo deporte</button>
      </section>
      {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
      {notice === null ? null : <p className={styles.notice} role="status">{notice}</p>}
      <section aria-label="Filtros de deportes" className={styles.toolbar}>
        <input aria-label="Buscar deporte" placeholder="Buscar por nombre o código…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select>
        <span />
        <span className={styles.counter}>{filtered.length} de {catalog.sports.length}</span>
      </section>
      <section aria-label="Listado de deportes" className={styles.tableCard}>
        <div className={styles.tableHeader}><span>Icono</span><span>Deporte</span><span>Código</span><span>Estado</span><span>Acción</span></div>
        {filtered.length === 0 ? <div className={styles.empty}><strong>{catalog.sports.length === 0 ? 'No hay deportes todavía.' : 'No encontramos resultados.'}</strong><p>{catalog.sports.length === 0 ? 'Carga los deportes que podrán utilizarse al configurar las competencias.' : 'Ajusta la búsqueda o el filtro para ver otros deportes.'}</p>{catalog.sports.length === 0 ? <button className={styles.primaryButton} onClick={startCreate} type="button">+ Nuevo deporte</button> : null}</div> : filtered.map((item) => <article className={styles.row} key={item.id}><span className={styles.logo}>{item.iconAssetId === null ? item.code.slice(0, 2) : <img alt={`Icono de ${item.name}`} src={catalogAssetUrl(item.iconAssetId)} />}</span><div className={styles.identity}><strong>{item.name}</strong><small>Deporte OES</small></div><span className={styles.eventName}>{item.code}</span><span className={[styles.status, item.active ? styles.active : styles.inactive].filter(Boolean).join(' ')}>{item.active ? 'Activo' : 'Inactivo'}</span><button className={styles.editButton} onClick={() => startEdit(item)} type="button">Editar</button></article>)}
      </section>
      {drawerOpen ? <SportDrawer sport={editing} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}
    </div>
  );
}

export function SportsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="sports" title="Deportes"><SportsWorkspace /></AppShell>}</SessionBoundary>;
}
