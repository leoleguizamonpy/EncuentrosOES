'use client';

import { Alert, Button, Chip } from '@heroui/react';
import { type SyntheticEvent, useEffect, useState } from 'react';

import {
  freezeCompetitionRuleSet,
  saveCompetitionRuleSet,
  type CompetitionDetail,
  type RuleSetConfiguration,
  type ScoreTieBreakCriterion,
  type SetTieBreakCriterion,
} from '../lib/competition-api';
import { InlineActions, SectionPanel } from '../ui';
import styles from './competition-rules-panel.module.css';

type Criterion = ScoreTieBreakCriterion | SetTieBreakCriterion;

const scoreCriteria: readonly Criterion[] = ['TABLE_POINTS', 'WINS', 'HEAD_TO_HEAD_TABLE_POINTS', 'SCORE_DIFFERENCE', 'SCORE_FOR'];
const setProfileCriteria: readonly Criterion[] = ['TABLE_POINTS', 'WINS', 'HEAD_TO_HEAD_TABLE_POINTS', 'SET_DIFFERENCE', 'SETS_WON', 'SPORT_POINT_DIFFERENCE', 'SPORT_POINTS_FOR'];
const labels: Readonly<Record<Criterion, string>> = {
  HEAD_TO_HEAD_TABLE_POINTS: 'Enfrentamiento directo',
  SCORE_DIFFERENCE: 'Diferencia de anotaciones',
  SCORE_FOR: 'Anotaciones a favor',
  SETS_WON: 'Sets ganados',
  SET_DIFFERENCE: 'Diferencia de sets',
  SPORT_POINTS_FOR: 'Puntos deportivos a favor',
  SPORT_POINT_DIFFERENCE: 'Diferencia de puntos deportivos',
  TABLE_POINTS: 'Puntos de tabla',
  WINS: 'Victorias',
};

function initialCriteria(profile: 'SCORE_BASED' | 'SET_BASED'): Criterion[] {
  return [...(profile === 'SCORE_BASED' ? scoreCriteria : setProfileCriteria)];
}

