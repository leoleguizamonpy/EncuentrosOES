'use client';

import { Alert, Button, Card, Chip } from '@heroui/react';
import { type SyntheticEvent, useState } from 'react';

import { annulMatchResult, confirmGroupQualification, confirmMatchResult, recordMatchResult, type AdministrativeOutcome, type GroupQualificationView, type MatchResultView, type ResultMatchView, type ResultsWorkspace } from '../lib/competition-api';

const statusLabels = { PENDING_RESULT: 'Pendiente de resultado', RESULT_CONFIRMED: 'Resultado confirmado', RESULT_PENDING_CONFIRMATION: 'Pendiente de confirmación' } as const;
const administrativeLabels: Readonly<Record<AdministrativeOutcome, string>> = {
  ABANDONED_A: 'Abandono del participante A',
  ABANDONED_B: 'Abandono del participante B',
  NO_SHOW_A: 'Incomparecencia del participante A',
  NO_SHOW_B: 'Incomparecencia del participante B',
  NO_SHOW_BOTH: 'Incomparecencia de ambos participantes',
  WITHDRAWN_A: 'Retirada del participante A',
  WITHDRAWN_B: 'Retirada del participante B',
};

type EntryMode = 'PLAYED' | AdministrativeOutcome;

function ResultScore({ result }: { readonly result: MatchResultView }): React.JSX.Element {
  if (result.detail.profile === 'ADMINISTRATIVE') return <strong>{administrativeLabels[result.detail.outcome]}</strong>;
  if (result.detail.profile === 'SCORE_BASED') return <strong>{result.detail.scoreA} — {result.detail.scoreB}{result.detail.tieBreak === undefined ? null : <small> · penales {result.detail.tieBreak.scoreA} — {result.detail.tieBreak.scoreB}</small>}</strong>;
  return <strong>{result.resolved.setsWonA} — {result.resolved.setsWonB} <small>sets</small></strong>;
}

function matchStatusColor(status: ResultMatchView['status']): 'default' | 'success' | 'warning' {
  if (status === 'RESULT_CONFIRMED') return 'success';
  if (status === 'RESULT_PENDING_CONFIRMATION') return 'warning';
  return 'default';
}

