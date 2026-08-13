import type { MatchResultView, ResultMatchView, ResultsWorkspace } from '../lib/competition-api';

const statusLabels = {
  PENDING_RESULT: 'Pendiente de resultado',
  RESULT_CONFIRMED: 'Resultado confirmado',
  RESULT_PENDING_CONFIRMATION: 'Pendiente de confirmación',
} as const;

function ResultScore({ result }: { readonly result: MatchResultView }): React.JSX.Element {
  if (result.detail.profile === 'SCORE_BASED') return <strong>{result.detail.scoreA} — {result.detail.scoreB}</strong>;
  return <strong>{result.resolved.setsWonA} — {result.resolved.setsWonB} <small>sets</small></strong>;
}

function MatchCard({ match }: { readonly match: ResultMatchView }): React.JSX.Element {
  return (
    <article className="result-match">
      <header><span>{match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`} · Encuentro {match.ordinal}</span><small className={`match-state match-state--${match.status.toLowerCase()}`}>{statusLabels[match.status]}</small></header>
      <div><b>{match.participantA.displayName}</b>{match.result === null ? <i>VS</i> : <ResultScore result={match.result} />}<b>{match.participantB.displayName}</b></div>
      {match.result === null ? null : <footer>Registrado por {match.result.recordedBy.displayName}{match.result.confirmedBy === null ? '' : ` · confirmado por ${match.result.confirmedBy.displayName}`}</footer>}
    </article>
  );
}

export function ResultsWorkspacePanel({ workspace }: { readonly workspace: ResultsWorkspace }): React.JSX.Element {
  const setBased = workspace.resultProfile === 'SET_BASED';
  return (
    <section className="setup-card results-workspace" id="results-workspace" aria-labelledby="results-workspace-title">
      <div className="section-title"><div><span className="eyebrow eyebrow--dark">Paso 5</span><h3 id="results-workspace-title">Encuentros y tabla</h3></div><span>{workspace.matches.length}</span></div>
      {workspace.matches.length === 0 ? <div className="setup-empty">Los encuentros aparecerán cuando otra autoridad confirme el sorteo oficial.</div> : <>
        <div className="result-match-list">{workspace.matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>
        {workspace.groups.map((group) => <article className="standing-card" key={group.id}>
          <header><div><span>Tabla automática</span><strong>Grupo {group.label}</strong></div><small>{group.complete ? 'Completa' : 'Parcial'}</small></header>
          <div className="standing-scroll"><table>
            <thead><tr><th>Pos.</th><th>Participante</th><th>J</th><th>G</th>{setBased ? null : <th>E</th>}<th>P</th><th>Pts.</th>{setBased ? <><th>SG</th><th>DP</th></> : <><th>GF</th><th>GC</th><th>DG</th></>}</tr></thead>
            <tbody>{group.standings.map((row) => <tr key={row.participant.id}><td>{row.position}{row.tied ? '=' : ''}</td><th>{row.participant.displayName}</th><td>{row.played}</td><td>{row.wins}</td>{setBased ? null : <td>{row.draws}</td>}<td>{row.losses}</td><td><strong>{row.tablePoints}</strong></td>{setBased ? <><td>{row.setsWon}</td><td>{row.sportPointDifference}</td></> : <><td>{row.scoreFor}</td><td>{row.scoreAgainst}</td><td>{row.scoreDifference}</td></>}</tr>)}</tbody>
          </table></div>
          {group.standings.length === 0 ? <p>La tabla se calculará al confirmar el primer resultado.</p> : null}
        </article>)}
      </>}
    </section>
  );
}
