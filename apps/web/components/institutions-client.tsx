'use client';

import { Alert, Button, Card, Chip, Input } from '@heroui/react';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  adminCatalog,
  catalogAssetUrl,
  createInstitution,
  iconFromFile,
  updateInstitution,
  type AdminCatalog,
  type AdminInstitution,
} from '../lib/catalog-admin-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type StatusFilter = 'ACTIVE' | 'ALL' | 'INACTIVE';

interface InstitutionDrawerProps {
  readonly catalog: AdminCatalog;
  readonly institution: AdminInstitution | null;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => Promise<void>;
}

function InstitutionDrawer({ catalog, institution, onClose, onSaved }: InstitutionDrawerProps): React.JSX.Element {
  const [eventId, setEventId] = useState(institution?.eventId ?? catalog.events[0]?.id ?? '');
  const [name, setName] = useState(institution?.name ?? ''); const [code, setCode] = useState(institution?.code ?? ''); const [active, setActive] = useState(institution?.active ?? true);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [removeIcon, setRemoveIcon] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (file === null) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const currentAsset = institution?.iconAssetId ?? null; const visibleAsset = preview ?? (removeIcon || currentAsset === null ? null : catalogAssetUrl(currentAsset));

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      if (eventId.length === 0) throw new Error('Selecciona un evento.');
      if (institution === null) { await createInstitution({ code, eventId, icon: await iconFromFile(file), name }); await onSaved('Institución creada correctamente.'); }
      else { const base = { active, code, eventId, name }; if (removeIcon) await updateInstitution(institution.id, { ...base, icon: null }); else if (file === null) await updateInstitution(institution.id, base); else await updateInstitution(institution.id, { ...base, icon: await iconFromFile(file) }); await onSaved('Institución actualizada correctamente.'); }
      onClose();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar la institución.'); }
    finally { setSaving(false); }
  }

  return <><button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" /><aside aria-labelledby="institution-drawer-title" className={styles.drawer} role="dialog" aria-modal="true"><div className={styles.drawerHeader}><div><span className="eyebrow eyebrow--dark">Organización</span><h3 id="institution-drawer-title">{institution === null ? 'Nueva institución' : 'Editar institución'}</h3></div><Button aria-label="Cerrar" isIconOnly onPress={onClose} variant="ghost">×</Button></div>{error === null ? null : <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}<form className={styles.form} onSubmit={(event) => void submit(event)}><label>Evento *<select required value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">Seleccionar evento</option>{catalog.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Nombre *<Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Escuela Nacional de Comercio" variant="secondary" /></label><label>Código *<Input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="ENC" variant="secondary" /></label><div><span className="eyebrow eyebrow--dark">Identidad visual</span><div className={styles.assetBox}><div className={styles.assetPreview}>{visibleAsset === null ? <span aria-hidden="true">+</span> : <img alt="Vista previa del escudo" src={visibleAsset} />}</div><div className={styles.assetMeta}><strong>Escudo de la institución</strong><input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveIcon(false); }} /><small>PNG, JPG/JPEG o WEBP · máximo 1,5 MB.</small></div></div></div>{institution === null ? null : <label className={styles.checkRow}><input checked={removeIcon} disabled={currentAsset === null} type="checkbox" onChange={(event) => { setRemoveIcon(event.target.checked); if (event.target.checked) setFile(null); }} /> Retirar escudo actual</label>}{institution === null ? null : <label className={styles.checkRow}><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> Institución activa</label>}<div className={styles.actions}><Button onPress={onClose} type="button" variant="secondary">Cancelar</Button><Button isDisabled={saving} type="submit" variant="primary">{saving ? 'Guardando…' : 'Guardar institución'}</Button></div></form></aside></>;
}

