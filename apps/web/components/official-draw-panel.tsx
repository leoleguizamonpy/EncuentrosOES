'use client';

import { useState } from 'react';

import {
  confirmOfficialDraw,
  executeOfficialDraw,
  prepareOfficialDraw,
  type CompetitionDetail,
  type DrawWorkspace,
  type OfficialDrawResult,
} from '../lib/competition-api';

function DrawResult({ result }: { readonly result: OfficialDrawResult }): React.JSX.Element {
  if (result.formatCode === 'GROUP_STAGE') return (
    <div className="draw-groups">
      {result.groups.map((group) => <article key={group.label}><header><span>Grupo</span><strong>{group.label}</strong></header><ol>{group.members.map((member, index) => <li key={member.id}><span>{String(index + 1).padStart(2, '0')}</span>{member.displayName}</li>)}</ol></article>)}
    </div>
  );
  return (
    <div className="draw-pairings">
      {result.pairings.map((pairing) => <article key={pairing.ordinal}><span>Cruce {pairing.ordinal}</span><strong>{pairing.participantA.displayName}</strong><i>VS</i><strong>{pairing.participantB.displayName}</strong></article>)}
      {result.bye === null ? null : <article className="draw-bye"><span>Pase libre</span><strong>{result.bye.participant.displayName}</strong><small>Historial previo: {result.bye.priorByeCount}</small></article>}
    </div>
  );
}

export function OfficialDrawPanel({
  actorId,
  canOperate,
  detail,
  onChange,
  onError,
  workspace,
}: {
  readonly actorId: string;
  readonly canOperate: boolean;
  readonly detail: CompetitionDetail;
  readonly onChange: (workspace: DrawWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly workspace: DrawWorkspace;
}): React.JSX.Element {
  const [action, setAction] = useState<'confirm' | 'execute' | 'prepare' | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const configuration = workspace.configuration;
  const execution = workspace.execution;
  const readyToPrepare = detail.formatCode !== null && detail.ruleSet?.status === 'FROZEN';
  const canPrepare = canOperate && (workspace.competitionStatus === 'DRAFT' || workspace.competitionStatus === 'OPEN');
  const sameExecutor = execution?.executedBy.id === actorId;

  async function run(kind: 'confirm' | 'execute' | 'prepare'): Promise<void> {
    onError(null);
    setAction(kind);
    try {
      const next = kind === 'prepare'
        ? await prepareOfficialDraw(detail.id, workspace.competitionRevision)
        : kind === 'execute'
          ? await executeOfficialDraw(configuration?.id ?? '', configuration?.revision ?? 0)
          : await confirmOfficialDraw(execution?.id ?? '', execution?.revision ?? 0);
      onChange(next);
      setConfirmLock(false);
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible completar la operación del sorteo.');
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="setup-card official-draw-card" aria-labelledby="official-draw-title">
      <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 4</span><h3 id="official-draw-title">Sorteo oficial</h3></div><span>04</span></div>
      {configuration === null ? (
        <div className="draw-empty">
          <div><strong>Preparar y bloquear</strong><p>Congela participantes, formato y reglas en una configuración verificable. Después de este punto ya no podrán editarse.</p></div>
          {!readyToPrepare ? <p className="readonly-note">Guarda el formato y congela la plantilla de puntuación antes de preparar el sorteo.</p> : !canPrepare ? <p className="readonly-note">Tu rol o el estado actual solo permiten consultar el sorteo.</p> : !confirmLock ? <button className="primary-button" onClick={() => setConfirmLock(true)} type="button">Preparar sorteo oficial</button> : <div className="freeze-confirm"><p>El bloqueo es irreversible para esta ejecución. Verifica participantes, formato y reglas antes de continuar.</p><button disabled={action !== null} onClick={() => void run('prepare')} type="button">{action === 'prepare' ? 'Preparando…' : 'Confirmar y bloquear'}</button><button disabled={action !== null} onClick={() => setConfirmLock(false)} type="button">Cancelar</button></div>}
        </div>
      ) : execution === null ? (
        <div className="draw-ready">
          <div className="draw-proof"><span>Configuración congelada</span><strong>{configuration.formatCode === 'GROUP_STAGE' ? `${String(configuration.groupCount)} grupo(s)` : `Ronda ${String(configuration.roundNumber)}`}</strong><small>{configuration.participantCount} participantes · Hash {configuration.canonicalHash}</small></div>
          {canOperate ? <button className="primary-button" disabled={action !== null} onClick={() => void run('execute')} type="button">{action === 'execute' ? 'Ejecutando…' : 'Ejecutar sorteo'}</button> : <p className="readonly-note">Esperando que una autoridad ejecute el sorteo.</p>}
        </div>
      ) : (
        <div className="draw-result">
          <div className="draw-result__heading"><div><span>{execution.status === 'CONFIRMED' ? 'Sorteo confirmado' : 'Pendiente de confirmación'}</span><strong>Ejecutado por {execution.executedBy.displayName}</strong></div><small>{new Date(execution.executedAt).toLocaleString('es-PY')}</small></div>
          <DrawResult result={execution.result} />
          <div className="draw-evidence"><span>Hash de evidencia</span><code>{execution.evidenceHash}</code><span>Compromiso de semilla</span><code>{execution.seedCommitment}</code>{execution.seedHex === null ? null : <><span>Semilla revelada</span><code>{execution.seedHex}</code></>}</div>
          {execution.status === 'CONFIRMED' ? <p className="draw-confirmed-proof">✓ Se generaron {execution.matchCount} encuentros automáticamente.</p> : sameExecutor ? <p className="readonly-note">La autoridad que ejecutó el sorteo no puede confirmarlo. Debe ingresar otro administrador o el superadministrador.</p> : canOperate ? <button className="primary-button" disabled={action !== null} onClick={() => void run('confirm')} type="button">{action === 'confirm' ? 'Confirmando…' : 'Confirmar sorteo y generar encuentros'}</button> : <p className="readonly-note">Esperando confirmación de una autoridad independiente.</p>}
        </div>
      )}
    </section>
  );
}
