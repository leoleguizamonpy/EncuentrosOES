'use client';

import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { currentActor, logout, type Actor } from '../lib/auth-api';
import {
  adminCatalog,
  catalogAssetUrl,
  createCombination,
  createEdition,
  createEvent,
  createInstitution,
  createModality,
  createSport,
  iconFromFile,
  type AdminCatalog,
  type AdminVisualItem,
} from '../lib/catalog-admin-api';
import { OesMark } from './oes-mark';

const roleLabels = { ADMIN: 'Administrador', OPERATOR: 'Operador', SUPERADMIN: 'Superadministrador' } as const;

type FormKey = 'combination' | 'edition' | 'event' | 'institution' | 'modality' | 'sport';

function CatalogGlyph({ kind }: { readonly kind: 'calendar' | 'event' | 'institution' | 'modality' | 'sport' | 'link' }): React.JSX.Element {
  const paths = {
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
    event: <><path d="M12 3l2.3 4.6 5.1.7-3.7 3.6.9 5.1-4.6-2.4L7.4 17l.9-5.1-3.7-3.6 5.1-.7L12 3z"/></>,
    institution: <><path d="M3 10h18M5 10V8l7-4 7 4v2M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16v2H4z"/></>,
    modality: <><circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="4"/><path d="M11 11l2 2"/></>,
    sport: <><circle cx="12" cy="12" r="8"/><path d="M12 4v4l3 2-1 4-4 1-3-3 1-4 4-4M4.7 14.8l4.3.2M15 10l4.3-1.5M14 14l1.8 4.4"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></>,
  } as const;
  return <svg aria-hidden="true" className="catalog-glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[kind]}</svg>;
}

function AssetPicker({ file, id, label, onChange }: {
  readonly file: File | null;
  readonly id: string;
  readonly label: string;
  readonly onChange: (file: File | null) => void;
}): React.JSX.Element {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="asset-picker">
      <div className="asset-picker__preview">
        {preview === null ? <span aria-hidden="true">+</span> : <img alt={`Vista previa de ${label}`} src={preview} />}
      </div>
      <div>
        <label htmlFor={id}>{label}</label>
        <input accept="image/png,image/jpeg,image/webp" id={id} onChange={(event) => onChange(event.target.files?.[0] ?? null)} type="file" />
        <small>PNG, JPG/JPEG o WEBP · máximo 1,5 MB</small>
      </div>
    </div>
  );
}

function VisualBadge({ item, fallback }: { readonly fallback: string; readonly item: AdminVisualItem }): React.JSX.Element {
  return (
    <span className="catalog-avatar" aria-hidden="true">
      {item.iconAssetId === null ? fallback : <img alt="" src={catalogAssetUrl(item.iconAssetId)} />}
    </span>
  );
}

