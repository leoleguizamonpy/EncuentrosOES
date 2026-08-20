'use client';

import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { currentActor, logout, type Actor } from '../lib/auth-api';
import {
  adminCatalog,
  catalogAssetUrl,
  iconFromFile,
  updateCombination,
  updateEdition,
  updateEvent,
  updateInstitution,
  updateModality,
  updateSport,
  type AdminCatalog,
  type AdminEdition,
  type AdminEvent,
  type AdminInstitution,
  type AdminVisualItem,
} from '../lib/catalog-admin-api';
import { OesMark } from './oes-mark';

const roleLabels = { ADMIN: 'Administrador', OPERATOR: 'Operador', SUPERADMIN: 'Superadministrador' } as const;

type ResourceKind = 'edition' | 'event' | 'institution' | 'modality' | 'sport';

type VisualEditorProps = {
  readonly item: AdminVisualItem;
  readonly kind: 'modality' | 'sport';
  readonly onSaved: () => Promise<void>;
  readonly onError: (message: string) => void;
  readonly onNotice: (message: string) => void;
};

function AssetThumb({ item, fallback }: { readonly item: AdminVisualItem; readonly fallback: string }): React.JSX.Element {
  return <span className="manage-thumb">{item.iconAssetId === null ? fallback : <img alt="" src={catalogAssetUrl(item.iconAssetId)} />}</span>;
}

function VisualEditor({ item, kind, onSaved, onError, onNotice }: VisualEditorProps): React.JSX.Element {
  const [name, setName] = useState(item.name);
  const [code, setCode] = useState(item.code);
  const [active, setActive] = useState(item.active);
  const [file, setFile] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const icon = removeIcon ? null : file === null ? undefined : await iconFromFile(file);
      if (kind === 'sport') await updateSport(item.id, { active, code, icon, name });
      else await updateModality(item.id, { active, code, icon, name });
      await onSaved();
      setFile(null);
      setRemoveIcon(false);
      onNotice(`${kind === 'sport' ? 'Deporte' : 'Modalidad'} actualizado correctamente.`);
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="manage-row" onSubmit={(event) => void submit(event)}>
      <AssetThumb fallback={item.code.slice(0, 2)} item={item} />
      <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Código<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label className="manage-file">Reemplazar icono<input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /></label>
      <label className="manage-check"><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Activo</label>
      <label className="manage-check"><input checked={removeIcon} disabled={item.iconAssetId === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Quitar icono</label>
      <button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button>
    </form>
  );
}

function EventEditor({ item, onSaved, onError, onNotice }: {
  readonly item: AdminEvent;
  readonly onSaved: () => Promise<void>;
  readonly onError: (message: string) => void;
  readonly onNotice: (message: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(item.name);
  const [code, setCode] = useState(item.code);
  const [active, setActive] = useState(item.active);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true);
    try { await updateEvent(item.id, { active, code, name }); await onSaved(); onNotice('Evento actualizado correctamente.'); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible guardar el evento.'); }
    finally { setSaving(false); }
  }
  return <form className="manage-row manage-row--simple" onSubmit={(event) => void submit(event)}><span className="manage-thumb manage-thumb--plain">{item.code.slice(0, 2)}</span><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Código<input value={code} onChange={(event) => setCode(event.target.value)} /></label><label className="manage-check"><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Activo</label><button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button></form>;
}

function EditionEditor({ item, onSaved, onError, onNotice }: {
  readonly item: AdminEdition;
  readonly onSaved: () => Promise<void>;
  readonly onError: (message: string) => void;
  readonly onNotice: (message: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(item.name);
  const [year, setYear] = useState(item.year);
  const [status, setStatus] = useState<'CLOSED' | 'OPEN'>(item.status);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true);
    try { await updateEdition(item.id, { name, status, year }); await onSaved(); onNotice('Edición actualizada correctamente.'); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible guardar la edición.'); }
    finally { setSaving(false); }
  }
  return <form className="manage-row manage-row--simple" onSubmit={(event) => void submit(event)}><span className="manage-thumb manage-thumb--plain">{String(year).slice(-2)}</span><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Año<input min="2020" max="2100" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as 'CLOSED' | 'OPEN')}><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label><button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button></form>;
}