function MatchCard({ actorId, canAnnul, canOperate, canSelfConfirm, match, onChange, onError, profile }: {
  readonly actorId: string;
  readonly canAnnul: boolean;
  readonly canOperate: boolean;
  readonly canSelfConfirm: boolean;
  readonly match: ResultMatchView;
  readonly onChange: (workspace: ResultsWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly profile: ResultsWorkspace['resultProfile'];
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('PLAYED');
  const [annulmentOpen, setAnnulmentOpen] = useState(false);
  const [annulmentReason, setAnnulmentReason] = useState('');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [penaltiesA, setPenaltiesA] = useState(0);
  const [penaltiesB, setPenaltiesB] = useState(0);
  const [sets, setSets] = useState([{ pointsA: 0, pointsB: 0 }]);
  const [submitting, setSubmitting] = useState<'annul' | 'confirm' | 'record' | null>(null);
  const knockout = match.group === null;
  const tiedScore = profile === 'SCORE_BASED' && scoreA === scoreB;

  async function record(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); onError(null); setSubmitting('record');
    try {
      const detail = entryMode !== 'PLAYED'
        ? { outcome: entryMode, profile: 'ADMINISTRATIVE' as const }
        : profile === 'SET_BASED'
          ? { profile, sets } as const
          : { profile: 'SCORE_BASED' as const, scoreA, scoreB, ...(knockout && tiedScore ? { tieBreak: { method: 'PENALTIES' as const, scoreA: penaltiesA, scoreB: penaltiesB } } : {}) };
      onChange(await recordMatchResult(match.id, detail)); setOpen(false); setEntryMode('PLAYED');
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

  const ownPendingResult = match.result?.status === 'PENDING_CONFIRMATION' && match.result.recordedBy.id === actorId;
  const invalidPenaltyTie = entryMode === 'PLAYED' && knockout && tiedScore && penaltiesA === penaltiesB;

  return <Card className="result-match">
    <Card.Header><span>{match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`} · Encuentro {match.ordinal}</span><Chip color={matchStatusColor(match.status)} size="sm" variant="soft">{statusLabels[match.status]}</Chip></Card.Header>
    <Card.Content>
      <div><b>{match.participantA.displayName}</b>{match.result === null ? <i>VS</i> : <ResultScore result={match.result} />}<b>{match.participantB.displayName}</b></div>
      {match.result === null ? canOperate ? <>{!open ? <Button onPress={() => setOpen(true)} variant="secondary">Cargar resultado</Button> : <form className="result-entry-form" onSubmit={(event) => void record(event)}>
        <label>Cómo terminó el encuentro<select aria-label="Cómo terminó el encuentro" onChange={(event) => setEntryMode(event.target.value as EntryMode)} value={entryMode}><option value="PLAYED">Se disputó normalmente</option><option value="NO_SHOW_A">{match.participantA.displayName} no se presentó</option><option value="NO_SHOW_B">{match.participantB.displayName} no se presentó</option><option value="NO_SHOW_BOTH">Ninguno se presentó</option><option value="WITHDRAWN_A">{match.participantA.displayName} se retiró</option><option value="WITHDRAWN_B">{match.participantB.displayName} se retiró</option><option value="ABANDONED_A">{match.participantA.displayName} abandonó el encuentro</option><option value="ABANDONED_B">{match.participantB.displayName} abandonó el encuentro</option></select></label>
        {entryMode === 'PLAYED' ? profile === 'SET_BASED' ? <>{sets.map((set, index) => <div className="result-set-row" key={index}><label>Set {index + 1}<input aria-label={`Set ${String(index + 1)} · ${match.participantA.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsA: Number(event.target.value) } : item))} type="number" value={set.pointsA} /></label><span>—</span><label><span className="sr-only">{match.participantB.displayName}</span><input aria-label={`Set ${String(index + 1)} · ${match.participantB.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsB: Number(event.target.value) } : item))} type="number" value={set.pointsB} /></label></div>)}<Button isDisabled={sets.length >= 9 || submitting !== null} onPress={() => setSets((current) => [...current, { pointsA: 0, pointsB: 0 }])} size="sm" variant="secondary">Agregar set</Button></> : <><div className="result-score-row"><label>{match.participantA.displayName}<input aria-label={`Marcador de ${match.participantA.displayName}`} min="0" onChange={(event) => setScoreA(Number(event.target.value))} type="number" value={scoreA} /></label><span>—</span><label>{match.participantB.displayName}<input aria-label={`Marcador de ${match.participantB.displayName}`} min="0" onChange={(event) => setScoreB(Number(event.target.value))} type="number" value={scoreB} /></label></div>{knockout && tiedScore ? <div className="result-score-row"><label>Penales · {match.participantA.displayName}<input aria-label={`Penales de ${match.participantA.displayName}`} min="0" onChange={(event) => setPenaltiesA(Number(event.target.value))} type="number" value={penaltiesA} /></label><span>—</span><label>Penales · {match.participantB.displayName}<input aria-label={`Penales de ${match.participantB.displayName}`} min="0" onChange={(event) => setPenaltiesB(Number(event.target.value))} type="number" value={penaltiesB} /></label></div> : null}</> : <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Resolución administrativa: {administrativeLabels[entryMode]}. En fase de grupos se asignan 0 puntos al ausente y 3 al presente; si ambos faltan, ambos reciben 0. No se inventan goles ni sets.</Alert.Description></Alert.Content></Alert>}
        <div style={{ display: 'flex', gap: 8 }}><Button isDisabled={submitting !== null || invalidPenaltyTie} type="submit" variant="primary">{submitting === 'record' ? 'Registrando…' : 'Enviar a confirmación'}</Button><Button isDisabled={submitting !== null} onPress={() => { setOpen(false); setEntryMode('PLAYED'); }} type="button" variant="ghost">Cancelar</Button></div>
        {invalidPenaltyTie ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Los penales deben determinar un ganador.</Alert.Description></Alert.Content></Alert> : null}
      </form>}</> : null : <footer>Registrado por {match.result.recordedBy.displayName}{match.result.confirmedBy === null ? '' : ` · confirmado por ${match.result.confirmedBy.displayName}`}</footer>}
      {match.result?.status === 'PENDING_CONFIRMATION' ? ownPendingResult && !canSelfConfirm ? <p className="readonly-note">Otra autoridad debe confirmar este resultado.</p> : canOperate ? <Button isDisabled={submitting !== null} onPress={() => void confirm()} variant="primary">{submitting === 'confirm' ? 'Confirmando…' : ownPendingResult ? 'Confirmar mi resultado' : 'Confirmar resultado'}</Button> : null : null}
      {match.result?.status === 'CONFIRMED' && canAnnul ? <div className="result-annulment">{!annulmentOpen ? <Button color="danger" isDisabled={submitting !== null} onPress={() => setAnnulmentOpen(true)} variant="secondary">Anular resultado</Button> : <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Title>Anulación oficial del resultado</Alert.Title><label htmlFor={`result-annulment-${match.result.id}`}>Motivo formal de anulación</label><textarea id={`result-annulment-${match.result.id}`} maxLength={500} minLength={10} onChange={(event) => setAnnulmentReason(event.target.value)} placeholder="Explica el error que obliga a cargar nuevamente este resultado…" value={annulmentReason} /><small>{annulmentReason.trim().length}/500 · mínimo 10 caracteres</small><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><Button color="danger" isDisabled={submitting !== null || annulmentReason.trim().length < 10} onPress={() => void annul()} size="sm" variant="primary">{submitting === 'annul' ? 'Anulando…' : 'Confirmar anulación'}</Button><Button isDisabled={submitting !== null} onPress={() => { setAnnulmentOpen(false); setAnnulmentReason(''); }} size="sm" variant="ghost">Cancelar</Button></div></Alert.Content></Alert>}</div> : null}
    </Card.Content>
  </Card>;
}

function QualificationPanel({ actorId, canOperate, canSelfConfirm, onChange, onError, qualification }: {
  readonly actorId: string;
  readonly canOperate: boolean;
  readonly canSelfConfirm: boolean;
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
  const ownPendingQualification = pending && qualification.proposedBy.id === actorId;
  return <Card className={`qualification-panel qualification-panel--${pending ? 'pending' : 'confirmed'}`} aria-label="Clasificación del grupo" variant="tertiary">
    <Card.Header><div><span>{pending ? 'Clasificación propuesta' : 'Clasificación confirmada'}</span><strong>Avance a la siguiente fase</strong></div><Chip color={pending ? 'warning' : 'success'} size="sm" variant="soft">{pending ? 'Pendiente' : 'Oficial'}</Chip></Card.Header>
    <Card.Content><ol><li><span>1.º</span><strong>{qualification.firstParticipant.displayName}</strong></li><li><span>2.º</span><strong>{qualification.secondParticipant.displayName}</strong></li></ol></Card.Content>
    <Card.Footer>Propuesto por {qualification.proposedBy.displayName}{qualification.confirmedBy === null ? '' : ` · confirmado por ${qualification.confirmedBy.displayName}`}</Card.Footer>
    {pending ? ownPendingQualification && !canSelfConfirm ? <p className="readonly-note">Otra autoridad debe confirmar estos clasificados.</p> : canOperate ? <Button isDisabled={submitting} onPress={() => void confirm()} variant="primary">{submitting ? 'Confirmando…' : ownPendingQualification ? 'Confirmar mis clasificados' : 'Confirmar clasificados'}</Button> : <p className="readonly-note">Una autoridad habilitada debe confirmar estos clasificados.</p> : null}
  </Card>;
}

export function ResultsWorkspacePanel({ actorId, canAnnul, canOperate, canSelfConfirm = false, onChange, onError, workspace }: { readonly actorId: string; readonly canAnnul: boolean; readonly canOperate: boolean; readonly canSelfConfirm?: boolean; readonly onChange: (workspace: ResultsWorkspace) => void; readonly onError: (message: string | null) => void; readonly workspace: ResultsWorkspace }): React.JSX.Element {
  const setBased = workspace.resultProfile === 'SET_BASED';
  return <Card className="setup-card results-workspace" id="results-workspace" aria-labelledby="results-workspace-title">
    <Card.Content>
      <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 5</span><h3 id="results-workspace-title">Encuentros y tabla</h3></div><Chip size="sm" variant="soft">{workspace.matches.length} encuentros</Chip></div>
      {workspace.matches.length === 0 ? <div className="setup-empty">Los encuentros aparecerán cuando se confirme el sorteo oficial.</div> : <><div className="result-match-list">{workspace.matches.map((match) => <MatchCard actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} key={match.id} match={match} onChange={onChange} onError={onError} profile={workspace.resultProfile} />)}</div>{workspace.groups.map((group) => <Card className="standing-card" key={group.id}><Card.Header><div><span>Tabla automática</span><strong>Grupo {group.label}</strong></div><Chip color={group.complete ? 'success' : 'default'} size="sm" variant="soft">{group.complete ? 'Completa' : 'Parcial'}</Chip></Card.Header><Card.Content><div className="standing-scroll"><table><thead><tr><th>Pos.</th><th>Participante</th><th>J</th><th>G</th>{setBased ? null : <th>E</th>}<th>P</th><th>Pts.</th>{setBased ? <><th>SG</th><th>DP</th></> : <><th>GF</th><th>GC</th><th>DG</th></>}</tr></thead><tbody>{group.standings.map((row) => <tr key={row.participant.id}><td>{row.position}{row.tied ? '=' : ''}</td><th>{row.participant.displayName}</th><td>{row.played}</td><td>{row.wins}</td>{setBased ? null : <td>{row.draws}</td>}<td>{row.losses}</td><td><strong>{row.tablePoints}</strong></td>{setBased ? <><td>{row.setsWon}</td><td>{row.sportPointDifference}</td></> : <><td>{row.scoreFor}</td><td>{row.scoreAgainst}</td><td>{row.scoreDifference}</td></>}</tr>)}</tbody></table></div>{group.standings.length === 0 ? <p>La tabla se calculará al confirmar el primer resultado.</p> : null}{group.qualification === null ? group.complete ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>La tabla tiene un empate sin resolver en el corte de clasificación.</Alert.Description></Alert.Content></Alert> : null : <QualificationPanel actorId={actorId} canOperate={canOperate} canSelfConfirm={canSelfConfirm} onChange={onChange} onError={onError} qualification={group.qualification} />}</Card.Content></Card>)}</>}
    </Card.Content>
  </Card>;
}
