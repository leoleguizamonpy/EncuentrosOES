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

      <Card className={styles.headingCard ?? ''} variant="secondary">
        <Card.Content className={styles.headingContent ?? ''}>
          <div>
            <span className={styles.eyebrow}>Estado persistente</span>
            <h2>Un punto de partida para cada torneo.</h2>
            <p>Crea la unidad competitiva y retómala después con su edición, evento, deporte y modalidad intactos.</p>
          </div>
          <div className={styles.metric}><strong>{items.length}</strong><span>competencias registradas</span></div>
        </Card.Content>
      </Card>

      <div className={styles.layout}>
        <Card className={styles.listCard ?? ''} aria-labelledby="competition-list-title">
          <Card.Content className={styles.listContent ?? ''}>
            <div className={styles.sectionHeader}>
              <div><span className={styles.eyebrow}>Registro</span><h3 id="competition-list-title">Competencias guardadas</h3></div>
              <Chip color="accent" size="sm" variant="soft">{items.length}</Chip>
            </div>

            {items.length === 0 ? (
              <div className={styles.emptyContent}>
                <strong>Aún no hay competencias.</strong>
                <p>La primera aparecerá aquí y quedará disponible después de reiniciar o cambiar de dispositivo.</p>
              </div>
            ) : (
              <div className={styles.rows}>
                {items.map((item) => (
                  <a className={styles.row} href={`/competitions/${item.id}`} key={item.id}>
                    <div className={styles.monogram} aria-hidden="true">{item.sport.name.charAt(0)}</div>
                    <div className={styles.rowCopy}><h4>{item.sport.name} · {item.modality.name}</h4><p>{item.edition.name} / {item.event.name}</p></div>
                    <div className={styles.count}><strong>{item.participantCount}</strong><span>participantes</span></div>
                    <Chip color={statusColors[item.status]} size="sm" variant="soft">{statusLabels[item.status]}</Chip>
                  </a>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>

        <Card className={styles.createCard ?? ''} variant="secondary" aria-labelledby="create-competition-title">
          <Card.Content className={styles.createContent ?? ''}>
            <div><span className={styles.eyebrow}>Nueva unidad</span><h3 id="create-competition-title">Crear competencia</h3></div>
            {!canCreate ? (
              <p>Tu rol puede consultar el registro, pero no crear competencias.</p>
            ) : !catalogReady ? (
              <p>Primero carga una edición y habilita una combinación de evento, deporte y modalidad en la sección Organización.</p>
            ) : (
              <form className={styles.form} onSubmit={(event) => void submit(event)}>
                <label htmlFor="edition">Edición</label>
                <select id="edition" onChange={(event) => setEditionId(event.target.value)} value={editionId}>
                  {catalog.editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.name} ({edition.year})</option>)}
                </select>
                <label htmlFor="combination">Evento, deporte y modalidad</label>
                <select id="combination" onChange={(event) => setSelectedCombination(event.target.value)} value={selectedCombination}>
                  {catalog.combinations.map((candidate) => <option key={combinationKey(candidate)} value={combinationKey(candidate)}>{candidate.event.name} · {candidate.sport.name} · {candidate.modality.name}</option>)}
                </select>
                <div className={styles.proof}><span className={styles.proofMark}>✓</span><p><strong>Creación segura</strong>La operación es idempotente y quedará registrada en auditoría.</p></div>
                <Button className={styles.submitButton ?? ''} isDisabled={submitting} type="submit" variant="primary">{submitting ? 'Guardando…' : 'Crear competencia'}</Button>
              </form>
            )}
          </Card.Content>
        </Card>
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
