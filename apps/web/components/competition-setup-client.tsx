'use client';

import { Alert, Button, Card, Chip } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { currentActor, type Actor } from '../lib/auth-api';
import { champion as championApi, type ChampionView } from '../lib/champion-api';
import { competitionHistory, type CompetitionHistoryView } from '../lib/competition-history-api';
import {
  addCompetitionParticipant,
  competitionDetail,
  configureCompetitionFormat,
  drawWorkspace,
  resultsWorkspace,
  type CompetitionDetail,
  type DrawWorkspace,
  type ResultsWorkspace,
} from '../lib/competition-api';
import { AppShell } from './app-shell';
import { ChampionPanel } from './champion-panel';
import { CompetitionHistoryPanel } from './competition-history-panel';
import { CompetitionRulesPanel } from './competition-rules-panel';
import styles from './competition-setup.module.css';
import { NextRoundPanel } from './next-round-panel';
import { OfficialDrawPanel } from './official-draw-panel';
import { ResultsWorkspacePanel } from './results-workspace-panel';
import { WorkspaceState } from './workspace-state';

const statusLabels = { DRAFT: 'Borrador', FINALIZED: 'Finalizada', LOCKED: 'Bloqueada', OPEN: 'Abierta' } as const;

function groupPreview(participantCount: number, groupCount: number): string {
  const base = Math.floor(participantCount / groupCount);
  const extras = participantCount % groupCount;
  return Array.from({ length: groupCount }, (_, index) => `${String.fromCharCode(65 + index)}: ${String(base + (index < extras ? 1 : 0))}`).join(' · ');
}

function statusColor(status: CompetitionDetail['status']): 'accent' | 'default' | 'success' | 'warning' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'LOCKED') return 'accent';
  if (status === 'OPEN') return 'warning';
  return 'default';
}

