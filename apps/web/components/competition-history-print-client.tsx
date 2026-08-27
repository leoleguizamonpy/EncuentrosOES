'use client';

import { Button, Card, Chip } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { currentActor } from '../lib/auth-api';
import { champion as championApi, type ChampionView } from '../lib/champion-api';
import { competitionHistory, type CompetitionHistoryView } from '../lib/competition-history-api';
import { competitionDetail, type CompetitionDetail } from '../lib/competition-api';
import { WorkspaceState } from './workspace-state';
import { CompetitionHistoryPanel } from './competition-history-panel';
import { OesMark } from './oes-mark';
import styles from './competition-history-print.module.css';

export function CompetitionHistoryPrintClient({ competitionId }: { readonly competitionId: string }): React.JSX.Element {
  const router = useRouter();
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [history, setHistory] = useState<CompetitionHistoryView | null>(null);
  const [champion, setChampion] = useState<ChampionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printRequested = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([currentActor(), competitionDetail(competitionId), competitionHistory(competitionId), championApi(competitionId)])
      .then(([actor, loadedDetail, loadedHistory, loadedChampion]) => {
        if (!active) return;
        if (actor === null) { router.replace('/login'); return; }
        setDetail(loadedDetail);
        setHistory(loadedHistory);
        setChampion(loadedChampion);
      })
      .catch((caught: unknown) => active && setError(caught instanceof Error ? caught.message : 'No fue posible preparar el historial para impresión.'));
    return () => { active = false; };
  }, [competitionId, router]);

  useEffect(() => {
    if (detail === null || history === null || printRequested.current) return;
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get('print') !== '1') return;
    printRequested.current = true;
    window.setTimeout(() => window.print(), 0);
  }, [detail, history]);

  if (error !== null) return <main className={styles.document}><WorkspaceState detail={error} title="No fue posible generar el historial." tone="error" /></main>;
  if (detail === null || history === null) return <main className={styles.document}><WorkspaceState detail="Recuperando etapas, tablas y resultados confirmados." title="Preparando historial…" /></main>;

  const latestVerificationCode = history.executions.map(({ publication }) => publication?.verificationCode).filter((value): value is string => typeof value === 'string').at(-1) ?? null;

  return <main className={styles.document} id="competition-history-document">
    <div className={styles.toolbar}>
      <a href={`/competitions/${competitionId}`}>← Volver a la competencia</a>
      <Button onPress={() => window.print()} size="sm" variant="secondary">Imprimir / Guardar PDF</Button>
    </div>

    <header className={styles.header}>
      <OesMark />
      <div>
        <span>Historial competitivo oficial</span>
        <h1>{detail.sport.name} / {detail.modality.name}</h1>
        <p>{detail.edition.name} · {detail.event.name}</p>
      </div>
      <Chip color={detail.status === 'FINALIZED' ? 'success' : 'default'} size="sm" variant="soft">{detail.status === 'FINALIZED' ? 'Finalizada' : 'En curso'}</Chip>
    </header>

    <section className={styles.meta} aria-label="Identificación del historial">
      <div><span>Competencia</span><code>{competitionId}</code></div>
      <div><span>Ejecuciones históricas</span><strong>{history.executions.length}</strong></div>
      <div><span>Revisión</span><strong>{detail.revision}</strong></div>
      <div><span>Última evidencia SHA-256</span><code>{latestVerificationCode ?? 'Sin publicación verificable'}</code></div>
    </section>

    {champion?.status === 'CONFIRMED' ? <Card className={styles.champion ?? ''}>
      <Card.Content>
        <span>Campeón confirmado</span>
        <strong>{champion.participantDisplayName}</strong>
        <small>Confirmado {champion.confirmedAt === null ? 'sin fecha registrada' : new Date(champion.confirmedAt).toLocaleString('es-PY')} · ronda {champion.sourceRoundNumber}</small>
      </Card.Content>
    </Card> : null}

    <CompetitionHistoryPanel history={history} showDocumentActions={false} />

    <footer className={styles.footer}>
      <span>Documento generado desde el historial persistente de EncuentrosOES.</span>
      <code>{competitionId}</code>
    </footer>
  </main>;
}