export function CompetitionRulesPanel({
  canEdit,
  detail,
  onChange,
  onError,
}: {
  readonly canEdit: boolean;
  readonly detail: CompetitionDetail;
  readonly onChange: (detail: CompetitionDetail) => void;
  readonly onError: (message: string | null) => void;
}): React.JSX.Element {
  const [profile, setProfile] = useState<'SCORE_BASED' | 'SET_BASED'>('SCORE_BASED');
  const [allowDraws, setAllowDraws] = useState(true);
  const [winPoints, setWinPoints] = useState(3);
  const [drawPoints, setDrawPoints] = useState(1);
  const [lossPoints, setLossPoints] = useState(0);
  const [setsToWin, setSetsToWin] = useState(3);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria('SCORE_BASED'));
  const [submitting, setSubmitting] = useState<'freeze' | 'save' | null>(null);
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  useEffect(() => {
    const rules = detail.ruleSet;
    if (rules === null) return;
    setProfile(rules.resultProfile);
    setWinPoints(rules.winPoints);
    setLossPoints(rules.lossPoints);
    setCriteria([...rules.tieBreakCriteria]);
    if (rules.resultProfile === 'SCORE_BASED') {
      setAllowDraws(rules.allowDraws);
      setDrawPoints(rules.drawPoints ?? 0);
    } else {
      setSetsToWin(rules.setsToWin);
    }
  }, [detail.ruleSet]);

  const frozen = detail.ruleSet?.status === 'FROZEN';
  const frozenEvidenceHash = detail.ruleSet?.canonicalHash ?? 'No disponible';
  const allowedCriteria = profile === 'SCORE_BASED' ? scoreCriteria : setProfileCriteria;

  function changeProfile(next: 'SCORE_BASED' | 'SET_BASED'): void {
    setProfile(next);
    setCriteria(initialCriteria(next));
  }

  function toggleCriterion(criterion: Criterion): void {
    if (criterion === 'TABLE_POINTS') return;
    setCriteria((current) => current.includes(criterion) ? current.filter((candidate) => candidate !== criterion) : [...current, criterion]);
  }

  function moveCriterion(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (index <= 0 || target <= 0 || target >= criteria.length) return;
    setCriteria((current) => {
      const next = [...current];
      const currentCriterion = next[index];
      const targetCriterion = next[target];
      if (currentCriterion === undefined || targetCriterion === undefined) return current;
      next[index] = targetCriterion;
      next[target] = currentCriterion;
      return next;
    });
  }

  async function save(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault();
    onError(null);
    setSubmitting('save');
    try {
      const configuration: RuleSetConfiguration = profile === 'SCORE_BASED'
        ? { allowDraws, drawPoints: allowDraws ? drawPoints : null, lossPoints, resultProfile: profile, tieBreakCriteria: criteria as ScoreTieBreakCriterion[], winPoints }
        : { lossPoints, resultProfile: profile, setsToWin, tieBreakCriteria: criteria as SetTieBreakCriterion[], winPoints };
      onChange(await saveCompetitionRuleSet(detail.id, { ...configuration, expectedRevision: detail.ruleSet?.revision ?? null }));
      setConfirmFreeze(false);
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible guardar las reglas.');
    } finally {
      setSubmitting(null);
    }
  }

  async function freeze(): Promise<void> {
    if (detail.ruleSet === null) return;
    onError(null);
    setSubmitting('freeze');
    try {
      onChange(await freezeCompetitionRuleSet(detail.id, detail.ruleSet.revision));
      setConfirmFreeze(false);
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible congelar las reglas.');
    } finally {
      setSubmitting(null);
    }
  }

  const stateLabel = detail.ruleSet === null ? 'Sin configurar' : detail.ruleSet.status === 'FROZEN' ? 'Congelada' : 'Borrador';
  const stateColor = detail.ruleSet?.status === 'FROZEN' ? 'success' : detail.ruleSet === null ? 'default' : 'warning';

  return <SectionPanel className={styles.panel ?? ''} eyebrow="Paso 3" title="Puntuación y desempates" status={<Chip color={stateColor} size="sm" variant="soft">{stateLabel}</Chip>}>
    <div className={styles.intro ?? ''}>
      <strong>Reglas deportivas de {detail.sport.name}</strong>
      <p>La puntuación, la clasificación y los desempates se calculan exclusivamente desde esta plantilla. Una vez congelada queda como evidencia inmutable de la competencia.</p>
    </div>

    <form className={styles.form ?? ''} onSubmit={(event) => void save(event)}>
      <div className={styles.formGrid ?? ''}>
        <section className={styles.block ?? ''} aria-labelledby="scoring-profile-heading">
          <header className={styles.blockHeader ?? ''}>
            <span>Configuración</span>
            <h4 id="scoring-profile-heading">Perfil de puntuación</h4>
            <p>Define cómo se registra un resultado y cuántos puntos aporta a la tabla.</p>
          </header>

          <fieldset className={styles.profileFieldset ?? ''} disabled={!canEdit || frozen || submitting !== null}>
            <legend>Tipo de resultado</legend>
            <label className={styles.profileOption ?? ''}><input checked={profile === 'SCORE_BASED'} name="profile" onChange={() => changeProfile('SCORE_BASED')} type="radio" /> Marcador</label>
            <label className={styles.profileOption ?? ''}><input checked={profile === 'SET_BASED'} name="profile" onChange={() => changeProfile('SET_BASED')} type="radio" /> Sets</label>
          </fieldset>

          <div className={styles.pointsGrid ?? ''}>
            <label>Victoria<input disabled={!canEdit || frozen} min="0" onChange={(event) => setWinPoints(Number(event.target.value))} type="number" value={winPoints} /></label>
            {profile === 'SCORE_BASED' && allowDraws ? <label>Empate<input disabled={!canEdit || frozen} min="0" onChange={(event) => setDrawPoints(Number(event.target.value))} type="number" value={drawPoints} /></label> : null}
            <label>Derrota<input disabled={!canEdit || frozen} min="0" onChange={(event) => setLossPoints(Number(event.target.value))} type="number" value={lossPoints} /></label>
            {profile === 'SET_BASED' ? <label>Sets para ganar<input disabled={!canEdit || frozen} min="1" onChange={(event) => setSetsToWin(Number(event.target.value))} type="number" value={setsToWin} /></label> : null}
          </div>

          {profile === 'SCORE_BASED' ? <label className={styles.drawToggle ?? ''}><input checked={allowDraws} disabled={!canEdit || frozen} onChange={(event) => setAllowDraws(event.target.checked)} type="checkbox" /> Permitir empates</label> : null}
        </section>

        <section className={styles.block ?? ''} aria-labelledby="tie-break-heading">
          <header className={styles.blockHeader ?? ''}>
            <span>Prioridad</span>
            <h4 id="tie-break-heading">Orden de desempate</h4>
            <p>Los criterios activos se aplican de arriba hacia abajo. Puntos de tabla siempre ocupa la primera posición.</p>
          </header>

          <div className={styles.availableCriteria ?? ''} aria-label="Criterios disponibles">
            {allowedCriteria.map((criterion) => <label className={styles.criterionToggle ?? ''} key={criterion}><input checked={criteria.includes(criterion)} disabled={!canEdit || frozen || criterion === 'TABLE_POINTS'} onChange={() => toggleCriterion(criterion)} type="checkbox" /> {labels[criterion]}</label>)}
          </div>

          <ol className={styles.criteriaOrder ?? ''} aria-label="Prioridad de criterios de desempate">
            {criteria.map((criterion, index) => <li key={criterion}>
              <span className={styles.orderNumber ?? ''}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{labels[criterion]}</strong>
              {index === 0 || frozen || !canEdit ? null : <span className={styles.criterionActions ?? ''}>
                <button aria-label={`Subir ${labels[criterion]}`} disabled={index === 1} onClick={() => moveCriterion(index, -1)} type="button">↑</button>
                <button aria-label={`Bajar ${labels[criterion]}`} disabled={index === criteria.length - 1} onClick={() => moveCriterion(index, 1)} type="button">↓</button>
              </span>}
            </li>)}
          </ol>
        </section>
      </div>

      {frozen ? <div className={styles.lockEvidence ?? ''} role="status">
        <strong>Plantilla inmutable</strong>
        <p>La configuración está congelada y ya no puede modificarse. El hash permite verificar que esta evidencia no cambió.</p>
        <details><summary>Ver hash verificable</summary><code>{frozenEvidenceHash}</code></details>
      </div> : !canEdit ? <p className="readonly-note">Tu rol solo permite consultar la plantilla.</p> : <div className={styles.actions ?? ''}>
        <InlineActions>
          <Button isDisabled={submitting !== null} type="submit" variant="primary">{submitting === 'save' ? 'Guardando…' : detail.ruleSet === null ? 'Guardar plantilla' : 'Actualizar borrador'}</Button>
          {detail.ruleSet === null ? null : !confirmFreeze ? <Button isDisabled={submitting !== null} onPress={() => setConfirmFreeze(true)} type="button" variant="secondary">Congelar reglas</Button> : null}
        </InlineActions>
        {confirmFreeze ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Title>Congelamiento irreversible</Alert.Title><Alert.Description>Después no se podrán cambiar puntos ni desempates.</Alert.Description><InlineActions compact><Button isDisabled={submitting !== null} onPress={() => void freeze()} size="sm" variant="primary">{submitting === 'freeze' ? 'Congelando…' : 'Confirmar congelamiento'}</Button><Button isDisabled={submitting !== null} onPress={() => setConfirmFreeze(false)} size="sm" variant="ghost">Cancelar</Button></InlineActions></Alert.Content></Alert> : null}
      </div>}
    </form>
  </SectionPanel>;
}
