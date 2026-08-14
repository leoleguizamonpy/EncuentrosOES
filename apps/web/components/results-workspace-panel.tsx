'use client';

import { type SyntheticEvent, useState } from 'react';

import { annulMatchResult, confirmGroupQualification, confirmMatchResult, recordMatchResult, type GroupQualificationView, type MatchResultView, type ResultMatchView, type ResultsWorkspace } from '../lib/competition-api';

const statusLabels = { PENDING_RESULT: 'Pendiente de resultado', RESULT_CONFIRMED: 'Resultado confirmado', RESULT_PENDING_CONFIRMATION: 'Pendiente de confirmación' } as const;

function ResultScore({ result }: { readonly result: MatchResultView }): React.JSX.Element {
  if (result.detail.profile === 'SCORE_BASED') return <strong>{result.detail.scoreA} — {result.detail.scoreB}</strong>;
  return <strong>{result.resolved.setsWonA} — {result.resolved.setsWonB} <small>sets</small></strong>;
}

function MatchCard({ actorId, canAnnul, canOperate, match, onChange, onError, profile }: {
  readonly actorId: string;
  readonly canAnnul: boolean;
  readonly canOperate: boolean;
  readonly match: ResultMatchView;
  readonly onChange: (workspace: ResultsWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly profile: ResultsWorkspace['resultProfile'];
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [annulmentOpen, setAnnulmentOpen] = useState(false);
  const [annulmentReason, setAnnulmentReason] = useState('');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [sets, setSets] = useState([{ pointsA: 0, pointsB: 0 }]);
  const [submitting, setSubmitting] = useState<'annul' | 'confirm' | 'record' | null>(null);

  async function record(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); onError(null); setSubmitting('record');
    try {
      const detail = profile === 'SET_BASED' ? { profile, sets } as const : { profile: 'SCORE_BASED' as const, scoreA, scoreB };
      onChange(await recordMatchResult(match.id, detail)); setOpen(false);
    } catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible registrar el resultado.'); }
    finally { setSubmitting(null); }
  }

  async function confirm(): Promise<void> {
    if (match.result === null) return;
    onError(null); setSubmitting('confirm');
    try { onChange(await confirmMatchResult(match.result.id, match.result.revision)); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible confirmar el resultado.'); }
    finally { setSubmitting(null); }
  }

  async function annul(): Promise<void> {
    if (match.result === null || annulmentReason.trim().length < 10) return;
    onError(null); setSubmitting('annul');
    try { onChange(await annulMatchResult(match.result.id, match.result.revision, annulmentReason.trim())); setAnnulmentOpen(false); setAnnulmentReason(''); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible anular el resultado.'); }
    finally { setSubmitting(null); }
  }

  return <article className="result-match">
    <header><span>{match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`} · Encuentro {match.ordinal}</span><small className={`match-state match-state--${match.status.toLowerCase()}`}>{statusLabels[match.status]}</small></header>
    <div><b>{match.participantA.displayName}</b>{match.result === null ? <i>VS</i> : <ResultScore result={match.result} />}<b>{match.participantB.displayName}</b></div>
    {match.result === null ? canOperate ? <>{!open ? <button className="secondary-button" onClick={() => setOpen(true)} type="button">Cargar resultado</button> : <form className="result-entry-form" onSubmit={(event) => void record(event)}>
      {profile === 'SET_BASED' ? <>{sets.map((set, index) => <div className="result-set-row" key={index}><label>Set {index + 1}<input aria-label={`Set ${String(index + 1)} · ${match.participantA.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsA: Number(event.target.value) } : item))} type="number" value={set.pointsA} /></label><span>—</span><label><span className="sr-only">{match.participantB.displayName}</span><input aria-label={`Set ${String(index + 1)} · ${match.participantB.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsB: Number(event.target.value) } : item))} type="number" value={set.pointsB} /></label></div>)}<button disabled={sets.length >= 9 || submitting !== null} onClick={() => setSets((current) => [...current, { pointsA: 0, pointsB: 0 }])} type="button">Agregar set</button></> : <div className="result-score-row"><label>{match.participantA.displayName}<input aria-label={`Marcador de ${match.participantA.displayName}`} min="0" onChange={(event) => setScoreA(Number(event.target.value))} type="number" value={scoreA} /></label><span>—</span><label>{match.participantB.displayName}<input aria-label={`Marcador de ${match.participantB.displayName}`} min="0" onChange={(event) => setScoreB(Number(event.target.value))} type="number" value={scoreB} /></label></div>}
      <div><button className="primary-button" disabled={submitting !== null} type="submit">{submitting === 'record' ? 'Registrando…' : 'Enviar a confirmación'}</button><button disabled={submitting !== null} onClick={() => setOpen(false)} type="button">Cancelar</button></div>
    </form>}</> : null : <footer>Registrado por {match.result.recordedBy.displayName}{match.result.confirmedBy === null ? '' : ` · confirmado por ${match.result.confirmedBy.displayName}`}</footer>}
    {match.result?.status === 'PENDING_CONFIRMATION' ? match.result.recordedBy.id === actorId ? <p className="readonly-note">Otra autoridad debe confirmar este resultado.</p> : canOperate ? <button className="primary-button" disabled={submitting !== null} onClick={() => void confirm()} type="button">{submitting === 'confirm' ? 'Confirmando…' : 'Confirmar resultado'}</button> : null : null}
    {match.result?.status === 'CONFIRMED' && canAnnul ? <div className="result-annulment">{!annulmentOpen ? <button className="danger-button" disabled={submitting !== null} onClick={() => setAnnulmentOpen(true)} type="button">Anular resultado</button> : <div className="draw-annulment__form"><strong>Anulación oficial del resultado</strong><label htmlFor={`result-annulment-${match.result.id}`}>Motivo formal de anulación</label><textarea id={`result-annulment-${match.result.id}`} maxLength={500} minLength={10} onChange={(event) => setAnnulmentReason(event.target.value)} placeholder="Explica el error que obliga a cargar nuevamente este resultado…" value={annulmentReason} /><small>{annulmentReason.trim().length}/500 · mínimo 10 caracteres</small><div><button className="danger-button" disabled={submitting !== null || annulmentReason.trim().length < 10} onClick={() => void annul()} type="button">{submitting === 'annul' ? 'Anulando…' : 'Confirmar anulación'}</button><button disabled={submitting !== null} onClick={() => { setAnnulmentOpen(false); setAnnulmentReason(''); }} type="button">Cancelar</button></div></div>}</div> : null}
  </article>;
}

function QualificationPanel({ actorId, canOperate, onChange, onError, qualification }: {
  readonly actorId: string;
  readonly canOperate: boolean;
  readonly onChange: (workspace: ResultsWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly qualification: GroupQualificationView;
}): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);

  async function confirm(): Promise<void> {
    onError(null); setSubmitting(true);
    try { onChange(await confirmGroupQualification(qualification.id, qualification.revision)); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible confirmar los clasificados.'); }
    finally { setSubmitting(false); }
  }

  const pending = qualification.status === 'PENDING_CONFIRMATION';
  return <section className={`qualification-panel qualification-panel--${pending ? 'pending' : 'confirmed'}`} aria-label="Clasificación del grupo">
    <header><div><span>{pending ? 'Clasificación propuesta' : 'Clasificación confirmada'}</span><strong>Avance a la siguiente fase</strong></div><small>{pending ? 'Requiere otra autoridad' : 'Oficial'}</small></header>
    <ol>
      <li><span>1.º</span><strong>{qualification.firstParticipant.displayName}</strong></li>
      <li><span>2.º</span><strong>{qualification.secondParticipant.displayName}</strong></li>
    </ol>
    <footer>Propuesto por {qualification.proposedBy.displayName}{qualification.confirmedBy === null ? '' : ` · confirmado por ${qualification.confirmedBy.displayName}`}</footer>
    {pending ? qualification.proposedBy.id === actorId ? <p className="readonly-note">Otra autoridad debe confirmar estos clasificados.</p> : canOperate ? <button className="primary-button" disabled={submitting} onClick={() => void confirm()} type="button">{submitting ? 'Confirmando…' : 'Confirmar clasificados'}</button> : <p className="readonly-note">Un administrador debe confirmar estos clasificados.</p> : null}
  </section>;
}

export function ResultsWorkspacePanel({ actorId, canAnnul, canOperate, onChange, onError, workspace }: { readonly actorId: string; readonly canAnnul: boolean; readonly canOperate: boolean; readonly onChange: (workspace: ResultsWorkspace) => void; readonly onError: (message: string | null) => void; readonly workspace: ResultsWorkspace }): React.JSX.Element {
  const setBased = workspace.resultProfile === 'SET_BASED';
  return <section className="setup-card results-workspace" id="results-workspace" aria-labelledby="results-workspace-title">
    <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 5</span><h3 id="results-workspace-title">Encuentros y tabla</h3></div><span>{workspace.matches.length}</span></div>
    {workspace.matches.length === 0 ? <div className="setup-empty">Los encuentros aparecerán cuando otra autoridad confirme el sorteo oficial.</div> : <><div className="result-match-list">{workspace.matches.map((match) => <MatchCard actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} key={match.id} match={match} onChange={onChange} onError={onError} profile={workspace.resultProfile} />)}</div>{workspace.groups.map((group) => <article className="standing-card" key={group.id}><header><div><span>Tabla automática</span><strong>Grupo {group.label}</strong></div><small>{group.complete ? 'Completa' : 'Parcial'}</small></header><div className="standing-scroll"><table><thead><tr><th>Pos.</th><th>Participante</th><th>J</th><th>G</th>{setBased ? null : <th>E</th>}<th>P</th><th>Pts.</th>{setBased ? <><th>SG</th><th>DP</th></> : <><th>GF</th><th>GC</th><th>DG</th></>}</tr></thead><tbody>{group.standings.map((row) => <tr key={row.participant.id}><td>{row.position}{row.tied ? '=' : ''}</td><th>{row.participant.displayName}</th><td>{row.played}</td><td>{row.wins}</td>{setBased ? null : <td>{row.draws}</td>}<td>{row.losses}</td><td><strong>{row.tablePoints}</strong></td>{setBased ? <><td>{row.setsWon}</td><td>{row.sportPointDifference}</td></> : <><td>{row.scoreFor}</td><td>{row.scoreAgainst}</td><td>{row.scoreDifference}</td></>}</tr>)}</tbody></table></div>{group.standings.length === 0 ? <p>La tabla se calculará al confirmar el primer resultado.</p> : null}{group.qualification === null ? group.complete ? <p>La tabla tiene un empate sin resolver en el corte de clasificación.</p> : null : <QualificationPanel actorId={actorId} canOperate={canOperate} onChange={onChange} onError={onError} qualification={group.qualification} />}</article>)}</>}
  </section>;
}
