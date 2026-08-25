'use client';

import { Alert, Button, Card, Chip } from '@heroui/react';
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
import { InlineActions, SectionPanel } from '../ui';

function DrawResult({ result }: { readonly result: OfficialDrawResult }): React.JSX.Element {
  if (result.formatCode === 'GROUP_STAGE') return (
    <div className="draw-groups">
      {result.groups.map((group) => <Card key={group.label}><Card.Header><span>Grupo</span><strong>{group.label}</strong></Card.Header><Card.Content><ol>{group.members.map((member, index) => <li key={member.id}><span>{String(index + 1).padStart(2, '0')}</span>{member.displayName}</li>)}</ol></Card.Content></Card>)}
    </div>
  );
  return (
    <div className="draw-pairings">
      {result.pairings.map((pairing) => <Card key={pairing.ordinal}><Card.Content><span>Cruce {pairing.ordinal}</span><strong>{pairing.participantA.displayName}</strong><i>VS</i><strong>{pairing.participantB.displayName}</strong></Card.Content></Card>)}
      {result.bye === null ? null : <Card className="draw-bye"><Card.Content><span>Pase libre</span><strong>{result.bye.participant.displayName}</strong><small>Historial previo: {result.bye.priorByeCount}</small></Card.Content></Card>}
    </div>
  );
}

