'use client';

import { Button, Card, Chip } from '@heroui/react';
import { useState } from 'react';

import { drawWorkspace, type DrawWorkspace, type ResultsWorkspace } from '../lib/competition-api';
import { prepareNextRound } from '../lib/continuity-api';

function readyForNextRound(draw: DrawWorkspace, results: ResultsWorkspace): boolean {
  if (draw.execution?.status !== 'CONFIRMED' || results.matches.length === 0) return false;
  if (draw.configuration?.formatCode === 'GROUP_STAGE') {
    return results.groups.length > 0 && results.groups.every((group) => group.qualification?.status === 'CONFIRMED');
  }
  return results.matches.every((match) => match.status === 'RESULT_CONFIRMED' && match.winnerParticipantId !== null);
}

export function NextRoundPanel({
  canOperate,
  competitionId,
  draw,
  onChange,
  onError,
  results,
}: {
  readonly canOperate: boolean;
  readonly competitionId: string;
  readonly draw: DrawWorkspace;
  readonly onChange: (workspace: DrawWorkspace) => void;
  readonly onError: (message: string | null) => void;
  readonly results: ResultsWorkspace;
}): React.JSX.Element | null {
  const [submitting, setSubmitting] = useState(false);
  const ready = readyForNextRound(draw, results);
  if (!ready) return null;

  async function prepare(): Promise<void> {
    onError(null); setSubmitting(true);
    try { await prepareNextRound(competitionId, draw.competitionRevision); onChange(await drawWorkspace(competitionId)); }
    catch (caught: unknown) { onError(caught instanceof Error ? caught.message : 'No fue posible preparar la siguiente ronda.'); }
    finally { setSubmitting(false); }
  }

  const nextRound = draw.configuration?.formatCode === 'KNOCKOUT' ? draw.configuration.roundNumber + 1 : 1;

  return <Card className="setup-card" aria-labelledby="next-round-title">
    <Card.Content>
      <div className="section-title"><div><span className="eyebrow eyebrow--dark">Continuidad</span><h3 id="next-round-title">Siguiente ronda eliminatoria</h3></div><Chip color="accent" size="sm" variant="soft">Ronda {nextRound}</Chip></div>
      <p>Todos los avances necesarios están confirmados. El servidor construirá el conjunto elegible y congelará la ronda {nextRound}; no se seleccionan equipos manualmente.</p>
      {canOperate ? <Button isDisabled={submitting} onPress={() => void prepare()} variant="primary">{submitting ? 'Preparando…' : `Preparar ronda ${String(nextRound)}`}</Button> : <p className="readonly-note">Un administrador debe preparar la siguiente ronda.</p>}
    </Card.Content>
  </Card>;
}
