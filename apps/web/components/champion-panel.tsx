'use client';

import { useState } from 'react';

import { confirmChampion, proposeChampion, type ChampionView } from '../lib/champion-api';
import type { DrawWorkspace, ResultsWorkspace } from '../lib/competition-api';

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

  return <section className="setup-card qualification-panel" id="champion-workspace" aria-labelledby="champion-title">
    <div className="section-title"><div><span className="eyebrow eyebrow--dark">Cierre</span><h3 id="champion-title">Campeón de la competencia</h3></div><span>★</span></div>
    {champion === null ? <div className="draw-empty">
      <div><strong>Final resuelta</strong><p>El último resultado confirmado permite proponer al campeón. El servidor verificará nuevamente toda la evidencia antes de registrar la propuesta.</p></div>
      {canOperate ? <button className="primary-button" disabled={submitting !== null} onClick={() => void propose()} type="button">{submitting === 'propose' ? 'Proponiendo…' : 'Proponer campeón'}</button> : <p className="readonly-note">Una autoridad habilitada debe proponer el campeón.</p>}
    </div> : <div className="draw-ready">
      <div className="draw-proof"><span>{champion.status === 'CONFIRMED' ? 'Campeón confirmado' : 'Campeón propuesto'}</span><strong>{champion.participantDisplayName}</strong><small>Ronda {champion.sourceRoundNumber} · evidencia vinculada al resultado final</small></div>
      {champion.status === 'CONFIRMED' ? <div><p className="draw-confirmed-proof">✓ Competencia finalizada oficialmente.</p><a href={`/competitions/${competitionId}/public`}>Ver campeón y recorrido público</a></div> : ownPendingProposal && !canSelfConfirm ? <p className="readonly-note">Otra autoridad debe confirmar al campeón.</p> : canOperate ? <button className="primary-button" disabled={submitting !== null} onClick={() => void confirm()} type="button">{submitting === 'confirm' ? 'Confirmando…' : ownPendingProposal ? 'Confirmar mi propuesta y finalizar' : 'Confirmar campeón y finalizar'}</button> : <p className="readonly-note">Una autoridad habilitada debe confirmar al campeón.</p>}
    </div>}
  </section>;
}