export function CompetitionSetupClient({ competitionId }: { readonly competitionId: string }): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [draw, setDraw] = useState<DrawWorkspace | null>(null);
  const [results, setResults] = useState<ResultsWorkspace | null>(null);
  const [history, setHistory] = useState<CompetitionHistoryView | null>(null);
  const [champion, setChampion] = useState<ChampionView | null>(null);
  const [institutionId, setInstitutionId] = useState('');
  const [formatCode, setFormatCode] = useState<'GROUP_STAGE' | 'KNOCKOUT'>('GROUP_STAGE');
  const [groupCount, setGroupCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'format' | 'participant' | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([currentActor(), competitionDetail(competitionId), drawWorkspace(competitionId), resultsWorkspace(competitionId), competitionHistory(competitionId), championApi(competitionId)])
      .then(([current, loaded, loadedDraw, loadedResults, loadedHistory, loadedChampion]) => {
        if (!active) return;
        if (current === null) { router.replace('/login'); return; }
        setActor(current); setDetail(loaded); setDraw(loadedDraw); setResults(loadedResults); setHistory(loadedHistory); setChampion(loadedChampion);
        setFormatCode(loaded.formatCode ?? 'GROUP_STAGE');
        setGroupCount(loaded.groupCount ?? loaded.validGroupCounts[0] ?? 0);
      })
      .catch((caught: unknown) => active && setError(caught instanceof Error ? caught.message : 'No fue posible recuperar la competencia.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [competitionId, router]);

  const availableInstitutions = useMemo(() => detail?.institutions.filter(({ selected }) => !selected) ?? [], [detail]);
  useEffect(() => { setInstitutionId((current) => availableInstitutions.some(({ id }) => id === current) ? current : (availableInstitutions[0]?.id ?? '')); }, [availableInstitutions]);

  async function addParticipant(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault(); if (detail === null || institutionId.length === 0) return; setError(null); setSubmitting('participant');
    try { const updated = await addCompetitionParticipant(detail.id, institutionId, detail.revision); setDetail(updated); setFormatCode('GROUP_STAGE'); setGroupCount(updated.validGroupCounts[0] ?? 0); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible agregar el participante.'); }
    finally { setSubmitting(null); }
  }

  async function saveFormat(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault(); if (detail === null) return; setError(null); setSubmitting('format');
    try { const input = formatCode === 'GROUP_STAGE' ? { expectedRevision: detail.revision, formatCode, groupCount } : { expectedRevision: detail.revision, formatCode, groupCount: null }; setDetail(await configureCompetitionFormat(detail.id, input)); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el formato.'); }
    finally { setSubmitting(null); }
  }

  if (loading) return <main id="main-content"><WorkspaceState detail="Recuperando configuración, sorteo, resultados e historial." title="Recuperando competencia…" /></main>;
  if (actor === null || detail === null || draw === null || results === null || history === null) return <main id="main-content"><WorkspaceState detail={error ?? 'Redirigiendo…'} title="No fue posible abrir la competencia." tone="error" /></main>;

  const canEdit = actor.role !== 'OPERATOR' && (detail.status === 'DRAFT' || detail.status === 'OPEN');
  const canSelfConfirm = actor.role === 'SUPERADMIN';
  const groupsAvailable = detail.validGroupCounts.length > 0;
  const knockoutAvailable = detail.participantCount >= 2;

  function refreshHistory(): void { void competitionHistory(competitionId).then(setHistory).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'No fue posible actualizar el historial competitivo.')); }
  function updateDraw(workspace: DrawWorkspace): void { setDraw(workspace); setDetail((current) => current === null ? current : { ...current, revision: workspace.competitionRevision, status: workspace.competitionStatus }); void resultsWorkspace(competitionId).then(setResults).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'No fue posible recuperar los encuentros.')); refreshHistory(); }
  function updateResults(workspace: ResultsWorkspace): void { setResults(workspace); refreshHistory(); }
  function updateChampion(next: ChampionView): void {
    setChampion(next);
    setDetail((current) => current === null ? current : { ...current, revision: next.competitionRevision, status: next.status === 'CONFIRMED' ? 'FINALIZED' : current.status });
    setDraw((current) => current === null ? current : { ...current, competitionRevision: next.competitionRevision, competitionStatus: next.status === 'CONFIRMED' ? 'FINALIZED' : current.competitionStatus });
    refreshHistory();
  }

  return <AppShell actor={actor} active="competitions" eyebrow="Centro de competición" title={`${detail.sport.name} · ${detail.modality.name}`}>
    <div className={`${styles.workspace ?? ''} ${styles.scope ?? ''}`}>
      {error === null ? null : <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Title>La operación no pudo completarse</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}

      <section className={styles.hero} aria-labelledby="competition-workspace-heading">
        <div className={styles.heroTop}>
          <a className={styles.backLink} href="/competitions">← Competencias</a>
          <Chip color={statusColor(detail.status)} size="sm" variant="soft">{statusLabels[detail.status]}</Chip>
        </div>
        <div className={styles.heroMain}>
          <div>
            <span className={styles.kicker}>{detail.edition.name} · {detail.event.name}</span>
            <h2 id="competition-workspace-heading">{detail.sport.name} <span>/ {detail.modality.name}</span></h2>
            <p className={styles.heroMeta}>{detail.participantCount} participantes · {detail.formatCode === null ? 'formato pendiente' : detail.formatCode === 'GROUP_STAGE' ? `${String(detail.groupCount)} grupo(s)` : 'eliminación directa'}</p>
          </div>
          <div className={styles.stateBlock}><small>Revisión</small><strong>{String(detail.revision).padStart(2, '0')}</strong></div>
        </div>
        <div className={styles.progressRail} aria-label="Flujo competitivo">
          <div className={styles.progressItem}><span>01</span><strong>Participantes</strong></div>
          <div className={styles.progressItem}><span>02</span><strong>Reglas</strong></div>
          <div className={styles.progressItem}><span>03</span><strong>Sorteo</strong></div>
          <div className={styles.progressItem}><span>04</span><strong>Resultados</strong></div>
          <div className={styles.progressItem}><span>05</span><strong>Campeón</strong></div>
        </div>
      </section>

      <div className={styles.grid}>
        <Card className="setup-card" aria-labelledby="participants-title"><Card.Content>
          <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 1</span><h3 id="participants-title">Participantes</h3></div><Chip size="sm" variant="soft">{detail.participantCount}</Chip></div>
          {detail.participants.length === 0 ? <div className="setup-empty">Agrega las instituciones que competirán.</div> : <ol className="participant-list">{detail.participants.map((participant, index) => <li key={participant.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{participant.displayName}</strong><Chip color={participant.status === 'ENABLED' ? 'success' : 'default'} size="sm" variant="soft">{participant.status === 'ENABLED' ? 'Habilitado' : 'Retirado'}</Chip></li>)}</ol>}
          {!canEdit ? <p className="readonly-note">Tu rol permite consultar esta configuración, pero no modificarla.</p> : availableInstitutions.length === 0 ? <p className="readonly-note">No quedan instituciones activas disponibles para este evento.</p> : <form className="inline-setup-form" onSubmit={(event) => void addParticipant(event)}><label htmlFor="institution">Institución</label><div><select id="institution" onChange={(event) => setInstitutionId(event.target.value)} value={institutionId}>{availableInstitutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name} ({institution.code})</option>)}</select><Button isDisabled={submitting !== null} type="submit" variant="secondary">{submitting === 'participant' ? 'Agregando…' : 'Agregar'}</Button></div></form>}
        </Card.Content></Card>

        <Card className="setup-card" aria-labelledby="format-title"><Card.Content>
          <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 2</span><h3 id="format-title">Formato competitivo</h3></div><Chip size="sm" variant="soft">02</Chip></div>
          <form className="format-form" onSubmit={(event) => void saveFormat(event)}>
            <label className={`format-option${formatCode === 'GROUP_STAGE' ? ' format-option--selected' : ''}${groupsAvailable ? '' : ' format-option--disabled'}`}><input checked={formatCode === 'GROUP_STAGE'} disabled={!canEdit || !groupsAvailable} name="format" onChange={() => setFormatCode('GROUP_STAGE')} type="radio" /><span><strong>Fase de grupos</strong><small>Todos contra todos; grupos de 3 a 4 participantes.</small></span></label>
            {formatCode === 'GROUP_STAGE' && groupsAvailable ? <div className="group-selector"><label htmlFor="group-count">Cantidad de grupos</label><select disabled={!canEdit} id="group-count" onChange={(event) => setGroupCount(Number(event.target.value))} value={groupCount}>{detail.validGroupCounts.map((count) => <option key={count} value={count}>{count} {count === 1 ? 'grupo' : 'grupos'}</option>)}</select><p>{groupPreview(detail.participantCount, groupCount)}</p></div> : null}
            <label className={`format-option${formatCode === 'KNOCKOUT' ? ' format-option--selected' : ''}${knockoutAvailable ? '' : ' format-option--disabled'}`}><input checked={formatCode === 'KNOCKOUT'} disabled={!canEdit || !knockoutAvailable} name="format" onChange={() => setFormatCode('KNOCKOUT')} type="radio" /><span><strong>Eliminación directa</strong><small>Cruces aleatorios sin bombos; pases libres con historial.</small></span></label>
            {canEdit ? <Button isDisabled={submitting !== null || (formatCode === 'GROUP_STAGE' ? !groupsAvailable : !knockoutAvailable)} type="submit" variant="primary">{submitting === 'format' ? 'Guardando…' : 'Guardar formato'}</Button> : null}
            {detail.formatCode === null ? <p className="format-proof">Aún no hay un formato guardado.</p> : <Alert status="success"><Alert.Indicator /><Alert.Content><Alert.Description>Formato guardado: {detail.formatCode === 'GROUP_STAGE' ? `${String(detail.groupCount)} grupo(s)` : 'eliminación directa'}.</Alert.Description></Alert.Content></Alert>}
          </form>
        </Card.Content></Card>

        <CompetitionRulesPanel canEdit={canEdit} detail={detail} onChange={setDetail} onError={setError} />
        <OfficialDrawPanel actorId={actor.id} canAnnul={actor.role === 'SUPERADMIN'} canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} canSelfConfirm={canSelfConfirm} detail={detail} onChange={updateDraw} onError={setError} workspace={draw} />
        <ResultsWorkspacePanel actorId={actor.id} canAnnul={actor.role === 'SUPERADMIN' && detail.status !== 'FINALIZED'} canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} canSelfConfirm={canSelfConfirm} onChange={updateResults} onError={setError} workspace={results} />
        <NextRoundPanel canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} competitionId={competitionId} draw={draw} onChange={updateDraw} onError={setError} results={results} />
        <ChampionPanel actorId={actor.id} canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} canSelfConfirm={canSelfConfirm} champion={champion} competitionId={competitionId} draw={draw} onChange={updateChampion} onError={setError} results={results} />
        <CompetitionHistoryPanel history={history} />
      </div>
    </div>
  </AppShell>;
}
