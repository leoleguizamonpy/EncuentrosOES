'use client';

import { Alert, Button, Card, Chip } from '@heroui/react';
import { type SyntheticEvent, useState } from 'react';

import {
  annulMatchResult,
  confirmGroupQualification,
  confirmMatchResult,
  recordMatchResult,
  type AdministrativeOutcome,
  type GroupQualificationView,
  type MatchResultView,
  type ResultMatchView,
  type ResultsWorkspace,
  type StandingRowView,
} from '../lib/competition-api';
import { DataTable, type DataTableColumn, InlineActions, SectionPanel } from '../ui';
import styles from './results-workspace.module.css';

const statusLabels = {
  PENDING_RESULT: 'Pendiente',
  RESULT_CONFIRMED: 'Confirmado',
  RESULT_PENDING_CONFIRMATION: 'Por confirmar',
} as const;

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
  if (result.detail.profile === 'ADMINISTRATIVE') {
    return <span className={styles.administrativeScore}>{administrativeLabels[result.detail.outcome]}</span>;
  }
  if (result.detail.profile === 'SCORE_BASED') {
    return <span className={styles.scoreValue}>
      <strong>{result.detail.scoreA}</strong><i>—</i><strong>{result.detail.scoreB}</strong>
      {result.detail.tieBreak === undefined ? null : <small>Penales {result.detail.tieBreak.scoreA} — {result.detail.tieBreak.scoreB}</small>}
    </span>;
  }
  return <span className={styles.scoreValue}><strong>{result.resolved.setsWonA}</strong><i>—</i><strong>{result.resolved.setsWonB}</strong><small>sets</small></span>;
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
    event.preventDefault();
    onError(null);
    setSubmitting('record');
    try {
      const detail = entryMode !== 'PLAYED'
        ? { outcome: entryMode, profile: 'ADMINISTRATIVE' as const }
        : profile === 'SET_BASED'
          ? { profile, sets } as const
          : {
              profile: 'SCORE_BASED' as const,
              scoreA,
              scoreB,
              ...(knockout && tiedScore ? { tieBreak: { method: 'PENALTIES' as const, scoreA: penaltiesA, scoreB: penaltiesB } } : {}),
            };
      onChange(await recordMatchResult(match.id, detail));
      setOpen(false);
      setEntryMode('PLAYED');
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible registrar el resultado.');
    } finally {
      setSubmitting(null);
    }
  }

  async function confirm(): Promise<void> {
    if (match.result === null) return;
    onError(null);
    setSubmitting('confirm');
    try {
      onChange(await confirmMatchResult(match.result.id, match.result.revision));
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible confirmar el resultado.');
    } finally {
      setSubmitting(null);
    }
  }

  async function annul(): Promise<void> {
    if (match.result === null || annulmentReason.trim().length < 10) return;
    onError(null);
    setSubmitting('annul');
    try {
      onChange(await annulMatchResult(match.result.id, match.result.revision, annulmentReason.trim()));
      setAnnulmentOpen(false);
      setAnnulmentReason('');
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible anular el resultado.');
    } finally {
      setSubmitting(null);
    }
  }

  const ownPendingResult = match.result?.status === 'PENDING_CONFIRMATION' && match.result.recordedBy.id === actorId;
  const invalidPenaltyTie = entryMode === 'PLAYED' && knockout && tiedScore && penaltiesA === penaltiesB;
  const contextLabel = match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`;

  return <Card className={cx('result-match', styles.matchCard)}>
    <Card.Header>
      <div className={styles.matchContext}><span>{contextLabel}</span><strong>Encuentro {match.ordinal}</strong></div>
      <Chip color={matchStatusColor(match.status)} size="sm" variant="soft">{statusLabels[match.status]}</Chip>
    </Card.Header>
    <Card.Content>
      <div className={styles.scoreboard} aria-label={`${match.participantA.displayName} contra ${match.participantB.displayName}`}>
        <div className={styles.teamSide}><span className={styles.teamIndex}>A</span><b>{match.participantA.displayName}</b></div>
        <div className={styles.scoreCenter}>{match.result === null ? <span className={styles.versus}>VS</span> : <ResultScore result={match.result} />}</div>
        <div className={cx(styles.teamSide, styles.teamSideAway)}><span className={styles.teamIndex}>B</span><b>{match.participantB.displayName}</b></div>
      </div>

      {match.result === null && canOperate ? <div className={styles.entryArea}>
        {!open ? <Button onPress={() => setOpen(true)} variant="secondary">Cargar resultado</Button> : <form className={styles.entryForm} onSubmit={(event) => void record(event)}>
          <div className={styles.entryHeader}><div><span>Registro del encuentro</span><strong>Cargar resultado oficial</strong></div><Chip size="sm" variant="soft">{profile === 'SET_BASED' ? 'Por sets' : 'Por marcador'}</Chip></div>
          <label className={styles.modeField}>Cómo terminó el encuentro
            <select aria-label="Cómo terminó el encuentro" onChange={(event) => setEntryMode(event.target.value as EntryMode)} value={entryMode}>
              <option value="PLAYED">Se disputó normalmente</option>
              <option value="NO_SHOW_A">{match.participantA.displayName} no se presentó</option>
              <option value="NO_SHOW_B">{match.participantB.displayName} no se presentó</option>
              <option value="NO_SHOW_BOTH">Ninguno se presentó</option>
              <option value="WITHDRAWN_A">{match.participantA.displayName} se retiró</option>
              <option value="WITHDRAWN_B">{match.participantB.displayName} se retiró</option>
              <option value="ABANDONED_A">{match.participantA.displayName} abandonó el encuentro</option>
              <option value="ABANDONED_B">{match.participantB.displayName} abandonó el encuentro</option>
            </select>
          </label>

          {entryMode === 'PLAYED' ? profile === 'SET_BASED' ? <div className={styles.setEditor}>
            {sets.map((set, index) => <div className={styles.setRow} key={index}>
              <span className={styles.setLabel}>Set {index + 1}</span>
              <label><span>{match.participantA.displayName}</span><input aria-label={`Set ${String(index + 1)} · ${match.participantA.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsA: Number(event.target.value) } : item))} type="number" value={set.pointsA} /></label>
              <i>—</i>
              <label><span>{match.participantB.displayName}</span><input aria-label={`Set ${String(index + 1)} · ${match.participantB.displayName}`} min="0" onChange={(event) => setSets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pointsB: Number(event.target.value) } : item))} type="number" value={set.pointsB} /></label>
            </div>)}
            <Button isDisabled={sets.length >= 9 || submitting !== null} onPress={() => setSets((current) => [...current, { pointsA: 0, pointsB: 0 }])} size="sm" variant="secondary">Agregar set</Button>
          </div> : <>
            <div className={styles.scoreEditor} aria-label="Marcador reglamentario">
              <label><span>{match.participantA.displayName}</span><input aria-label={`Marcador de ${match.participantA.displayName}`} inputMode="numeric" min="0" onChange={(event) => setScoreA(Number(event.target.value))} type="number" value={scoreA} /></label>
              <span className={styles.scoreDivider}>—</span>
              <label><span>{match.participantB.displayName}</span><input aria-label={`Marcador de ${match.participantB.displayName}`} inputMode="numeric" min="0" onChange={(event) => setScoreB(Number(event.target.value))} type="number" value={scoreB} /></label>
            </div>
            {knockout && tiedScore ? <div className={styles.penaltyEditor}>
              <div><span>Desempate</span><strong>Penales</strong><small>Solo se registra cuando el marcador reglamentario termina empatado.</small></div>
              <div className={styles.scoreEditor}>
                <label><span>{match.participantA.displayName}</span><input aria-label={`Penales de ${match.participantA.displayName}`} inputMode="numeric" min="0" onChange={(event) => setPenaltiesA(Number(event.target.value))} type="number" value={penaltiesA} /></label>
                <span className={styles.scoreDivider}>—</span>
                <label><span>{match.participantB.displayName}</span><input aria-label={`Penales de ${match.participantB.displayName}`} inputMode="numeric" min="0" onChange={(event) => setPenaltiesB(Number(event.target.value))} type="number" value={penaltiesB} /></label>
              </div>
            </div> : null}
          </> : <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Resolución administrativa: {administrativeLabels[entryMode]}. En fase de grupos se asignan 0 puntos al ausente y 3 al presente; si ambos faltan, ambos reciben 0. No se inventan goles ni sets.</Alert.Description></Alert.Content></Alert>}

          {invalidPenaltyTie ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>Los penales deben determinar un ganador.</Alert.Description></Alert.Content></Alert> : null}
          <InlineActions compact><Button isDisabled={submitting !== null || invalidPenaltyTie} type="submit" variant="primary">{submitting === 'record' ? 'Registrando…' : 'Enviar a confirmación'}</Button><Button isDisabled={submitting !== null} onPress={() => { setOpen(false); setEntryMode('PLAYED'); }} type="button" variant="ghost">Cancelar</Button></InlineActions>
        </form>}
      </div> : null}

      {match.result === null ? null : <div className={styles.resultMeta}><span>Registro</span><p>Registrado por <strong>{match.result.recordedBy.displayName}</strong>{match.result.confirmedBy === null ? '' : <> · confirmado por <strong>{match.result.confirmedBy.displayName}</strong></>}</p></div>}

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
    onError(null);
    setSubmitting(true);
    try {
      onChange(await confirmGroupQualification(qualification.id, qualification.revision));
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible confirmar los clasificados.');
    } finally {
      setSubmitting(false);
    }
  }

  const pending = qualification.status === 'PENDING_CONFIRMATION';
  const ownPendingQualification = pending && qualification.proposedBy.id === actorId;
  return <Card className={cx('qualification-panel', styles.qualificationPanel, pending ? styles.qualificationPending : styles.qualificationConfirmed)} aria-label="Clasificación del grupo" variant="tertiary">
    <Card.Header><div><span>{pending ? 'Clasificación propuesta' : 'Clasificación confirmada'}</span><strong>Avance a la siguiente fase</strong></div><Chip color={pending ? 'warning' : 'success'} size="sm" variant="soft">{pending ? 'Pendiente' : 'Oficial'}</Chip></Card.Header>
    <Card.Content><ol><li><span>1.º</span><strong>{qualification.firstParticipant.displayName}</strong></li><li><span>2.º</span><strong>{qualification.secondParticipant.displayName}</strong></li></ol></Card.Content>
    <Card.Footer>Propuesto por {qualification.proposedBy.displayName}{qualification.confirmedBy === null ? '' : ` · confirmado por ${qualification.confirmedBy.displayName}`}</Card.Footer>
    {pending ? ownPendingQualification && !canSelfConfirm ? <p className="readonly-note">Otra autoridad debe confirmar estos clasificados.</p> : canOperate ? <Button isDisabled={submitting} onPress={() => void confirm()} variant="primary">{submitting ? 'Confirmando…' : ownPendingQualification ? 'Confirmar mis clasificados' : 'Confirmar clasificados'}</Button> : <p className="readonly-note">Una autoridad habilitada debe confirmar estos clasificados.</p> : null}
  </Card>;
}