export function CatalogAdminClient(): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<FormKey | null>(null);

  const [editionYear, setEditionYear] = useState(new Date().getFullYear());
  const [editionName, setEditionName] = useState('OES 2026');
  const [eventCode, setEventCode] = useState('');
  const [eventName, setEventName] = useState('');
  const [sportCode, setSportCode] = useState('');
  const [sportName, setSportName] = useState('');
  const [sportIcon, setSportIcon] = useState<File | null>(null);
  const [modalityCode, setModalityCode] = useState('');
  const [modalityName, setModalityName] = useState('');
  const [modalityIcon, setModalityIcon] = useState<File | null>(null);
  const [institutionEventId, setInstitutionEventId] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionIcon, setInstitutionIcon] = useState<File | null>(null);
  const [combinationEventId, setCombinationEventId] = useState('');
  const [combinationSportId, setCombinationSportId] = useState('');
  const [combinationModalityId, setCombinationModalityId] = useState('');

  async function reload(): Promise<void> {
    const next = await adminCatalog();
    setCatalog(next);
    setInstitutionEventId((current) => next.events.some(({ id }) => id === current) ? current : (next.events[0]?.id ?? ''));
    setCombinationEventId((current) => next.events.some(({ id }) => id === current) ? current : (next.events[0]?.id ?? ''));
    setCombinationSportId((current) => next.sports.some(({ id }) => id === current) ? current : (next.sports[0]?.id ?? ''));
    setCombinationModalityId((current) => next.modalities.some(({ id }) => id === current) ? current : (next.modalities[0]?.id ?? ''));
  }

  useEffect(() => {
    let active = true;
    void Promise.all([currentActor(), adminCatalog()])
      .then(([current, loaded]) => {
        if (!active) return;
        if (current === null) {
          router.replace('/login');
          return;
        }
        if (current.role === 'OPERATOR') {
          router.replace('/dashboard');
          return;
        }
        setActor(current);
        setCatalog(loaded);
        setInstitutionEventId(loaded.events[0]?.id ?? '');
        setCombinationEventId(loaded.events[0]?.id ?? '');
        setCombinationSportId(loaded.sports[0]?.id ?? '');
        setCombinationModalityId(loaded.modalities[0]?.id ?? '');
      })
      .catch((caught: unknown) => active && setError(caught instanceof Error ? caught.message : 'No fue posible recuperar los catálogos.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router]);

  const eventNames = useMemo(() => new Map(catalog?.events.map((event) => [event.id, event.name]) ?? []), [catalog]);

  async function run(key: FormKey, success: string, operation: () => Promise<unknown>): Promise<void> {
    setError(null);
    setNotice(null);
    setSubmitting(key);
    try {
      await operation();
      await reload();
      setNotice(success);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible completar la operación.');
    } finally {
      setSubmitting(null);
    }
  }

  async function saveEdition(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await run('edition', 'Edición creada correctamente.', () => createEdition({ name: editionName, status: 'OPEN', year: editionYear }));
  }

  async function saveEvent(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await run('event', 'Evento creado correctamente.', async () => {
      await createEvent({ code: eventCode, name: eventName });
      setEventCode(''); setEventName('');
    });
  }

  async function saveSport(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await run('sport', 'Deporte creado con su icono.', async () => {
      await createSport({ code: sportCode, icon: await iconFromFile(sportIcon), name: sportName });
      setSportCode(''); setSportName(''); setSportIcon(null);
    });
  }

  async function saveModality(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await run('modality', 'Modalidad creada correctamente.', async () => {
      await createModality({ code: modalityCode, icon: await iconFromFile(modalityIcon), name: modalityName });
      setModalityCode(''); setModalityName(''); setModalityIcon(null);
    });
  }

  async function saveInstitution(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await run('institution', 'Institución creada con su escudo.', async () => {
      await createInstitution({ code: institutionCode, eventId: institutionEventId, icon: await iconFromFile(institutionIcon), name: institutionName });
      setInstitutionCode(''); setInstitutionName(''); setInstitutionIcon(null);
    });
  }

  async function saveCombination(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await run('combination', 'Combinación habilitada correctamente.', () => createCombination({
      eventId: combinationEventId,
      modalityId: combinationModalityId,
      sportId: combinationSportId,
    }));
  }

  async function closeSession(): Promise<void> {
    try { await logout(); router.replace('/login'); }
    catch { setError('No fue posible cerrar la sesión de forma segura.'); }
  }

  if (loading) return <main className="session-state">Cargando administración…</main>;
  if (actor === null || catalog === null) return <main className="session-state">{error ?? 'Redirigiendo…'}</main>;

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <OesMark />
        <nav aria-label="Navegación principal">
          <a className="nav-item" href="/dashboard">Resumen</a>
          <span className="nav-heading">Administración</span>
          <a className="nav-item nav-item--active" href="/admin/catalog">Catálogos</a>
          <span className="nav-heading">Gestión competitiva</span>
          <a className="nav-item" href="/competitions">Competencias</a>
        </nav>
        <div className="sidebar__footer">Sistema oficial · OES 2026</div>
      </aside>
      <main className="dashboard-main catalog-admin">
        <header className="topbar">
          <div><span className="eyebrow">Administración maestra</span><h1>Catálogos OES</h1></div>
          <div className="account-menu"><span className="account-avatar">{actor.displayName.charAt(0)}</span><span><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span><button className="text-button" onClick={() => void closeSession()} type="button">Salir</button></div>
        </header>
        {error === null ? null : <p className="dashboard-error" role="alert">{error}</p>}
        {notice === null ? null : <p className="catalog-notice" role="status">{notice}</p>}

        <section className="catalog-hero">
          <div><span className="eyebrow eyebrow--dark">Base operativa</span><h2>Carga real de entidades e identidad visual.</h2><p>Crea la estructura de OES desde la interfaz. Instituciones, deportes y modalidades pueden conservar su escudo o icono propio.</p></div>
          <div className="catalog-summary"><span><strong>{catalog.institutions.length}</strong> instituciones</span><span><strong>{catalog.sports.length}</strong> deportes</span><span><strong>{catalog.combinations.length}</strong> combinaciones</span></div>
        </section>

        <div className="catalog-grid">
          <section className="catalog-card">
            <header><CatalogGlyph kind="calendar"/><div><span>Paso base</span><h3>Ediciones</h3></div></header>
            <form onSubmit={(event) => void saveEdition(event)}>
              <label>Nombre<input required value={editionName} onChange={(event) => setEditionName(event.target.value)} /></label>
              <label>Año<input min="2020" max="2100" required type="number" value={editionYear} onChange={(event) => setEditionYear(Number(event.target.value))} /></label>
              <button disabled={submitting !== null} type="submit">{submitting === 'edition' ? 'Guardando…' : 'Crear edición abierta'}</button>
            </form>
            <div className="catalog-list">{catalog.editions.map((item) => <div key={item.id}><span className="catalog-avatar catalog-avatar--plain">{String(item.year).slice(-2)}</span><p><strong>{item.name}</strong><small>{item.year} · {item.status === 'OPEN' ? 'Abierta' : 'Cerrada'}</small></p></div>)}</div>
          </section>

          <section className="catalog-card">
            <header><CatalogGlyph kind="event"/><div><span>Organización</span><h3>Eventos</h3></div></header>
            <form onSubmit={(event) => void saveEvent(event)}>
              <label>Nombre<input required value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Colegiales" /></label>
              <label>Código<input required value={eventCode} onChange={(event) => setEventCode(event.target.value)} placeholder="COL" /></label>
              <button disabled={submitting !== null} type="submit">{submitting === 'event' ? 'Guardando…' : 'Crear evento'}</button>
            </form>
            <div className="catalog-list">{catalog.events.map((item) => <div key={item.id}><span className="catalog-avatar catalog-avatar--plain">{item.code.slice(0, 2)}</span><p><strong>{item.name}</strong><small>{item.code}</small></p></div>)}</div>
          </section>

          <section className="catalog-card catalog-card--visual">
            <header><CatalogGlyph kind="sport"/><div><span>Identidad visual</span><h3>Deportes</h3></div></header>
            <form onSubmit={(event) => void saveSport(event)}>
              <label>Nombre<input required value={sportName} onChange={(event) => setSportName(event.target.value)} placeholder="Futsal" /></label>
              <label>Código<input required value={sportCode} onChange={(event) => setSportCode(event.target.value)} placeholder="FUTSAL" /></label>
              <AssetPicker file={sportIcon} id="sport-icon" label="Icono del deporte" onChange={setSportIcon} />
              <button disabled={submitting !== null} type="submit">{submitting === 'sport' ? 'Guardando…' : 'Crear deporte'}</button>
            </form>
            <div className="catalog-list">{catalog.sports.map((item) => <div key={item.id}><VisualBadge fallback={item.code.slice(0, 2)} item={item}/><p><strong>{item.name}</strong><small>{item.code} · {item.iconAssetId === null ? 'sin icono propio' : 'icono cargado'}</small></p></div>)}</div>
          </section>

          <section className="catalog-card catalog-card--visual">
            <header><CatalogGlyph kind="modality"/><div><span>Identidad visual</span><h3>Modalidades</h3></div></header>
            <form onSubmit={(event) => void saveModality(event)}>
              <label>Nombre<input required value={modalityName} onChange={(event) => setModalityName(event.target.value)} placeholder="Masculino" /></label>
              <label>Código<input required value={modalityCode} onChange={(event) => setModalityCode(event.target.value)} placeholder="MASC" /></label>
              <AssetPicker file={modalityIcon} id="modality-icon" label="Icono de la modalidad" onChange={setModalityIcon} />
              <button disabled={submitting !== null} type="submit">{submitting === 'modality' ? 'Guardando…' : 'Crear modalidad'}</button>
            </form>
            <div className="catalog-list">{catalog.modalities.map((item) => <div key={item.id}><VisualBadge fallback={item.code.slice(0, 2)} item={item}/><p><strong>{item.name}</strong><small>{item.code} · {item.iconAssetId === null ? 'sin icono propio' : 'icono cargado'}</small></p></div>)}</div>
          </section>

          <section className="catalog-card catalog-card--wide catalog-card--visual">
            <header><CatalogGlyph kind="institution"/><div><span>Escudos oficiales</span><h3>Instituciones</h3></div></header>
            {catalog.events.length === 0 ? <p className="catalog-empty">Primero crea al menos un evento.</p> : <form className="catalog-form-grid" onSubmit={(event) => void saveInstitution(event)}>
              <label>Evento<select value={institutionEventId} onChange={(event) => setInstitutionEventId(event.target.value)}>{catalog.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Nombre<input required value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} placeholder="Escuela Nacional de Comercio" /></label>
              <label>Código<input required value={institutionCode} onChange={(event) => setInstitutionCode(event.target.value)} placeholder="ENC" /></label>
              <AssetPicker file={institutionIcon} id="institution-icon" label="Escudo de la institución" onChange={setInstitutionIcon} />
              <button disabled={submitting !== null} type="submit">{submitting === 'institution' ? 'Guardando…' : 'Crear institución'}</button>
            </form>}
            <div className="catalog-list catalog-list--institutions">{catalog.institutions.map((item) => <div key={item.id}><VisualBadge fallback={item.code.slice(0, 2)} item={item}/><p><strong>{item.name}</strong><small>{eventNames.get(item.eventId) ?? 'Evento'} · {item.code} · {item.iconAssetId === null ? 'sin escudo' : 'escudo cargado'}</small></p></div>)}</div>
          </section>

          <section className="catalog-card catalog-card--wide">
            <header><CatalogGlyph kind="link"/><div><span>Habilitación competitiva</span><h3>Combinaciones</h3></div></header>
            {catalog.events.length === 0 || catalog.sports.length === 0 || catalog.modalities.length === 0 ? <p className="catalog-empty">Crea evento, deporte y modalidad antes de habilitar una combinación.</p> : <form className="combination-form" onSubmit={(event) => void saveCombination(event)}>
              <label>Evento<select value={combinationEventId} onChange={(event) => setCombinationEventId(event.target.value)}>{catalog.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Deporte<select value={combinationSportId} onChange={(event) => setCombinationSportId(event.target.value)}>{catalog.sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Modalidad<select value={combinationModalityId} onChange={(event) => setCombinationModalityId(event.target.value)}>{catalog.modalities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <button disabled={submitting !== null} type="submit">{submitting === 'combination' ? 'Guardando…' : 'Habilitar combinación'}</button>
            </form>}
            <div className="combination-list">{catalog.combinations.map((item) => <span key={`${item.eventId}:${item.sportId}:${item.modalityId}`}>{item.event.name} · {item.sport.name} · {item.modality.name}</span>)}</div>
          </section>
        </div>
      </main>
    </div>
  );
}