function InstitutionEditor({ item, events, onSaved, onError, onNotice }: {
  readonly item: AdminInstitution;
  readonly events: readonly AdminEvent[];
  readonly onSaved: () => Promise<void>;
  readonly onError: (message: string) => void;
  readonly onNotice: (message: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(item.name);
  const [code, setCode] = useState(item.code);
  const [eventId, setEventId] = useState(item.eventId);
  const [active, setActive] = useState(item.active);
  const [file, setFile] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true);
    try {
      const icon = removeIcon ? null : file === null ? undefined : await iconFromFile(file);
      await updateInstitution(item.id, { active, code, eventId, icon, name });
      await onSaved(); setFile(null); setRemoveIcon(false); onNotice('Institución actualizada correctamente.');
    } catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible guardar la institución.'); }
    finally { setSaving(false); }
  }
  return (
    <form className="manage-row manage-row--institution" onSubmit={(event) => void submit(event)}>
      <AssetThumb fallback={item.code.slice(0, 2)} item={item} />
      <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Código<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label>Evento<select value={eventId} onChange={(event) => setEventId(event.target.value)}>{events.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
      <label className="manage-file">Reemplazar escudo<input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /></label>
      <label className="manage-check"><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Activa</label>
      <label className="manage-check"><input checked={removeIcon} disabled={item.iconAssetId === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Quitar escudo</label>
      <button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button>
    </form>
  );
}

export function CatalogManagementClient(): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<ResourceKind>('institution');

  async function reload(): Promise<void> { setCatalog(await adminCatalog()); }

  useEffect(() => {
    let active = true;
    void Promise.all([currentActor(), adminCatalog()]).then(([current, loaded]) => {
      if (!active) return;
      if (current === null) { router.replace('/login'); return; }
      if (current.role === 'OPERATOR') { router.replace('/dashboard'); return; }
      setActor(current); setCatalog(loaded);
    }).catch((caught: unknown) => active && setError(caught instanceof Error ? caught.message : 'No fue posible recuperar los catálogos.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router]);

  const combinations = useMemo(() => catalog?.combinations ?? [], [catalog]);

  async function toggleCombination(index: number): Promise<void> {
    const item = combinations[index];
    if (item === undefined) return;
    setError(null); setNotice(null);
    try {
      await updateCombination({ active: !item.active, eventId: item.eventId, modalityId: item.modalityId, sportId: item.sportId });
      await reload(); setNotice(`Combinación ${item.active ? 'desactivada' : 'activada'} correctamente.`);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible actualizar la combinación.'); }
  }

  async function closeSession(): Promise<void> { try { await logout(); router.replace('/login'); } catch { setError('No fue posible cerrar la sesión.'); } }

  if (loading) return <main className="session-state">Cargando gestión…</main>;
  if (actor === null || catalog === null) return <main className="session-state">{error ?? 'Redirigiendo…'}</main>;

  const common = { onSaved: reload, onError: setError, onNotice: setNotice } as const;
  return (
    <div className="dashboard-shell">
      <aside className="sidebar"><OesMark /><nav aria-label="Navegación principal"><a className="nav-item" href="/dashboard">Resumen</a><span className="nav-heading">Administración</span><a className="nav-item" href="/admin/catalog">Cargar catálogos</a><a className="nav-item nav-item--active" href="/admin/catalog/manage">Gestionar catálogos</a><span className="nav-heading">Gestión competitiva</span><a className="nav-item" href="/competitions">Competencias</a></nav><div className="sidebar__footer">Sistema oficial · OES 2026</div></aside>
      <main className="dashboard-main catalog-admin">
        <header className="topbar"><div><span className="eyebrow">Administración maestra</span><h1>Gestionar catálogos</h1></div><div className="account-menu"><span className="account-avatar">{actor.displayName.charAt(0)}</span><span><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span><button className="text-button" onClick={() => void closeSession()} type="button">Salir</button></div></header>
        {error === null ? null : <p className="dashboard-error" role="alert">{error}</p>}
        {notice === null ? null : <p className="catalog-notice" role="status">{notice}</p>}
        <section className="manage-hero"><div><span className="eyebrow eyebrow--dark">Mantenimiento</span><h2>Edita identidad y disponibilidad.</h2><p>Reemplaza escudos e iconos, corrige nombres y códigos, y activa o desactiva entidades sin eliminar su historial.</p></div><a href="/admin/catalog">+ Cargar nuevo</a></section>
        <div className="manage-tabs" role="tablist">
          {(['institution', 'sport', 'modality', 'event', 'edition'] as const).map((key) => <button className={section === key ? 'manage-tab manage-tab--active' : 'manage-tab'} key={key} onClick={() => setSection(key)} type="button">{{ institution: 'Instituciones', sport: 'Deportes', modality: 'Modalidades', event: 'Eventos', edition: 'Ediciones' }[key]}</button>)}
        </div>
        <section className="manage-panel">
          {section === 'institution' && catalog.institutions.map((item) => <InstitutionEditor events={catalog.events} item={item} key={item.id} {...common} />)}
          {section === 'sport' && catalog.sports.map((item) => <VisualEditor item={item} key={item.id} kind="sport" {...common} />)}
          {section === 'modality' && catalog.modalities.map((item) => <VisualEditor item={item} key={item.id} kind="modality" {...common} />)}
          {section === 'event' && catalog.events.map((item) => <EventEditor item={item} key={item.id} {...common} />)}
          {section === 'edition' && catalog.editions.map((item) => <EditionEditor item={item} key={item.id} {...common} />)}
          {((section === 'institution' && catalog.institutions.length === 0) || (section === 'sport' && catalog.sports.length === 0) || (section === 'modality' && catalog.modalities.length === 0) || (section === 'event' && catalog.events.length === 0) || (section === 'edition' && catalog.editions.length === 0)) ? <div className="manage-empty">Todavía no hay registros en esta categoría.</div> : null}
        </section>
        <section className="manage-combinations"><header><div><span className="eyebrow eyebrow--dark">Disponibilidad</span><h3>Combinaciones</h3></div><small>{catalog.combinations.filter((item) => item.active).length} activas</small></header>{catalog.combinations.length === 0 ? <div className="manage-empty">No hay combinaciones creadas.</div> : <div className="combination-table">{catalog.combinations.map((item, index) => <div key={`${item.eventId}:${item.sportId}:${item.modalityId}`}><p><strong>{item.event.name}</strong><span>{item.sport.name} · {item.modality.name}</span></p><span className={item.active ? 'manage-status manage-status--active' : 'manage-status'}>{item.active ? 'Activa' : 'Inactiva'}</span><button onClick={() => void toggleCombination(index)} type="button">{item.active ? 'Desactivar' : 'Activar'}</button></div>)}</div>}</section>
      </main>
    </div>
  );
}
