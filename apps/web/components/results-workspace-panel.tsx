'use client';

import { Alert, Button, Card, Chip } from '@heroui/react';
import { type SyntheticEvent, useState } from 'react';

import { annulMatchResult, confirmGroupQualification, confirmMatchResult, recordMatchResult, type AdministrativeOutcome, type GroupQualificationView, type MatchResultView, type ResultMatchView, type ResultsWorkspace, type StandingRowView } from '../lib/competition-api';
import { DataTable, type DataTableColumn, InlineActions, SectionPanel } from '../ui';
import styles from './results-workspace.module.css';

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

function cx(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

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

  return <Card className={cx('result-match', styles.matchCard)}>
    <Card.Header><span>{match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`} · Encuentro {match.ordinal}</span><Chip color={matchStatusColor(match.status)} size="sm" variant="soft">{statusLabels[match.status]}</Chip></Card.Header>
    <Card.Content>
      <div className={styles.scoreline}><b>{match.participantA.displayName}</b>{match.result === null ? <i>VS</i> : <ResultScore result={match.result} />}<b>{match.participantB.displayName}</b></div>
      {match.result === null ? canOperate ? <>{!open ? <Button onPress={() => setOpen(true)} variant="secondary">Cargar resultado</Button> : <form className="result-entry-form" onSubmit={(event) => void record(event)}>
        <label>Cómo terminó el encuentro<select aria-label="Cómo terminó el encuentro" onChange={(event) => setEntryMode(event.target.value as EntryMode)} value={entryMode}><option value="PLAYED">Se disputó normalmente</option><option value="NO_SHOW_A">{match.participantA.displayName} no se presentó</option><option value="NO_SHOW_B">{match.participantB.displayName} no se presentó</option><option value="NO_SHOW_BOTH">Ninguno se presentó</option><option value="WITHDRAWN_A">{match.participantA.displayName} se retiró</option><option value="WITHDRAWN_B">{match.participantB.displayName} se retiró</option><option value="ABANDONED_A">{match.participantA.displayName} abandonó el encuentro</option><option value="ABANDONED_B">{match.participantB.displayName} abandonó el encuentro</option></select></label>
        {entryMode === 'PLAYED' ? profile === 'SET_BASED' ? <>{sets.map((set, index) => <div className="result-set-row" key={index}><label>Set {index + 1}<input aria-label={`Set ${String(index + 1)} · ${match.participantA.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsA: Number(event.target.value) } : item))} type="number" value={set.pointsA} /></label><span>—</span><label><span className="sr-only">{match.participantB.displayName}</span><input aria-label={`Set ${String(index + 1)} · ${match.participantB.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsB: Number(event.target.value) } : item))} type="number" value={set.pointsB} /></label></div>)}<Button isDisabled={sets.length >= 9 || submitting !== null} onPress={() => setSets((current) => [...current, { pointsA: 0, pointsB: 0 }])} size="sm" variant="secondary">Agregar set</Button></> : <><div className="result-score-row"><label>{match.participantA.displayName}<input aria-label={`Marcador de ${match.participantA.displayName}`} min="0" onChange={(event) => setScoreA(Number(event.target.value))} type="number" value={scoreA} /></label><span>—</span><label>{match.participantB.displayName}<input aria-label={`Marcador de ${match.participantB.displayName}`} min="0" onChange={(event) => setScoreB(Number(event.target.value))} type="number" value={scoreB} /></label></div>{knockout && tiedScore ? <div className="result-score-row"><label>Penales · {match.participantA.displayName}<input aria-label={`Penales de ${match.participantA.displayName}`} min="0" onChange={(event) => setPenaltiesA(Number(event.target.value))} type="number" value={penaltiesA} /></label><span>—</span><label>Penales · {match.participantB.displayName}<input aria-label={`Penales de ${match.participantB.displayName}`} min="0" onChange={(event) => setPenaltiesB(Number(event.target.value))} type="number" value={penaltiesB} /></label></div> : null}</> : <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Resolución administrativa: {administrativeLabels[entryMode]}. En fase de grupos se asignan 0 puntos al ausente y 3 al presente; si ambos faltan, ambos reciben 0. No se inventan goles ni sets.</Alert.Description></Alert.Content></Alert>}
        <InlineActions compact><Button isDisabled={submitting !== null || invalidPenaltyTie} type="submit" variant="primary">{submitting === 'record' ? 'Registrando…' : 'Enviar a confirmación'}</Button><Button isDisabled={submitting !== null} onPress={() => { setOpen(false); setEntryMode('PLAYED'); }} type="button" variant="ghost">Cancelar</Button></InlineActions>
        {invalidPenaltyTie ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Los penales deben determinar un ganador.</Alert.Description></Alert.Content></Alert> : null}
      </form>}</> : null : <footer>Registrado por {match.result.recordedBy.displayName}{match.result.confirmedBy === null ? '' : ` · confirmado por ${match.result.confirmedBy.displayName}`}</footer>}
      {match.result?.status === 'PENDING_CONFIRMATION' ? ownPendingResult && !canSelfConfirm ? <p className="readonly-note">Otra autoridad debe confirmar este resultado.</p> : canOperate ? <Button isDisabled={submitting !== null} onPress={() => void confirm()} variant="primary">{submitting === 'confirm' ? 'Confirmando…' : ownPendingResult ? 'Confirmar mi resultado' : 'Confirmar resultado'}</Button> : null : null}
      {match.result?.status === 'CONFIRMED' && canAnnul ? <div className="result-annulment">{!annulmentOpen ? <Button isDisabled={submitting !== null} onPress={() => setAnnulmentOpen(true)} variant="secondary">Anular resultado</Button> : <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Title>Anulación oficial del resultado</Alert.Title><label htmlFor={`result-annulment-${match.result.id}`}>Motivo formal de anulación</label><textarea id={`result-annulment-${match.result.id}`} maxLength={500} minLength={10} onChange={(event) => setAnnulmentReason(event.target.value)} placeholder="Explica el error que obliga a cargar nuevamente este resultado…" value={annulmentReason} /><small>{annulmentReason.trim().length}/500 · mínimo 10 caracteres</small><InlineActions compact><Button isDisabled={submitting !== null || annulmentReason.trim().length < 10} onPress={() => void annul()} size="sm" variant="primary">{submitting === 'annul' ? 'Anulando…' : 'Confirmar anulación'}</Button><Button isDisabled={submitting !== null} onPress={() => { setAnnulmentOpen(false); setAnnulmentReason(''); }} size="sm" variant="ghost">Cancelar</Button></InlineActions></Alert.Content></Alert>}</div> : null}
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

function standingColumns(setBased: boolean): readonly DataTableColumn<StandingRowView>[] {
  const shared: DataTableColumn<StandingRowView>[] = [
    { className: styles.positionColumn, id: 'position', label: 'Pos.', render: (row) => <>{row.position}{row.tied ? '=' : ''}</> },
    { className: styles.participantColumn, id: 'participant', label: 'Participante', render: (row) => <strong>{row.participant.displayName}</strong> },
    { className: styles.numericColumn, id: 'played', label: 'J', render: (row) => row.played },
    { className: cx(styles.numericColumn, styles.hideMobile), id: 'wins', label: 'G', render: (row) => row.wins },
  ];
  if (!setBased) shared.push({ className: cx(styles.numericColumn, styles.hideTablet), id: 'draws', label: 'E', render: (row) => row.draws });
  shared.push(
    { className: cx(styles.numericColumn, styles.hideMobile), id: 'losses', label: 'P', render: (row) => row.losses },
    { className: styles.pointsColumn, id: 'points', label: 'Pts.', render: (row) => <strong>{row.tablePoints}</strong> },
  );
  if (setBased) {
    shared.push(
      { className: cx(styles.numericColumn, styles.hideMobile), id: 'sets', label: 'SG', render: (row) => row.setsWon },
      { className: styles.differenceColumn, id: 'difference', label: 'DP', render: (row) => row.sportPointDifference },
    );
  } else {
    shared.push(
      { className: cx(styles.numericColumn, styles.hideTablet), id: 'for', label: 'GF', render: (row) => row.scoreFor },
      { className: cx(styles.numericColumn, styles.hideTablet), id: 'against', label: 'GC', render: (row) => row.scoreAgainst },
      { className: styles.differenceColumn, id: 'difference', label: 'DG', render: (row) => row.scoreDifference },
    );
  }
  return shared;
}

function GroupStage({ actorId, canAnnul, canOperate, canSelfConfirm, onChange, onError, workspace }: {
  readonly actorId: string;
  readonly canAnnul: boolean;
  readonly canOperate: boolean;
  readonly canSelfConfirm: boolean;
  readonly onChange: (workspace: ResultsWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly workspace: ResultsWorkspace;
}): React.JSX.Element {
  const setBased = workspace.resultProfile === 'SET_BASED';
  return <div className={styles.groupStageList} aria-label="Fase de grupos">
    {workspace.groups.map((group) => {
      const matches = workspace.matches.filter((match) => match.group?.id === group.id);
      const confirmedMatches = matches.filter((match) => match.status === 'RESULT_CONFIRMED').length;
      return <Card className={cx('standing-card', styles.groupCard)} key={group.id}>
        <Card.Header>
          <div className={styles.groupTitle}><span>Fase de grupos</span><strong>Grupo {group.label}</strong></div>
          <div className={styles.groupMeta}><Chip size="sm" variant="soft">{confirmedMatches}/{matches.length} resultados</Chip><Chip color={group.complete ? 'success' : 'default'} size="sm" variant="soft">{group.complete ? 'Completo' : 'En curso'}</Chip></div>
        </Card.Header>
        <Card.Content><div className={styles.groupContent}>
          <section className={styles.subsection} aria-labelledby={`group-${group.id}-matches`}>
            <div className={styles.subsectionHeader}><div className={styles.subsectionTitle}><span>Resultados</span><strong id={`group-${group.id}-matches`}>Encuentros del grupo</strong></div><span>{matches.length} {matches.length === 1 ? 'partido' : 'partidos'}</span></div>
            <div className={styles.matchList}>{matches.map((match) => <MatchCard actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} key={match.id} match={match} onChange={onChange} onError={onError} profile={workspace.resultProfile} />)}</div>
          </section>

          <section className={styles.subsection} aria-labelledby={`group-${group.id}-standings`}>
            <div className={styles.subsectionHeader}><div className={styles.subsectionTitle}><span>Clasificación</span><strong id={`group-${group.id}-standings`}>Tabla del Grupo {group.label}</strong></div><Chip color={group.complete ? 'success' : 'default'} size="sm" variant="soft">{group.complete ? 'Tabla final' : 'Tabla parcial'}</Chip></div>
            <DataTable className={styles.standingsTable} columns={standingColumns(setBased)} getRowKey={(row) => row.participant.id} label={`Tabla del grupo ${group.label}`} rows={group.standings} width="wide" />
            {group.standings.length === 0 ? <p className={styles.emptyTable}>La tabla se calculará al confirmar el primer resultado.</p> : null}
            {group.qualification === null ? group.complete ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>La tabla tiene un empate sin resolver en el corte de clasificación.</Alert.Description></Alert.Content></Alert> : null : <QualificationPanel actorId={actorId} canOperate={canOperate} canSelfConfirm={canSelfConfirm} onChange={onChange} onError={onError} qualification={group.qualification} />}
          </section>
        </div></Card.Content>
      </Card>;
    })}
  </div>;
}

export function ResultsWorkspacePanel({ actorId, canAnnul, canOperate, canSelfConfirm = false, onChange, onError, workspace }: { readonly actorId: string; readonly canAnnul: boolean; readonly canOperate: boolean; readonly canSelfConfirm?: boolean; readonly onChange: (workspace: ResultsWorkspace) => void; readonly onError: (message: string | null) => void; readonly workspace: ResultsWorkspace }): React.JSX.Element {
  const hasGroups = workspace.groups.length > 0;
  return <SectionPanel className="results-workspace" id="results-workspace" eyebrow="Paso 5" title={hasGroups ? 'Resultados y fase de grupos' : 'Encuentros y resultados'} status={<Chip size="sm" variant="soft">{workspace.matches.length} encuentros</Chip>}>
    {workspace.matches.length === 0 ? <div className="setup-empty">Los encuentros aparecerán cuando se confirme el sorteo oficial.</div> : hasGroups
      ? <GroupStage actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} onChange={onChange} onError={onError} workspace={workspace} />
      : <div className={styles.knockoutList}>{workspace.matches.map((match) => <MatchCard actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} key={match.id} match={match} onChange={onChange} onError={onError} profile={workspace.resultProfile} />)}</div>}
  </SectionPanel>;
}
