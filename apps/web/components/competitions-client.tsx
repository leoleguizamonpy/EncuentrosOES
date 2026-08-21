'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  competitionCatalog,
  competitions,
  createCompetition,
  type CompetitionCatalog,
  type CompetitionSummary,
} from '../lib/competition-api';
import type { Actor } from '../lib/auth-api';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';

const statusLabels = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizada',
  LOCKED: 'Bloqueada',
  OPEN: 'Abierta',
} as const;

function combinationKey(combination: CompetitionCatalog['combinations'][number]): string {
  return `${combination.event.id}:${combination.sport.id}:${combination.modality.id}`;
}

function CompetitionsWorkspace({ actor }: { readonly actor: Actor }): React.JSX.Element {
  const [catalog, setCatalog] = useState<CompetitionCatalog | null>(null);
  const [items, setItems] = useState<readonly CompetitionSummary[]>([]);
  const [editionId, setEditionId] = useState('');
  const [selectedCombination, setSelectedCombination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load(): Promise<void> {
    const [loadedCatalog, loadedItems] = await Promise.all([competitionCatalog(), competitions()]);
    setCatalog(loadedCatalog);
    setItems(loadedItems);
    setEditionId((current) => current.length > 0 ? current : (loadedCatalog.editions[0]?.id ?? ''));
    setSelectedCombination((current) => current.length > 0
      ? current
      : (loadedCatalog.combinations[0] === undefined ? '' : combinationKey(loadedCatalog.combinations[0])));
  }

  useEffect(() => {
    let active = true;
    void Promise.all([competitionCatalog(), competitions()])
      .then(([loadedCatalog, loadedItems]) => {
        if (!active) return;
        setCatalog(loadedCatalog);
        setItems(loadedItems);
        setEditionId(loadedCatalog.editions[0]?.id ?? '');
        setSelectedCombination(loadedCatalog.combinations[0] === undefined ? '' : combinationKey(loadedCatalog.combinations[0]));
      })
      .catch(() => {
        if (active) setError('No fue posible recuperar las competencias.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const combination = useMemo(
    () => catalog?.combinations.find((candidate) => combinationKey(candidate) === selectedCombination),
    [catalog, selectedCombination],
  );

  async function retry(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible recuperar las competencias.');
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return <div className="empty-state" aria-live="polite"><strong>Cargando competencias…</strong><p>Recuperando el registro competitivo desde el servidor.</p></div>;
  }

  if (catalog === null) {
    return <div className="empty-state"><strong>No fue posible cargar este módulo.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className="signal-button" onClick={() => void retry()} type="button">Reintentar</button></div>;
  }

  const canCreate = actor.role !== 'OPERATOR';
  const catalogReady = catalog.editions.length > 0 && catalog.combinations.length > 0;

  return (
    <>
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
                <a className="competition-row" href={`/competitions/${item.id}`} key={item.id}>
                  <div className="competition-monogram" aria-hidden="true">{item.sport.name.charAt(0)}</div>
                  <div><h4>{item.sport.name} · {item.modality.name}</h4><p>{item.edition.name} / {item.event.name}</p></div>
                  <div className="competition-count"><strong>{item.participantCount}</strong><span>participantes</span></div>
                  <span className={`competition-status competition-status--${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
                </a>
              ))}
            </div>
          )}
        </section>
        <aside className="create-panel" aria-labelledby="create-competition-title">
          <span className="eyebrow">Nueva unidad</span>
          <h3 id="create-competition-title">Crear competencia</h3>
          {!canCreate ? <p className="panel-note">Tu rol puede consultar el registro, pero no crear competencias.</p> : !catalogReady ? <p className="panel-note">Primero carga una edición y habilita una combinación de evento, deporte y modalidad en la sección Organización.</p> : (
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
    </>
  );
}

export function CompetitionsClient(): React.JSX.Element {
  return (
    <SessionBoundary>
      {(actor) => <AppShell actor={actor} active="competitions" eyebrow="Competencia" title="Competencias"><CompetitionsWorkspace actor={actor} /></AppShell>}
    </SessionBoundary>
  );
}
