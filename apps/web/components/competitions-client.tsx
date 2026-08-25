'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import competitionStyles from '../features/competitions/competitions.module.css';
import type { Actor } from '../lib/auth-api';
import {
  competitionCatalog,
  competitions,
  createCompetition,
  type CompetitionCatalog,
  type CompetitionSummary,
} from '../lib/competition-api';
import { ActionButton, DataList, DataRow, Notice, PageHeader, StatusBadge } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const statusLabels = { DRAFT: 'Borrador', FINALIZED: 'Finalizada', LOCKED: 'Bloqueada', OPEN: 'Abierta' } as const;
const statusTones = { DRAFT: 'default', FINALIZED: 'success', LOCKED: 'warning', OPEN: 'accent' } as const;

function combinationKey(combination: CompetitionCatalog['combinations'][number]): string { return `${combination.event.id}:${combination.sport.id}:${combination.modality.id}`; }

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
    setCatalog(loadedCatalog); setItems(loadedItems);
    setEditionId((current) => current.length > 0 ? current : (loadedCatalog.editions[0]?.id ?? ''));
    setSelectedCombination((current) => current.length > 0 ? current : (loadedCatalog.combinations[0] === undefined ? '' : combinationKey(loadedCatalog.combinations[0])));
  }

  useEffect(() => {
    let active = true;
    void Promise.all([competitionCatalog(), competitions()]).then(([loadedCatalog, loadedItems]) => {
      if (!active) return;
      setCatalog(loadedCatalog); setItems(loadedItems); setEditionId(loadedCatalog.editions[0]?.id ?? ''); setSelectedCombination(loadedCatalog.combinations[0] === undefined ? '' : combinationKey(loadedCatalog.combinations[0]));
    }).catch(() => { if (active) setError('No fue posible recuperar las competencias.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const combination = useMemo(() => catalog?.combinations.find((candidate) => combinationKey(candidate) === selectedCombination), [catalog, selectedCombination]);

  async function retry(): Promise<void> { setLoading(true); setError(null); try { await load(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible recuperar las competencias.'); } finally { setLoading(false); } }

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault(); if (combination === undefined || editionId.length === 0) return;
    setError(null); setSubmitting(true);
    try {
      const created = await createCompetition({ editionId, eventId: combination.event.id, modalityId: combination.modality.id, sportId: combination.sport.id });
      setItems((current) => [created, ...current]);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible crear la competencia.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <WorkspaceState detail="Recuperando catálogo y registro competitivo." title="Cargando competencias…" />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar este módulo." tone="error" />;

  const canCreate = actor.role !== 'OPERATOR';
  const catalogReady = catalog.editions.length > 0 && catalog.combinations.length > 0;
  const activeCount = items.filter((item) => item.status !== 'FINALIZED').length;

  return <div className={competitionStyles.workspace}>
    <PageHeader description="Organiza las unidades competitivas por edición, evento, deporte y modalidad. Desde aquí comienza todo el ciclo oficial." eyebrow="Registro competitivo" title="Cada torneo, bajo control." trailing={<div aria-label="Resumen de competencias" className={competitionStyles.metrics}><div className={competitionStyles.metric}><strong>{items.length}</strong><span>Total</span></div><div className={competitionStyles.metric}><strong>{activeCount}</strong><span>En curso</span></div></div>} />
    {error === null ? null : <Notice description={error} title="No se pudo completar la operación" tone="danger" />}
    <div className={competitionStyles.layout}>
      <section className={competitionStyles.listBlock} aria-labelledby="competition-list-title">
        <div className={competitionStyles.listHeading}><div className={competitionStyles.listHeadingCopy}><span>Workspace</span><h3 id="competition-list-title">Competencias registradas</h3></div><span className={competitionStyles.listCount}>{String(items.length).padStart(2, '0')}</span></div>
        <DataList empty={{ description: 'Crea la primera unidad competitiva para iniciar participantes, reglas, sorteo y resultados.', title: 'Aún no hay competencias.' }} isEmpty={items.length === 0} label="Competencias registradas">
          {items.map((item) => <DataRow description={`${item.edition.name} / ${item.event.name}`} href={`/competitions/${item.id}`} key={item.id} meta={`${String(item.participantCount)} participantes`} status={<StatusBadge label={statusLabels[item.status]} tone={statusTones[item.status]} />} title={`${item.sport.name} · ${item.modality.name}`} visual={item.sport.name.charAt(0)} />)}
        </DataList>
      </section>

      <aside className={competitionStyles.createPanel} aria-labelledby="create-competition-title">
        <div className={competitionStyles.createHeader}><span className={competitionStyles.createNumber}>+</span><div><span className={competitionStyles.kicker}>Nueva unidad</span><h3 id="create-competition-title">Crear competencia</h3></div></div>
        <p className={competitionStyles.createLead}>Define el contexto competitivo. Participantes, reglas y sorteo se configuran después dentro de su workspace.</p>
        {!canCreate ? <p className={competitionStyles.permissionNote}>Tu rol puede consultar el registro, pero no crear competencias.</p> : !catalogReady ? <p className={competitionStyles.permissionNote}>Primero carga una edición y habilita una combinación de evento, deporte y modalidad en Organización.</p> : <form className={competitionStyles.form} onSubmit={(event) => void submit(event)}>
          <label htmlFor="edition">Edición</label><select id="edition" onChange={(event) => setEditionId(event.target.value)} value={editionId}>{catalog.editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.name} ({edition.year})</option>)}</select>
          <label htmlFor="combination">Evento · deporte · modalidad</label><select id="combination" onChange={(event) => setSelectedCombination(event.target.value)} value={selectedCombination}>{catalog.combinations.map((candidate) => <option key={combinationKey(candidate)} value={combinationKey(candidate)}>{candidate.event.name} · {candidate.sport.name} · {candidate.modality.name}</option>)}</select>
          <div className={competitionStyles.proof}><span className={competitionStyles.proofMark}>✓</span><p><strong>Registro oficial</strong>La creación es idempotente y queda trazada en auditoría.</p></div>
          <ActionButton disabled={submitting} type="submit">{submitting ? 'Guardando…' : 'Crear competencia'}</ActionButton>
        </form>}
      </aside>
    </div>
  </div>;
}

export function CompetitionsClient(): React.JSX.Element {
  return <SessionBoundary>{(actor) => <AppShell actor={actor} active="competitions" eyebrow="Competencia" title="Competencias"><CompetitionsWorkspace actor={actor} /></AppShell>}</SessionBoundary>;
}
