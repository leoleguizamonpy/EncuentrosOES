'use client';

import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { currentActor, logout, type Actor } from '../lib/auth-api';
import {
  competitionCatalog,
  competitions,
  createCompetition,
  type CompetitionCatalog,
  type CompetitionSummary,
} from '../lib/competition-api';
import { OesMark } from './oes-mark';

const statusLabels = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizada',
  LOCKED: 'Bloqueada',
  OPEN: 'Abierta',
} as const;

const roleLabels = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  SUPERADMIN: 'Superadministrador',
} as const;

function combinationKey(combination: CompetitionCatalog['combinations'][number]): string {
  return `${combination.event.id}:${combination.sport.id}:${combination.modality.id}`;
}

export function CompetitionsClient(): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [catalog, setCatalog] = useState<CompetitionCatalog | null>(null);
  const [items, setItems] = useState<readonly CompetitionSummary[]>([]);
  const [editionId, setEditionId] = useState('');
  const [selectedCombination, setSelectedCombination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([currentActor(), competitionCatalog(), competitions()])
      .then(([current, loadedCatalog, loadedItems]) => {
        if (!active) return;
        if (current === null) {
          router.replace('/login');
          return;
        }
        setActor(current);
        setCatalog(loadedCatalog);
        setItems(loadedItems);
        setEditionId(loadedCatalog.editions[0]?.id ?? '');
        setSelectedCombination(loadedCatalog.combinations[0] === undefined ? '' : combinationKey(loadedCatalog.combinations[0]));
      })
      .catch(() => active && setError('No fue posible recuperar las competencias.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router]);

  const combination = useMemo(
    () => catalog?.combinations.find((candidate) => combinationKey(candidate) === selectedCombination),
    [catalog, selectedCombination],
  );

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault();
    if (combination === undefined || editionId.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await createCompetition({
        editionId,
        eventId: combination.event.id,
        modalityId: combination.modality.id,
        sportId: combination.sport.id,
      });
      setItems((current) => [created, ...current]);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear la competencia.');
    } finally {
      setSubmitting(false);
    }
  }

  async function closeSession(): Promise<void> {
    try {
      await logout();
      router.replace('/login');
    } catch {
      setError('No fue posible cerrar la sesión de forma segura.');
    }
  }

  if (loading) return <main className="session-state" aria-live="polite">Recuperando competencias…</main>;
  if (actor === null || catalog === null) return <main className="session-state">{error ?? 'Redirigiendo…'}</main>;

  const canCreate = actor.role !== 'OPERATOR';
  const catalogReady = catalog.editions.length > 0 && catalog.combinations.length > 0;

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <OesMark />
        <nav aria-label="Navegación principal">
          <a className="nav-item" href="/dashboard">Resumen</a>
          <span className="nav-heading">Gestión competitiva</span>
          <a className="nav-item nav-item--active" href="/competitions">Competencias</a>
          <span className="nav-item nav-item--disabled">Sorteos <small>Próximo</small></span>
          <span className="nav-item nav-item--disabled">Resultados <small>Próximo</small></span>
        </nav>
        <div className="sidebar__footer">Sistema oficial · OES 2026</div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div><span className="eyebrow">Gestión competitiva</span><h1>Competencias</h1></div>
          <div className="account-menu">
            <span className="account-avatar" aria-hidden="true">{actor.displayName.charAt(0)}</span>
            <span><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span>
            <button className="text-button" onClick={() => void closeSession()} type="button">Salir</button>
          </div>
        </header>
        {error === null ? null : <p className="dashboard-error" role="alert">{error}</p>}
        <section className="competition-heading">
          <div>
            <span className="eyebrow eyebrow--dark">Estado persistente</span>
            <h2>Un punto de partida para cada torneo.</h2>
            <p>Crea la unidad competitiva y retómala después con su edición, evento, deporte y modalidad intactos.</p>
          </div>
          <div className="metric-card"><strong>{items.length}</strong><span>competencias registradas</span></div>
        </section>
        <div className="competition-layout">
          <section className="competition-list" aria-labelledby="competition-list-title">
            <div className="section-title"><div><span className="eyebrow eyebrow--dark">Registro</span><h3 id="competition-list-title">Competencias guardadas</h3></div><span>{items.length}</span></div>
            {items.length === 0 ? (
              <div className="empty-state"><strong>Aún no hay competencias.</strong><p>La primera aparecerá aquí y quedará disponible después de reiniciar o cambiar de dispositivo.</p></div>
            ) : (
              <div className="competition-rows">
                {items.map((item) => (
                  <article className="competition-row" key={item.id}>
                    <div className="competition-monogram" aria-hidden="true">{item.sport.name.charAt(0)}</div>
                    <div><h4>{item.sport.name} · {item.modality.name}</h4><p>{item.edition.name} / {item.event.name}</p></div>
                    <div className="competition-count"><strong>{item.participantCount}</strong><span>participantes</span></div>
                    <span className={`competition-status competition-status--${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
          <aside className="create-panel" aria-labelledby="create-competition-title">
            <span className="eyebrow">Nueva unidad</span>
            <h3 id="create-competition-title">Crear competencia</h3>
            {!canCreate ? <p className="panel-note">Tu rol puede consultar el registro, pero no crear competencias.</p> : !catalogReady ? <p className="panel-note">Debes contar con una edición abierta y al menos una combinación activa en el catálogo.</p> : (
              <form className="competition-form" onSubmit={(event) => void submit(event)}>
                <label htmlFor="edition">Edición</label>
                <select id="edition" onChange={(event) => setEditionId(event.target.value)} value={editionId}>
                  {catalog.editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.name} ({edition.year})</option>)}
                </select>
                <label htmlFor="combination">Evento, deporte y modalidad</label>
                <select id="combination" onChange={(event) => setSelectedCombination(event.target.value)} value={selectedCombination}>
                  {catalog.combinations.map((candidate) => <option key={combinationKey(candidate)} value={combinationKey(candidate)}>{candidate.event.name} · {candidate.sport.name} · {candidate.modality.name}</option>)}
                </select>
                <div className="creation-proof"><span>✓</span><p><strong>Creación segura</strong>La operación es idempotente y quedará registrada en auditoría.</p></div>
                <button className="signal-button" disabled={submitting} type="submit">{submitting ? 'Guardando…' : 'Crear competencia'}</button>
              </form>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
