'use client';

import { useEffect, useState } from 'react';

import { publicCompetitionJourney, type PublicCompetitionJourney } from '../lib/public-competition-api';
import { OesMark } from './oes-mark';

function roundLabel(formatCode: 'GROUP_STAGE' | 'KNOCKOUT', roundNumber: number): string {
  return formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Ronda eliminatoria ${String(roundNumber)}`;
}

export function PublicCompetitionClient({ competitionId }: { readonly competitionId: string }): React.JSX.Element {
  const [journey, setJourney] = useState<PublicCompetitionJourney | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void publicCompetitionJourney(competitionId)
      .then((loaded) => { if (active) setJourney(loaded); })
      .catch(() => { if (active) setError('La competencia no pudo restaurarse desde la evidencia pública.'); });
    return () => { active = false; };
  }, [competitionId]);

  if (error !== null) return <main className="public-draw-shell"><OesMark /><section className="public-draw-error"><h1>Competencia no disponible</h1><p>{error}</p></section></main>;
  if (journey === undefined) return <main className="public-draw-shell"><OesMark /><p className="public-draw-loading">Restaurando recorrido oficial…</p></main>;
  if (journey === null) return <main className="public-draw-shell"><OesMark /><section className="public-draw-error"><h1>Competencia aún no finalizada</h1><p>El campeón y el recorrido público aparecen únicamente después de una finalización oficial confirmada.</p></section></main>;

  return <main className="public-draw-shell">
    <header className="public-draw-header">
      <OesMark />
      <div><span>Competencia oficial finalizada</span><h1>{journey.competition.sport} · {journey.competition.modality}</h1><p>{journey.competition.edition} / {journey.competition.event}</p></div>
      <strong>✓ Finalizada</strong>
    </header>

    <section className="public-draw-meta">
      <div><span>Campeón</span><b>{journey.champion.participantDisplayName}</b></div>
      <div><span>Confirmado</span><b>{new Date(journey.champion.confirmedAt).toLocaleString('es-PY')}</b></div>
      <div><span>Rondas oficiales</span><b>{journey.rounds.length}</b></div>
      <div><span>Cierre competitivo</span><b>{new Date(journey.competition.finalizedAt).toLocaleString('es-PY')}</b></div>
    </section>

    {journey.rounds.map((round) => <section key={round.executionId} className="public-draw-verification">
      <span>{roundLabel(round.formatCode, round.roundNumber)}</span>
      <p>Confirmada el {new Date(round.confirmedAt).toLocaleString('es-PY')}</p>
      <div className="public-draw-pairings">
        {round.matches.map((match) => {
          const winner = match.winnerParticipantId === match.participantA.id
            ? match.participantA.displayName
            : match.winnerParticipantId === match.participantB.id
              ? match.participantB.displayName
              : null;
          return <article key={match.id}>
            <span>{match.groupLabel === null ? `Cruce ${String(match.ordinal)}` : `Grupo ${match.groupLabel} · Partido ${String(match.ordinal)}`}</span>
            <b>{match.participantA.displayName}</b><i>vs</i><b>{match.participantB.displayName}</b>
            <small>{winner === null ? 'Resultado confirmado' : `Ganador: ${winner}`}</small>
          </article>;
        })}
      </div>
    </section>)}
  </main>;
}