function standingColumns(setBased: boolean): readonly DataTableColumn<StandingRowView>[] {
  const shared: DataTableColumn<StandingRowView>[] = [
    { className: styles.positionColumn ?? '', id: 'position', label: '#', render: (row) => <span className={styles.positionValue}>{row.position}{row.tied ? '=' : ''}</span> },
    { className: styles.participantColumn ?? '', id: 'participant', label: 'Institución', render: (row) => <strong className={styles.participantName}>{row.participant.displayName}</strong> },
    { className: styles.numericColumn ?? '', id: 'played', label: 'PJ', render: (row) => row.played },
    { className: cx(styles.numericColumn, styles.hideMobile), id: 'wins', label: 'G', render: (row) => row.wins },
  ];
  if (!setBased) shared.push({ className: cx(styles.numericColumn, styles.hideTablet), id: 'draws', label: 'E', render: (row) => row.draws });
  shared.push(
    { className: cx(styles.numericColumn, styles.hideMobile), id: 'losses', label: 'P', render: (row) => row.losses },
    { className: styles.pointsColumn ?? '', id: 'points', label: 'PTS', render: (row) => <strong>{row.tablePoints}</strong> },
  );
  if (setBased) {
    shared.push(
      { className: cx(styles.numericColumn, styles.hideMobile), id: 'sets', label: 'SG', render: (row) => row.setsWon },
      { className: styles.differenceColumn ?? '', id: 'difference', label: 'DP', render: (row) => row.sportPointDifference },
    );
  } else {
    shared.push(
      { className: cx(styles.numericColumn, styles.hideTablet), id: 'for', label: 'GF', render: (row) => row.scoreFor },
      { className: cx(styles.numericColumn, styles.hideTablet), id: 'against', label: 'GC', render: (row) => row.scoreAgainst },
      { className: styles.differenceColumn ?? '', id: 'difference', label: 'DG', render: (row) => <span className={styles.differenceValue}>{row.scoreDifference > 0 ? `+${String(row.scoreDifference)}` : row.scoreDifference}</span> },
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
          <div className={styles.groupTitle}><span>Fase de grupos</span><strong>Grupo {group.label}</strong><small>{group.standings.length} participantes</small></div>
          <div className={styles.groupMeta}><span><b>{confirmedMatches}</b> de {matches.length} jugados</span><Chip color={group.complete ? 'success' : 'default'} size="sm" variant="soft">{group.complete ? 'Completo' : 'En curso'}</Chip></div>
        </Card.Header>
        <Card.Content><div className={styles.groupContent}>
          <section className={cx(styles.subsection, styles.standingsSection)} aria-labelledby={`group-${group.id}-standings`}>
            <div className={styles.subsectionHeader}><div className={styles.subsectionTitle}><span>Clasificación</span><strong id={`group-${group.id}-standings`}>Tabla de posiciones</strong></div><Chip color={group.complete ? 'success' : 'default'} size="sm" variant="soft">{group.complete ? 'Tabla final' : 'Tabla parcial'}</Chip></div>
            <DataTable className={styles.standingsTable} columns={standingColumns(setBased)} getRowKey={(row) => row.participant.id} label={`Tabla del grupo ${group.label}`} rows={group.standings} width="wide" />
            {group.standings.length === 0 ? <p className={styles.emptyTable}>La tabla se calculará al confirmar el primer resultado.</p> : null}
            {group.qualification === null ? group.complete ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Description>La tabla tiene un empate sin resolver en el corte de clasificación.</Alert.Description></Alert.Content></Alert> : null : <QualificationPanel actorId={actorId} canOperate={canOperate} canSelfConfirm={canSelfConfirm} onChange={onChange} onError={onError} qualification={group.qualification} />}
          </section>

          <section className={cx(styles.subsection, styles.resultsSection)} aria-labelledby={`group-${group.id}-matches`}>
            <div className={styles.subsectionHeader}><div className={styles.subsectionTitle}><span>Resultados</span><strong id={`group-${group.id}-matches`}>Encuentros del grupo</strong></div><span className={styles.matchCount}>{matches.length} {matches.length === 1 ? 'partido' : 'partidos'}</span></div>
            <div className={styles.matchList}>{matches.map((match) => <MatchCard actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} key={match.id} match={match} onChange={onChange} onError={onError} profile={workspace.resultProfile} />)}</div>
          </section>
        </div></Card.Content>
      </Card>;
    })}
  </div>;
}