export function OfficialDrawPanel({
  actorId,
  canAnnul,
  canOperate,
  canSelfConfirm = false,
  detail,
  onChange,
  onError,
  workspace,
}: {
  readonly actorId: string;
  readonly canAnnul: boolean;
  readonly canOperate: boolean;
  readonly canSelfConfirm?: boolean;
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
  const requiresIndependentConfirmer = sameExecutor && !canSelfConfirm;

  async function run(kind: 'confirm' | 'execute' | 'prepare' | 'publish'): Promise<void> {
    onError(null); setAction(kind);
    try {
      const next = kind === 'prepare'
        ? await prepareOfficialDraw(detail.id, detail.revision)
        : kind === 'execute'
          ? await executeOfficialDraw(configuration?.id ?? '', configuration?.revision ?? 0)
          : kind === 'confirm'
            ? await confirmOfficialDraw(execution?.id ?? '', execution?.revision ?? 0)
            : await publishOfficialDraw(execution?.id ?? '', execution?.revision ?? 0);
      onChange(next); setConfirmLock(false);
    } catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible completar la operación del sorteo.'); }
    finally { setAction(null); }
  }

  async function annul(): Promise<void> {
    if (execution === null || annulmentReason.trim().length < 10) return;
    onError(null); setAction('annul');
    try { const next = await annulOfficialDraw(execution.id, execution.revision, annulmentReason.trim()); onChange(next); setAnnulmentOpen(false); setAnnulmentReason(''); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible anular el sorteo oficial.'); }
    finally { setAction(null); }
  }

  const drawState = execution === null ? configuration === null ? 'Sin preparar' : 'Preparado' : execution.status === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar';
  const drawColor = execution?.status === 'CONFIRMED' ? 'success' : execution === null && configuration !== null ? 'accent' : 'warning';

  return <SectionPanel id="official-draw-workspace" eyebrow="Paso 4" title="Sorteo oficial" status={<Chip color={drawColor} size="sm" variant="soft">{drawState}</Chip>}>
    {configuration === null ? <div className="draw-empty">
      <div><strong>Preparar y bloquear</strong><p>Congela participantes, formato y reglas en una configuración verificable. Después de este punto ya no podrán editarse.</p></div>
      {!readyToPrepare ? <p className="readonly-note">Guarda el formato y congela la plantilla de puntuación antes de preparar el sorteo.</p> : !canPrepare ? <p className="readonly-note">Tu rol o el estado actual solo permiten consultar el sorteo.</p> : !confirmLock ? <Button onPress={() => setConfirmLock(true)} variant="primary">Preparar sorteo oficial</Button> : <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Title>Bloqueo irreversible para esta ejecución</Alert.Title><Alert.Description>Verifica participantes, formato y reglas antes de continuar.</Alert.Description><InlineActions compact><Button isDisabled={action !== null} onPress={() => void run('prepare')} size="sm" variant="primary">{action === 'prepare' ? 'Preparando…' : 'Confirmar y bloquear'}</Button><Button isDisabled={action !== null} onPress={() => setConfirmLock(false)} size="sm" variant="ghost">Cancelar</Button></InlineActions></Alert.Content></Alert>}
    </div> : execution === null ? <div className="draw-ready">
      <Card variant="tertiary"><Card.Content className="draw-proof"><span>Configuración congelada</span><strong>{configuration.formatCode === 'GROUP_STAGE' ? `${String(configuration.groupCount)} grupo(s)` : `Ronda ${String(configuration.roundNumber)}`}</strong><small>{configuration.participantCount} participantes · Hash {configuration.canonicalHash}</small></Card.Content></Card>
      {canOperate ? <Button isDisabled={action !== null} onPress={() => void run('execute')} variant="primary">{action === 'execute' ? 'Ejecutando…' : 'Ejecutar sorteo'}</Button> : <p className="readonly-note">Esperando que una autoridad ejecute el sorteo.</p>}
    </div> : <div className="draw-result">
      <div className="draw-result__heading"><div><span>{execution.status === 'CONFIRMED' ? 'Sorteo confirmado' : 'Pendiente de confirmación'}</span><strong>Ejecutado por {execution.executedBy.displayName}</strong></div><small>{new Date(execution.executedAt).toLocaleString('es-PY')}</small></div>
      <DrawResult result={execution.result} />
      <Card variant="tertiary"><Card.Content className="draw-evidence"><span>Hash de evidencia</span><code>{execution.evidenceHash}</code><span>Compromiso de semilla</span><code>{execution.seedCommitment}</code>{execution.seedHex === null ? null : <><span>Semilla revelada</span><code>{execution.seedHex}</code></>}</Card.Content></Card>
      {execution.status === 'CONFIRMED' ? <>
        <Alert status="success"><Alert.Indicator /><Alert.Content><Alert.Description>Se generaron {execution.matchCount} encuentros automáticamente.</Alert.Description></Alert.Content></Alert>
        {workspace.publication === null ? canOperate ? <Button isDisabled={action !== null} onPress={() => void run('publish')} variant="primary">{action === 'publish' ? 'Publicando…' : 'Publicar sorteo y acta'}</Button> : <p className="readonly-note">Esperando que una autoridad publique el sorteo.</p> : <Card variant="tertiary"><Card.Content className="draw-publication-proof"><strong>Publicado y verificable</strong><code>{workspace.publication.verificationCode}</code><div><a href={`/draws/${workspace.publication.id}`}>Abrir vista pública</a><a href={publicDrawActUrl(workspace.publication.id)}>Descargar acta JSON</a></div></Card.Content></Card>}
        {canAnnul ? <div className="draw-annulment">{!annulmentOpen ? <Button isDisabled={action !== null} onPress={() => setAnnulmentOpen(true)} variant="secondary">Anular sorteo oficial</Button> : <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Title>Esta acción revoca la publicación y conserva el historial.</Alert.Title><label htmlFor={`annulment-reason-${execution.id}`}>Motivo formal de anulación</label><textarea id={`annulment-reason-${execution.id}`} maxLength={500} minLength={10} onChange={(event) => setAnnulmentReason(event.target.value)} placeholder="Explica el error que obliga a reemplazar este sorteo…" value={annulmentReason} /><small>{annulmentReason.trim().length}/500 · mínimo 10 caracteres</small><InlineActions compact><Button isDisabled={action !== null || annulmentReason.trim().length < 10} onPress={() => void annul()} size="sm" variant="primary">{action === 'annul' ? 'Anulando…' : 'Confirmar anulación'}</Button><Button isDisabled={action !== null} onPress={() => { setAnnulmentOpen(false); setAnnulmentReason(''); }} size="sm" variant="ghost">Cancelar</Button></InlineActions></Alert.Content></Alert>}</div> : null}
      </> : requiresIndependentConfirmer ? <p className="readonly-note">Un administrador no puede confirmar el mismo sorteo que ejecutó. Debe ingresar otra autoridad.</p> : canOperate ? <Button isDisabled={action !== null} onPress={() => void run('confirm')} variant="primary">{action === 'confirm' ? 'Confirmando…' : sameExecutor ? 'Confirmar mi sorteo y generar encuentros' : 'Confirmar sorteo y generar encuentros'}</Button> : <p className="readonly-note">Esperando confirmación de una autoridad habilitada.</p>}
    </div>}
  </SectionPanel>;
}