function InstitutionsWorkspace(): React.JSX.Element {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [query, setQuery] = useState(''); const [eventFilter, setEventFilter] = useState('ALL'); const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL'); const [drawerOpen, setDrawerOpen] = useState(false); const [editing, setEditing] = useState<AdminInstitution | null>(null);
  async function reload(): Promise<void> { setCatalog(await adminCatalog()); }
  useEffect(() => { let active = true; void adminCatalog().then((loaded) => { if (active) setCatalog(loaded); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'No fue posible cargar las instituciones.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const eventNames = useMemo(() => new Map(catalog?.events.map((item) => [item.id, item.name]) ?? []), [catalog]);
  const filtered = useMemo(() => { if (catalog === null) return []; const normalized = query.trim().toLocaleLowerCase('es-PY'); return catalog.institutions.filter((item) => { const matchesText = normalized.length === 0 || item.name.toLocaleLowerCase('es-PY').includes(normalized) || item.code.toLocaleLowerCase('es-PY').includes(normalized); const matchesEvent = eventFilter === 'ALL' || item.eventId === eventFilter; const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active); return matchesText && matchesEvent && matchesStatus; }); }, [catalog, eventFilter, query, statusFilter]);
  function startCreate(): void { setEditing(null); setDrawerOpen(true); setError(null); setNotice(null); } function startEdit(item: AdminInstitution): void { setEditing(item); setDrawerOpen(true); setError(null); setNotice(null); } async function saved(message: string): Promise<void> { await reload(); setNotice(message); setError(null); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setCatalog(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }
  if (loading) return <WorkspaceState detail="Recuperando la organización desde el servidor." title="Cargando instituciones…" />; if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;
  return <div className={styles.workspace}><section className={styles.heading}><div><span className="eyebrow eyebrow--dark">Organización</span><h2>Instituciones</h2><p>Administra las instituciones habilitadas para participar en OES y conserva su escudo como identidad visual propia.</p></div><Button isDisabled={catalog.events.length === 0} onPress={startCreate} variant="primary">+ Nueva institución</Button></section>{catalog.events.length === 0 ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Antes de crear una institución debes crear al menos un evento.</Alert.Description></Alert.Content></Alert> : null}{error === null ? null : <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}{notice === null ? null : <Alert status="success" role="status"><Alert.Indicator /><Alert.Content><Alert.Description>{notice}</Alert.Description></Alert.Content></Alert>}<section className={styles.toolbar} aria-label="Filtros de instituciones"><Input aria-label="Buscar institución" placeholder="Buscar por nombre o código…" value={query} onChange={(event) => setQuery(event.target.value)} variant="secondary" /><select aria-label="Filtrar por evento" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}><option value="ALL">Todos los eventos</option>{catalog.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Inactivas</option></select><span className={styles.counter}>{filtered.length} de {catalog.institutions.length}</span></section><Card className={styles.tableCard ?? ''} aria-label="Listado de instituciones"><Card.Content style={{ padding: 0 }}><div className={styles.tableHeader}><span>Escudo</span><span>Institución</span><span>Evento</span><span>Estado</span><span aria-hidden="true" /></div>{filtered.length === 0 ? <div className={styles.empty}><strong>{catalog.institutions.length === 0 ? 'No hay instituciones todavía.' : 'No encontramos resultados.'}</strong><p>{catalog.institutions.length === 0 ? 'Carga las instituciones que podrán participar en los eventos OES.' : 'Ajusta la búsqueda o los filtros para ver otras instituciones.'}</p>{catalog.institutions.length === 0 && catalog.events.length > 0 ? <Button onPress={startCreate} variant="primary">+ Nueva institución</Button> : null}</div> : filtered.map((item) => <article aria-label={`Editar ${item.name}`} className={styles.row} key={item.id} onClick={() => startEdit(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); startEdit(item); } }} role="button" tabIndex={0}><span className={styles.logo}>{item.iconAssetId === null ? item.code.slice(0, 2) : <img alt={`Escudo de ${item.name}`} src={catalogAssetUrl(item.iconAssetId)} />}</span><div className={styles.identity}><strong>{item.name}</strong><small>{item.code}</small></div><span className={styles.eventName}>{eventNames.get(item.eventId) ?? 'Evento no disponible'}</span><Chip color={item.active ? 'success' : 'default'} size="sm" variant="soft">{item.active ? 'Activa' : 'Inactiva'}</Chip><span aria-hidden="true" className={styles.rowArrow}>→</span></article>)}</Card.Content></Card>{drawerOpen ? <InstitutionDrawer catalog={catalog} institution={editing} onClose={() => setDrawerOpen(false)} onSaved={saved} /> : null}</div>;
}

export function InstitutionsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={ADMIN_ROLES}>{(actor) => <AppShell actor={actor} active="institutions" title="Instituciones"><InstitutionsWorkspace /></AppShell>}</SessionBoundary>; }
