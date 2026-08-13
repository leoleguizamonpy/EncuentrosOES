'use client';

import { useState } from 'react';

import {
  annulOfficialDraw,
  confirmOfficialDraw,
  executeOfficialDraw,
  prepareOfficialDraw,
  publishOfficialDraw,
  publicDrawActUrl,
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
  canAnnul,
  canOperate,
  detail,
  onChange,
  onError,
  workspace,
}: {
  readonly actorId: string;
  readonly canAnnul: boolean;
  readonly canOperate: boolean;
  readonly detail: CompetitionDetail;
  readonly onChange: (workspace: DrawWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly workspace: DrawWorkspace;
}): React.JSX.Element {
  const [action, setAction] = useState<'annul' | 'confirm' | 'execute' | 'prepare' | 'publish' | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [annulmentOpen, setAnnulmentOpen] = useState(false);
  const [annulmentReason, setAnnulmentReason] = useState('');
  const configuration = workspace.configuration;
  const execution = workspace.execution;
  const readyToPrepare = detail.formatCode !== null && detail.ruleSet?.status === 'FROZEN';
  const canPrepare = canOperate && (workspace.competitionStatus === 'DRAFT' || workspace.competitionStatus === 'OPEN');
  const sameExecutor = execution?.executedBy.id === actorId;

  async function run(kind: 'confirm' | 'execute' | 'prepare' | 'publish'): Promise<void> {
    onError(null);
    setAction(kind);
    try {
      const next = kind === 'prepare'
        ? await prepareOfficialDraw(detail.id, workspace.competitionRevision)
        : kind === 'execute'
          ? await executeOfficialDraw(configuration?.id ?? '', configuration?.revision ?? 0)
          : kind === 'confirm'
            ? await confirmOfficialDraw(execution?.id ?? '', execution?.revision ?? 0)
            : await publishOfficialDraw(execution?.id ?? '', execution?.revision ?? 0);
      onChange(next);
      setConfirmLock(false);
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible completar la operación del sorteo.');
    } finally {
      setAction(null);
    }
  }

  async function annul(): Promise<void> {
    if (execution === null || annulmentReason.trim().length < 10) return;
    onError(null);
    setAction('annul');
    try {
      const next = await annulOfficialDraw(execution.id, execution.revision, annulmentReason.trim());
      onChange(next);
      setAnnulmentOpen(false);
      setAnnulmentReason('');
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : 'No fue posible anular el sorteo oficial.');
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="setup-card official-draw-card" id="official-draw-workspace" aria-labelledby="official-draw-title">
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
          {execution.status === 'CONFIRMED' ? <>
            <p className="draw-confirmed-proof">✓ Se generaron {execution.matchCount} encuentros automáticamente.</p>
            {workspace.publication === null ? canOperate ? <button className="primary-button" disabled={action !== null} onClick={() => void run('publish')} type="button">{action === 'publish' ? 'Publicando…' : 'Publicar sorteo y acta'}</button> : <p className="readonly-note">Esperando que una autoridad publique el sorteo.</p> : <div className="draw-publication-proof"><strong>Publicado y verificable</strong><code>{workspace.publication.verificationCode}</code><div><a href={`/draws/${workspace.publication.id}`}>Abrir vista pública</a><a href={publicDrawActUrl(workspace.publication.id)}>Descargar acta JSON</a></div></div>}
            {canAnnul ? <div className="draw-annulment">
              {!annulmentOpen ? <button className="danger-button" disabled={action !== null} onClick={() => setAnnulmentOpen(true)} type="button">Anular sorteo oficial</button> : <div className="draw-annulment__form">
                <strong>Esta acción revoca la publicación y conserva el historial.</strong>
                <label htmlFor={`annulment-reason-${execution.id}`}>Motivo formal de anulación</label>
                <textarea id={`annulment-reason-${execution.id}`} maxLength={500} minLength={10} onChange={(event) => setAnnulmentReason(event.target.value)} placeholder="Explica el error que obliga a reemplazar este sorteo…" value={annulmentReason} />
                <small>{annulmentReason.trim().length}/500 · mínimo 10 caracteres</small>
                <div><button className="danger-button" disabled={action !== null || annulmentReason.trim().length < 10} onClick={() => void annul()} type="button">{action === 'annul' ? 'Anulando…' : 'Confirmar anulación'}</button><button disabled={action !== null} onClick={() => { setAnnulmentOpen(false); setAnnulmentReason(''); }} type="button">Cancelar</button></div>
              </div>}
            </div> : null}
          </> : sameExecutor ? <p className="readonly-note">La autoridad que ejecutó el sorteo no puede confirmarlo. Debe ingresar otro administrador o el superadministrador.</p> : canOperate ? <button className="primary-button" disabled={action !== null} onClick={() => void run('confirm')} type="button">{action === 'confirm' ? 'Confirmando…' : 'Confirmar sorteo y generar encuentros'}</button> : <p className="readonly-note">Esperando confirmación de una autoridad independiente.</p>}
        </div>
      )}
    </section>
  );
}