export function ResultsWorkspacePanel({ actorId, canAnnul, canOperate, canSelfConfirm = false, onChange, onError, workspace }: {
  readonly actorId: string;
  readonly canAnnul: boolean;
  readonly canOperate: boolean;
  readonly canSelfConfirm?: boolean;
  readonly onChange: (workspace: ResultsWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly workspace: ResultsWorkspace;
}): React.JSX.Element {
  const hasGroups = workspace.groups.length > 0;
  return <SectionPanel className="results-workspace" id="results-workspace" eyebrow="Paso 5" title={hasGroups ? 'Resultados y fase de grupos' : 'Encuentros y resultados'} status={<Chip size="sm" variant="soft">{workspace.matches.length} encuentros</Chip>}>
    {workspace.matches.length === 0 ? <div className="setup-empty">Los encuentros aparecerán cuando se confirme el sorteo oficial.</div> : hasGroups
      ? <GroupStage actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} onChange={onChange} onError={onError} workspace={workspace} />
      : <div className={styles.knockoutList}>{workspace.matches.map((match) => <MatchCard actorId={actorId} canAnnul={canAnnul} canOperate={canOperate} canSelfConfirm={canSelfConfirm} key={match.id} match={match} onChange={onChange} onError={onError} profile={workspace.resultProfile} />)}</div>}
  </SectionPanel>;
}
