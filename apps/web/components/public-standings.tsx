import type { PublicCompetitionJourney } from '../lib/public-competition-api';

type Group = PublicCompetitionJourney['rounds'][number]['groups'][number];

export function PublicStandings({ group }: { readonly group: Group }): React.JSX.Element {
  const titleId = `group-${group.label}-title`;
  if (group.standings.length === 0) {
    return <section className="public-standings-empty" aria-labelledby={titleId}>
      <h3 id={titleId}>Grupo {group.label}</h3>
      <p>{group.members.map((member) => member.displayName).join(' · ')}</p>
      <small>La tabla aparecerá cuando existan resultados confirmados.</small>
    </section>;
  }

  return <section className="public-standings-block" aria-labelledby={titleId}>
    <h3 id={titleId}>Grupo {group.label}</h3>
    <div className="public-standings-scroll" tabIndex={0} aria-label={`Tabla desplazable del grupo ${group.label}`}>
      <table className="public-standings-table">
        <caption className="sr-only">Posiciones oficiales del grupo {group.label}</caption>
        <thead><tr>
          <th scope="col">#</th><th scope="col">Equipo</th><th scope="col">PJ</th><th scope="col">G</th><th scope="col">E</th><th scope="col">P</th><th scope="col">Pts</th><th scope="col">Dif.</th>
        </tr></thead>
        <tbody>{group.standings.map((standing) => <tr key={standing.participant.id}>
          <td>{standing.position}{standing.tied ? '*' : ''}</td>
          <th scope="row">{standing.participant.displayName}</th>
          <td>{standing.played}</td><td>{standing.wins}</td><td>{standing.draws}</td><td>{standing.losses}</td>
          <td><strong>{standing.tablePoints}</strong></td>
          <td>{standing.scoreDifference !== 0 ? standing.scoreDifference : standing.sportPointDifference}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {group.standings.some((standing) => standing.tied) && <small>* Posición empatada según los criterios oficiales disponibles.</small>}
  </section>;
}
