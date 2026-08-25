'use client';

import { Alert, Button, Card, Chip, Skeleton } from '@heroui/react';
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
import styles from './competitions-client.module.css';
import { SessionBoundary } from './session-boundary';

const statusLabels = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizada',
  LOCKED: 'Bloqueada',
  OPEN: 'Abierta',
} as const;

const statusColors = {
  DRAFT: 'default',
  FINALIZED: 'success',
  LOCKED: 'warning',
  OPEN: 'accent',
} as const;

function combinationKey(combination: CompetitionCatalog['combinations'][number]): string {
  return `${combination.event.id}:${combination.sport.id}:${combination.modality.id}`;
}

function LoadingState(): React.JSX.Element {
  return (
    <Card className={styles.loadingCard ?? ''}>
      <Card.Content className={styles.loadingContent ?? ''} aria-live="polite">
        <Skeleton className={`${styles.skeletonLine ?? ''} w-1/3`} />
        <Skeleton className={`${styles.skeletonLine ?? ''} w-2/3`} />
        <Skeleton className={styles.skeletonCard ?? ''} />
        <Skeleton className={styles.skeletonCard ?? ''} />
      </Card.Content>
    </Card>
  );
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

  if (loading) return <div className={styles.workspace}><LoadingState /></div>;

  if (catalog === null) {
    return (
      <div className={styles.workspace}>
        <Card className={styles.emptyCard ?? ''}>
          <Card.Content className={styles.emptyContent ?? ''}>
            <strong>No fue posible cargar este módulo.</strong>
            <p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p>
            <Button onPress={() => void retry()} variant="primary">Reintentar</Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  const canCreate = actor.role !== 'OPERATOR';
  const catalogReady = catalog.editions.length > 0 && catalog.combinations.length > 0;
  const activeCount = items.filter((item) => item.status !== 'FINALIZED').length;

  return (
    <div className={styles.workspace}>
      {error === null ? null : (
        <Alert className={styles.alert ?? ''} status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No se pudo completar la operación</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <section className={styles.pageIntro} aria-labelledby="competitions-heading">
        <div className={styles.introCopy}>
          <span className={styles.eyebrow}>Registro competitivo</span>
          <h2 id="competitions-heading">Cada torneo, bajo control.</h2>
          <p>Organiza las unidades competitivas por edición, evento, deporte y modalidad. Desde aquí comienza todo el ciclo oficial.</p>
        </div>
        <div className={styles.metrics} aria-label="Resumen de competencias">
          <div className={styles.metric}><strong>{items.length}</strong><span>Total</span></div>
          <div className={styles.metric}><strong>{activeCount}</strong><span>En curso</span></div>
        </div>
      </section>

      <div className={styles.layout}>
        <section className={styles.listPanel} aria-labelledby="competition-list-title">
          <div className={styles.sectionHeader}>
            <div><span className={styles.eyebrow}>Workspace</span><h3 id="competition-list-title">Competencias registradas</h3></div>
            <span className={styles.sectionCount}>{String(items.length).padStart(2, '0')}</span>
          </div>

          {items.length === 0 ? (
            <div className={styles.emptyContent}>
              <span className={styles.emptyIndex}>00</span>
              <strong>Aún no hay competencias.</strong>
              <p>Crea la primera unidad competitiva para iniciar participantes, reglas, sorteo y resultados.</p>
            </div>
          ) : (
            <div className={styles.rows}>
              {items.map((item, index) => (
                <a className={styles.row} href={`/competitions/${item.id}`} key={item.id}>
                  <span className={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <div className={styles.monogram} aria-hidden="true">{item.sport.name.charAt(0)}</div>
                  <div className={styles.rowCopy}>
                    <h4>{item.sport.name} <span>·</span> {item.modality.name}</h4>
                    <p>{item.edition.name} <span>/</span> {item.event.name}</p>
                  </div>
                  <div className={styles.count}><strong>{item.participantCount}</strong><span>participantes</span></div>
                  <Chip color={statusColors[item.status]} size="sm" variant="soft">{statusLabels[item.status]}</Chip>
                  <span className={styles.rowArrow} aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          )}
        </section>

        <aside className={styles.createPanel} aria-labelledby="create-competition-title">
          <div className={styles.createHeader}>
            <span className={styles.createNumber}>+</span>
            <div><span className={styles.eyebrow}>Nueva unidad</span><h3 id="create-competition-title">Crear competencia</h3></div>
          </div>
          <p className={styles.createLead}>Define el contexto competitivo. Participantes, reglas y sorteo se configuran después dentro de su workspace.</p>
          {!canCreate ? (
            <p className={styles.permissionNote}>Tu rol puede consultar el registro, pero no crear competencias.</p>
          ) : !catalogReady ? (
            <p className={styles.permissionNote}>Primero carga una edición y habilita una combinación de evento, deporte y modalidad en Organización.</p>
          ) : (
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <label htmlFor="edition">Edición</label>
              <select id="edition" onChange={(event) => setEditionId(event.target.value)} value={editionId}>
                {catalog.editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.name} ({edition.year})</option>)}
              </select>
              <label htmlFor="combination">Evento · deporte · modalidad</label>
              <select id="combination" onChange={(event) => setSelectedCombination(event.target.value)} value={selectedCombination}>
                {catalog.combinations.map((candidate) => <option key={combinationKey(candidate)} value={combinationKey(candidate)}>{candidate.event.name} · {candidate.sport.name} · {candidate.modality.name}</option>)}
              </select>
              <div className={styles.proof}><span className={styles.proofMark}>✓</span><p><strong>Registro oficial</strong>La creación es idempotente y queda trazada en auditoría.</p></div>
              <Button className={styles.submitButton ?? ''} isDisabled={submitting} type="submit" variant="primary">{submitting ? 'Guardando…' : 'Crear competencia'}</Button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

export function CompetitionsClient(): React.JSX.Element {
  return (
    <SessionBoundary>
      {(actor) => <AppShell actor={actor} active="competitions" eyebrow="Competencia" title="Competencias"><CompetitionsWorkspace actor={actor} /></AppShell>}
    </SessionBoundary>
  );
}
