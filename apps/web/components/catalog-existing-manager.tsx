'use client';

import { type SyntheticEvent, useEffect, useState } from 'react';

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

type ResourceKind = 'edition' | 'event' | 'institution' | 'modality' | 'sport';

interface Feedback {
  readonly onError: (message: string) => void;
  readonly onNotice: (message: string) => void;
  readonly onSaved: () => Promise<void>;
}

function AssetThumb({ item, fallback }: { readonly item: AdminVisualItem; readonly fallback: string }): React.JSX.Element {
  return <span className="catalog-avatar">{item.iconAssetId === null ? fallback : <img alt="" src={catalogAssetUrl(item.iconAssetId)} />}</span>;
}

function VisualEditor({ item, kind, onSaved, onError, onNotice }: Feedback & {
  readonly item: AdminVisualItem;
  readonly kind: 'modality' | 'sport';
}): React.JSX.Element {
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
      const base = { active, code, name };
      if (kind === 'sport') {
        if (icon === undefined) await updateSport(item.id, base);
        else await updateSport(item.id, { ...base, icon });
      } else if (icon === undefined) await updateModality(item.id, base);
      else await updateModality(item.id, { ...base, icon });
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

  return <form className="catalog-edit-row" onSubmit={(event) => void submit(event)}>
    <AssetThumb fallback={item.code.slice(0, 2)} item={item} />
    <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Código<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
    <label>Nuevo icono<input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /></label>
    <label><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Activo</label>
    <label><input checked={removeIcon} disabled={item.iconAssetId === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Quitar icono</label>
    <button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button>
  </form>;
}

function EventEditor({ item, onSaved, onError, onNotice }: Feedback & { readonly item: AdminEvent }): React.JSX.Element {
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
  return <form className="catalog-edit-row catalog-edit-row--simple" onSubmit={(event) => void submit(event)}><span className="catalog-avatar catalog-avatar--plain">{item.code.slice(0, 2)}</span><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Código<input value={code} onChange={(event) => setCode(event.target.value)} /></label><label><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Activo</label><button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button></form>;
}

function EditionEditor({ item, onSaved, onError, onNotice }: Feedback & { readonly item: AdminEdition }): React.JSX.Element {
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
  return <form className="catalog-edit-row catalog-edit-row--simple" onSubmit={(event) => void submit(event)}><span className="catalog-avatar catalog-avatar--plain">{String(year).slice(-2)}</span><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Año<input min="2020" max="2100" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as 'CLOSED' | 'OPEN')}><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label><button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button></form>;
}

function InstitutionEditor({ item, events, onSaved, onError, onNotice }: Feedback & {
  readonly item: AdminInstitution;
  readonly events: readonly AdminEvent[];
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
      const base = { active, code, eventId, name };
      if (icon === undefined) await updateInstitution(item.id, base);
      else await updateInstitution(item.id, { ...base, icon });
      await onSaved(); setFile(null); setRemoveIcon(false); onNotice('Institución actualizada correctamente.');
    } catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible guardar la institución.'); }
    finally { setSaving(false); }
  }
  return <form className="catalog-edit-row" onSubmit={(event) => void submit(event)}>
    <AssetThumb fallback={item.code.slice(0, 2)} item={item} />
    <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Código<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
    <label>Evento<select value={eventId} onChange={(event) => setEventId(event.target.value)}>{events.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
    <label>Nuevo escudo<input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /></label>
    <label><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Activa</label>
    <label><input checked={removeIcon} disabled={item.iconAssetId === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Quitar escudo</label>
    <button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar'}</button>
  </form>;
}

export function CatalogExistingManager(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [section, setSection] = useState<ResourceKind>('institution');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload(): Promise<void> {
    setCatalog(await adminCatalog());
  }

  useEffect(() => { void reload().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'No fue posible recuperar los registros.')); }, []);

  if (catalog === null) return <section className="catalog-maintenance"><p>{error ?? 'Cargando registros existentes…'}</p></section>;

  const common = { onSaved: reload, onError: setError, onNotice: setNotice } as const;
  return <section className="catalog-maintenance" aria-labelledby="catalog-maintenance-title">
    <header><div><span className="eyebrow eyebrow--dark">Mantenimiento</span><h2 id="catalog-maintenance-title">Registros existentes</h2><p>Edita datos, disponibilidad y recursos visuales sin eliminar el historial.</p></div></header>
    {error === null ? null : <p className="dashboard-error" role="alert">{error}</p>}
    {notice === null ? null : <p className="catalog-notice" role="status">{notice}</p>}
    <div className="catalog-edit-tabs" role="tablist">
      {(['institution', 'sport', 'modality', 'event', 'edition'] as const).map((key) => <button aria-selected={section === key} className={section === key ? 'catalog-edit-tab catalog-edit-tab--active' : 'catalog-edit-tab'} key={key} onClick={() => setSection(key)} role="tab" type="button">{{ institution: 'Instituciones', sport: 'Deportes', modality: 'Modalidades', event: 'Eventos', edition: 'Ediciones' }[key]}</button>)}
    </div>
    <div className="catalog-edit-list">
      {section === 'institution' && catalog.institutions.map((item) => <InstitutionEditor events={catalog.events} item={item} key={item.id} {...common} />)}
      {section === 'sport' && catalog.sports.map((item) => <VisualEditor item={item} key={item.id} kind="sport" {...common} />)}
      {section === 'modality' && catalog.modalities.map((item) => <VisualEditor item={item} key={item.id} kind="modality" {...common} />)}
      {section === 'event' && catalog.events.map((item) => <EventEditor item={item} key={item.id} {...common} />)}
      {section === 'edition' && catalog.editions.map((item) => <EditionEditor item={item} key={item.id} {...common} />)}
      {((section === 'institution' && catalog.institutions.length === 0) || (section === 'sport' && catalog.sports.length === 0) || (section === 'modality' && catalog.modalities.length === 0) || (section === 'event' && catalog.events.length === 0) || (section === 'edition' && catalog.editions.length === 0)) ? <div className="catalog-empty">Todavía no hay registros en esta categoría.</div> : null}
    </div>
    <div className="catalog-combination-maintenance"><h3>Combinaciones habilitadas</h3>{catalog.combinations.length === 0 ? <p className="catalog-empty">No hay combinaciones creadas.</p> : catalog.combinations.map((item) => <div key={`${item.eventId}:${item.sportId}:${item.modalityId}`}><span>{item.event.name} · {item.sport.name} · {item.modality.name}</span><button onClick={() => void updateCombination({ active: !item.active, eventId: item.eventId, modalityId: item.modalityId, sportId: item.sportId }).then(reload).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'No fue posible actualizar la combinación.'))} type="button">{item.active ? 'Desactivar' : 'Activar'}</button></div>)}</div>
  </section>;
}
