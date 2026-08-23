'use client';

import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { currentActor, logout, type Actor } from '../lib/auth-api';
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
import { ChampionPanel } from './champion-panel';
import { CompetitionHistoryPanel } from './competition-history-panel';
import { CompetitionRulesPanel } from './competition-rules-panel';
import { NextRoundPanel } from './next-round-panel';
import { OesMark } from './oes-mark';
import { OfficialDrawPanel } from './official-draw-panel';
import { ResultsWorkspacePanel } from './results-workspace-panel';

const roleLabels = { ADMIN: 'Administrador', OPERATOR: 'Operador', SUPERADMIN: 'Superadministrador' } as const;
const statusLabels = { DRAFT: 'Borrador', FINALIZED: 'Finalizada', LOCKED: 'Bloqueada', OPEN: 'Abierta' } as const;

function groupPreview(participantCount: number, groupCount: number): string {
  const base = Math.floor(participantCount / groupCount);
  const extras = participantCount % groupCount;
  return Array.from({ length: groupCount }, (_, index) => `${String.fromCharCode(65 + index)}: ${String(base + (index < extras ? 1 : 0))}`).join(' · ');
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
        if (current === null) {
          router.replace('/login');
          return;
        }
        setActor(current);
        setDetail(loaded);
        setDraw(loadedDraw);
        setResults(loadedResults);
        setHistory(loadedHistory);
        setChampion(loadedChampion);
        setFormatCode(loaded.formatCode ?? 'GROUP_STAGE');
        setGroupCount(loaded.groupCount ?? loaded.validGroupCounts[0] ?? 0);
      })
      .catch((caught: unknown) => active && setError(caught instanceof Error ? caught.message : 'No fue posible recuperar la competencia.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [competitionId, router]);

  const availableInstitutions = useMemo(
    () => detail?.institutions.filter(({ selected }) => !selected) ?? [],
    [detail],
  );

  useEffect(() => {
    setInstitutionId((current) => availableInstitutions.some(({ id }) => id === current) ? current : (availableInstitutions[0]?.id ?? ''));
  }, [availableInstitutions]);

  async function addParticipant(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault();
    if (detail === null || institutionId.length === 0) return;
    setError(null);
    setSubmitting('participant');
    try {
      const updated = await addCompetitionParticipant(detail.id, institutionId, detail.revision);
      setDetail(updated);
      setFormatCode('GROUP_STAGE');
      setGroupCount(updated.validGroupCounts[0] ?? 0);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible agregar el participante.');
    } finally {
      setSubmitting(null);
    }
  }

  async function saveFormat(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault();
    if (detail === null) return;
    setError(null);
    setSubmitting('format');
    try {
      const input = formatCode === 'GROUP_STAGE'
        ? { expectedRevision: detail.revision, formatCode, groupCount }
        : { expectedRevision: detail.revision, formatCode, groupCount: null };
      const updated = await configureCompetitionFormat(detail.id, input);
      setDetail(updated);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el formato.');
    } finally {
      setSubmitting(null);
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

  if (loading) return <main className="session-state" aria-live="polite">Recuperando configuración…</main>;
  if (actor === null || detail === null || draw === null || results === null || history === null) return <main className="session-state">{error ?? 'Redirigiendo…'}</main>;

  const canEdit = actor.role !== 'OPERATOR' && (detail.status === 'DRAFT' || detail.status === 'OPEN');
  const canSelfConfirm = actor.role === 'SUPERADMIN';
  const groupsAvailable = detail.validGroupCounts.length > 0;
  const knockoutAvailable = detail.participantCount >= 2;

  function refreshHistory(): void {
    void competitionHistory(competitionId).then(setHistory).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'No fue posible actualizar el historial competitivo.'));
  }

  function updateDraw(workspace: DrawWorkspace): void {
    setDraw(workspace);
    setDetail((current) => current === null ? current : { ...current, revision: workspace.competitionRevision, status: workspace.competitionStatus });
    void resultsWorkspace(competitionId).then(setResults).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'No fue posible recuperar los encuentros.'));
    refreshHistory();
  }

  function updateResults(workspace: ResultsWorkspace): void {
    setResults(workspace);
    refreshHistory();
  }

  function updateChampion(next: ChampionView): void {
    setChampion(next);
    setDetail((current) => current === null ? current : {
      ...current,
      revision: next.competitionRevision,
      status: next.status === 'CONFIRMED' ? 'FINALIZED' : current.status,
    });
    setDraw((current) => current === null ? current : {
      ...current,
      competitionRevision: next.competitionRevision,
      competitionStatus: next.status === 'CONFIRMED' ? 'FINALIZED' : current.competitionStatus,
    });
    refreshHistory();
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <OesMark />
        <nav aria-label="Navegación principal">
          <a className="nav-item" href="/dashboard">Resumen</a>
          <span className="nav-heading">Gestión competitiva</span>
          <a className="nav-item nav-item--active" href="/competitions">Competencias</a>
          <a className="nav-item" href="#official-draw-workspace">Sorteos</a>
          <a className="nav-item" href="#results-workspace">Resultados</a>
          <a className="nav-item" href="#competition-history">Historial</a>
        </nav>
        <div className="sidebar__footer">Sistema oficial · OES 2026</div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div><span className="eyebrow">Configuración competitiva</span><h1>{detail.sport.name} · {detail.modality.name}</h1></div>
          <div className="account-menu">
            <span className="account-avatar" aria-hidden="true">{actor.displayName.charAt(0)}</span>
            <span><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span>
            <button className="text-button" onClick={() => void closeSession()} type="button">Salir</button>
          </div>
        </header>
        {error === null ? null : <p className="dashboard-error" role="alert">{error}</p>}
        <section className="setup-heading">
          <div><a href="/competitions">← Volver a competencias</a><span className="eyebrow eyebrow--dark">{detail.edition.name} / {detail.event.name}</span><h2>Preparar la competencia.</h2><p>La lista y el formato quedan guardados para continuar el sorteo en otro momento o dispositivo.</p></div>
          <div className="setup-state"><span className={`competition-status competition-status--${detail.status.toLowerCase()}`}>{statusLabels[detail.status]}</span><small>Revisión {detail.revision}</small></div>
        </section>
        <div className="setup-grid">
          <section className="setup-card" aria-labelledby="participants-title">
            <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 1</span><h3 id="participants-title">Participantes</h3></div><span>{detail.participantCount}</span></div>
            {detail.participants.length === 0 ? <div className="setup-empty">Agrega las instituciones que competirán.</div> : (
              <ol className="participant-list">{detail.participants.map((participant, index) => <li key={participant.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{participant.displayName}</strong><small>{participant.status === 'ENABLED' ? 'Habilitado' : 'Retirado'}</small></li>)}</ol>
            )}
            {!canEdit ? <p className="readonly-note">Tu rol permite consultar esta configuración, pero no modificarla.</p> : availableInstitutions.length === 0 ? <p className="readonly-note">No quedan instituciones activas disponibles para este evento.</p> : (
              <form className="inline-setup-form" onSubmit={(event) => void addParticipant(event)}>
                <label htmlFor="institution">Institución</label>
                <div><select id="institution" onChange={(event) => setInstitutionId(event.target.value)} value={institutionId}>{availableInstitutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name} ({institution.code})</option>)}</select><button disabled={submitting !== null} type="submit">{submitting === 'participant' ? 'Agregando…' : 'Agregar'}</button></div>
              </form>
            )}
          </section>
          <section className="setup-card" aria-labelledby="format-title">
            <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 2</span><h3 id="format-title">Formato del sorteo</h3></div><span>02</span></div>
            <form className="format-form" onSubmit={(event) => void saveFormat(event)}>
              <label className={`format-option${formatCode === 'GROUP_STAGE' ? ' format-option--selected' : ''}${groupsAvailable ? '' : ' format-option--disabled'}`}>
                <input checked={formatCode === 'GROUP_STAGE'} disabled={!canEdit || !groupsAvailable} name="format" onChange={() => setFormatCode('GROUP_STAGE')} type="radio" />
                <span><strong>Fase de grupos</strong><small>Todos contra todos; grupos de 3 a 4 participantes.</small></span>
              </label>
              {formatCode === 'GROUP_STAGE' && groupsAvailable ? <div className="group-selector"><label htmlFor="group-count">Cantidad de grupos</label><select disabled={!canEdit} id="group-count" onChange={(event) => setGroupCount(Number(event.target.value))} value={groupCount}>{detail.validGroupCounts.map((count) => <option key={count} value={count}>{count} {count === 1 ? 'grupo' : 'grupos'}</option>)}</select><p>{groupPreview(detail.participantCount, groupCount)}</p></div> : null}
              <label className={`format-option${formatCode === 'KNOCKOUT' ? ' format-option--selected' : ''}${knockoutAvailable ? '' : ' format-option--disabled'}`}>
                <input checked={formatCode === 'KNOCKOUT'} disabled={!canEdit || !knockoutAvailable} name="format" onChange={() => setFormatCode('KNOCKOUT')} type="radio" />
                <span><strong>Eliminación directa</strong><small>Cruces aleatorios sin bombos; pases libres con historial.</small></span>
              </label>
              {canEdit ? <button className="primary-button" disabled={submitting !== null || (formatCode === 'GROUP_STAGE' ? !groupsAvailable : !knockoutAvailable)} type="submit">{submitting === 'format' ? 'Guardando…' : 'Guardar formato'}</button> : null}
              {detail.formatCode === null ? <p className="format-proof">Aún no hay un formato guardado.</p> : <p className="format-proof format-proof--ready">✓ Formato guardado: {detail.formatCode === 'GROUP_STAGE' ? `${String(detail.groupCount)} grupo(s)` : 'eliminación directa'}.</p>}
            </form>
          </section>
          <CompetitionRulesPanel canEdit={canEdit} detail={detail} onChange={setDetail} onError={setError} />
          <OfficialDrawPanel actorId={actor.id} canAnnul={actor.role === 'SUPERADMIN'} canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} canSelfConfirm={canSelfConfirm} detail={detail} onChange={updateDraw} onError={setError} workspace={draw} />
          <ResultsWorkspacePanel actorId={actor.id} canAnnul={actor.role === 'SUPERADMIN' && detail.status !== 'FINALIZED'} canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} canSelfConfirm={canSelfConfirm} onChange={updateResults} onError={setError} workspace={results} />
          <NextRoundPanel canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} competitionId={competitionId} draw={draw} onChange={updateDraw} onError={setError} results={results} />
          <ChampionPanel actorId={actor.id} canOperate={actor.role !== 'OPERATOR' && detail.status !== 'FINALIZED'} canSelfConfirm={canSelfConfirm} champion={champion} competitionId={competitionId} draw={draw} onChange={updateChampion} onError={setError} results={results} />
          <CompetitionHistoryPanel history={history} />
        </div>
      </main>
    </div>
  );
}
