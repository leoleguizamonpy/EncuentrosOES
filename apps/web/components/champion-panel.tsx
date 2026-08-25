'use client';

import { Alert, Button, Card, Chip } from '@heroui/react';
import { useState } from 'react';

import { confirmChampion, proposeChampion, type ChampionView } from '../lib/champion-api';
import type { DrawWorkspace, ResultsWorkspace } from '../lib/competition-api';
import { SectionPanel } from '../ui';

function finalReady(draw: DrawWorkspace, results: ResultsWorkspace): boolean {
  const configuration = draw.configuration;
  const execution = draw.execution;
  if (
    configuration?.formatCode !== 'KNOCKOUT' ||
    execution?.status !== 'CONFIRMED' ||
    execution.result.formatCode !== 'KNOCKOUT' ||
    execution.result.bye !== null ||
    execution.result.pairings.length !== 1
  ) return false;
  const roundMatches = results.matches.filter((match) => match.roundNumber === configuration.roundNumber);
  return roundMatches.length === 1 && roundMatches[0]?.status === 'RESULT_CONFIRMED' && roundMatches[0].winnerParticipantId !== null;
}

export function ChampionPanel({
  actorId,
  canOperate,
  canSelfConfirm = false,
  champion,
  competitionId,
  draw,
  onChange,
  onError,
  results,
}: {
  readonly actorId: string;
  readonly canOperate: boolean;
  readonly canSelfConfirm?: boolean;
  readonly champion: ChampionView | null;
  readonly competitionId: string;
  readonly draw: DrawWorkspace;
  readonly onChange: (champion: ChampionView) => void;
  readonly onError: (message: string | null) => void;
  readonly results: ResultsWorkspace;
}): React.JSX.Element | null {
  const [submitting, setSubmitting] = useState<'confirm' | 'propose' | null>(null);
  const ready = finalReady(draw, results);
  if (!ready && champion === null) return null;

  async function propose(): Promise<void> {
    onError(null); setSubmitting('propose');
    try { onChange(await proposeChampion(competitionId, draw.competitionRevision)); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible proponer al campeón.'); }
    finally { setSubmitting(null); }
  }

  async function confirm(): Promise<void> {
    if (champion === null) return;
    onError(null); setSubmitting('confirm');
    try { onChange(await confirmChampion(competitionId, champion.proposalId, champion.competitionRevision)); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible confirmar al campeón.'); }
    finally { setSubmitting(null); }
  }

  const ownPendingProposal = champion?.status === 'PENDING_CONFIRMATION' && champion.proposedBy === actorId;

  return <SectionPanel className="champion-panel" id="champion-workspace" eyebrow="Cierre" title="Campeón de la competencia" status={<Chip color={champion?.status === 'CONFIRMED' ? 'success' : 'accent'} size="sm" variant="soft">★</Chip>}>
    {champion === null ? <div className="draw-empty">
      <div><strong>Final resuelta</strong><p>El último resultado confirmado permite proponer al campeón. El servidor verificará nuevamente toda la evidencia antes de registrar la propuesta.</p></div>
      {canOperate ? <Button isDisabled={submitting !== null} onPress={() => void propose()} variant="primary">{submitting === 'propose' ? 'Proponiendo…' : 'Proponer campeón'}</Button> : <p className="readonly-note">Una autoridad habilitada debe proponer el campeón.</p>}
    </div> : <div className="draw-ready">
      <Card variant="tertiary"><Card.Content className="draw-proof"><span>{champion.status === 'CONFIRMED' ? 'Campeón confirmado' : 'Campeón propuesto'}</span><strong>{champion.participantDisplayName}</strong><small>Ronda {champion.sourceRoundNumber} · evidencia vinculada al resultado final</small></Card.Content></Card>
      {champion.status === 'CONFIRMED' ? <Alert status="success"><Alert.Indicator /><Alert.Content><Alert.Title>Competencia finalizada oficialmente</Alert.Title><Alert.Description><a href={`/competitions/${competitionId}/public`}>Ver campeón y recorrido público</a></Alert.Description></Alert.Content></Alert> : ownPendingProposal && !canSelfConfirm ? <p className="readonly-note">Otra autoridad debe confirmar al campeón.</p> : canOperate ? <Button isDisabled={submitting !== null} onPress={() => void confirm()} variant="primary">{submitting === 'confirm' ? 'Confirmando…' : ownPendingProposal ? 'Confirmar mi propuesta y finalizar' : 'Confirmar campeón y finalizar'}</Button> : <p className="readonly-note">Una autoridad habilitada debe confirmar al campeón.</p>}
    </div>}
  </SectionPanel>;
}
