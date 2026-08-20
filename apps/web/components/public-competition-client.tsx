'use client';

import { useEffect, useState } from 'react';

import { publicCompetitionJourney, type PublicCompetitionJourney } from '../lib/public-competition-api';
import { OesMark } from './oes-mark';
import { PublicStandings } from './public-standings';

function roundLabel(formatCode: 'GROUP_STAGE' | 'KNOCKOUT', roundNumber: number): string {
  return formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Ronda eliminatoria ${String(roundNumber)}`;
}

function scoreLabel(result: Readonly<{ detail: unknown; resolved: unknown }> | null): string {
  if (result === null) return 'Resultado pendiente';
  const detail = result.detail;
  if (typeof detail === 'object' && detail !== null && 'scoreA' in detail && 'scoreB' in detail) {
    const scoreA = (detail as { scoreA?: unknown }).scoreA;
    const scoreB = (detail as { scoreB?: unknown }).scoreB;
    if (typeof scoreA === 'number' && typeof scoreB === 'number') return `${String(scoreA)} – ${String(scoreB)}`;
  }
  return 'Resultado confirmado';
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

  if (error !== null) return <main className="public-draw-shell"><OesMark /><section className="public-draw-error" role="alert"><h1>Competencia no disponible</h1><p>{error}</p></section></main>;
  if (journey === undefined) return <main className="public-draw-shell"><OesMark /><p className="public-draw-loading" role="status" aria-live="polite">Restaurando competencia oficial…</p></main>;
  if (journey === null) return <main className="public-draw-shell"><OesMark /><section className="public-draw-error" role="status"><h1>Aún sin publicación oficial</h1><p>La competencia aparecerá aquí cuando al menos una ronda haya sido publicada oficialmente.</p></section></main>;

  const finalized = journey.competition.status === 'FINALIZED';

  return <main className="public-draw-shell">
    <header className="public-draw-header">
      <OesMark />
      <div><span>{finalized ? 'Competencia oficial finalizada' : 'Competencia oficial en curso'}</span><h1>{journey.competition.sport} · {journey.competition.modality}</h1><p>{journey.competition.edition} / {journey.competition.event}</p></div>
      <strong aria-label={finalized ? 'Estado: finalizada' : 'Estado: en curso'}>{finalized ? '✓ Finalizada' : '● En curso'}</strong>
    </header>

    <section className="public-draw-meta" aria-label="Resumen de la competencia">
      <div><span>Campeón</span><b>{journey.champion?.participantDisplayName ?? 'Por definir'}</b></div>
      <div><span>Rondas publicadas</span><b>{journey.rounds.length}</b></div>
      <div><span>Estado</span><b>{finalized ? 'Finalizada' : 'En competencia'}</b></div>
      <div><span>Cierre competitivo</span><b>{journey.competition.finalizedAt === null ? 'Pendiente' : new Date(journey.competition.finalizedAt).toLocaleString('es-PY')}</b></div>
    </section>

    {journey.rounds.map((round) => {
      const label = roundLabel(round.formatCode, round.roundNumber);
      return <section key={round.executionId} className="public-draw-verification" aria-labelledby={`round-${round.executionId}`}>
        <h2 id={`round-${round.executionId}`}>{label}</h2>
        <p>Publicada el {new Date(round.publication.publishedAt).toLocaleString('es-PY')} · Código {round.publication.verificationCode.slice(0, 12)}…</p>

        {round.groups.length > 0 && <div className="public-standings-grid">
          {round.groups.map((group) => <PublicStandings key={group.label} group={group} />)}
        </div>}

        <div className="public-draw-pairings" aria-label={`Partidos de ${label}`}>
          {round.matches.map((match) => {
            const winner = match.winnerParticipantId === match.participantA.id
              ? match.participantA.displayName
              : match.winnerParticipantId === match.participantB.id
                ? match.participantB.displayName
                : null;
            const score = scoreLabel(match.result);
            return <article key={match.id} aria-label={`${match.participantA.displayName} vs ${match.participantB.displayName}. ${score}`}>
              <span>{match.groupLabel === null ? `Cruce ${String(match.ordinal)}` : `Grupo ${match.groupLabel} · Partido ${String(match.ordinal)}`}</span>
              <b>{match.participantA.displayName}</b><i>{score}</i><b>{match.participantB.displayName}</b>
              <small>{winner === null ? (match.result === null ? 'Pendiente' : 'Resultado confirmado') : `Ganador: ${winner}`}</small>
            </article>;
          })}
        </div>
      </section>;
    })}
  </main>;
}
