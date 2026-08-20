'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { publicDraw, publicDrawActUrl, type PublicDrawPublication } from '../lib/competition-api';
import { OesMark } from './oes-mark';

export function PublicDrawClient({ publicationId }: { readonly publicationId: string }): React.JSX.Element {
  const [publication, setPublication] = useState<PublicDrawPublication | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void publicDraw(publicationId)
      .then((loaded) => active && setPublication(loaded))
      .catch(() => active && setError('El acta solicitada no existe, fue revocada o no pudo verificarse.'));
    return () => { active = false; };
  }, [publicationId]);

  if (error !== null) return <main className="public-draw-shell"><OesMark /><section className="public-draw-error"><h1>Acta no disponible</h1><p>{error}</p></section></main>;
  if (publication === null) return <main className="public-draw-shell"><OesMark /><p className="public-draw-loading">Verificando acta oficial…</p></main>;
  const { act } = publication;
  return <main className="public-draw-shell">
    <header className="public-draw-header"><OesMark /><div><span>Acta oficial de sorteo</span><h1>{act.competition.sport} · {act.competition.modality}</h1><p>{act.competition.edition} / {act.competition.event}</p></div><strong>{publication.verified ? '✓ Verificada' : 'No verificable'}</strong></header>
    <section className="public-draw-meta"><div><span>Identificador</span><code>{publication.id}</code></div><div><span>Fecha oficial</span><b>{new Date(act.confirmedAt).toLocaleString('es-PY')}</b></div><div><span>Algoritmo</span><b>{act.algorithmVersion}</b></div><div><span>Ronda</span><b>{act.configuration.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : act.configuration.roundNumber}</b></div></section>
    {act.result.formatCode === 'GROUP_STAGE' ? <section className="public-draw-groups">{act.result.groups.map((group) => <article key={group.label}><header>Grupo {group.label}</header><ol>{group.members.map((member) => <li key={member.id}>{member.name}</li>)}</ol></article>)}</section> : <section className="public-draw-pairings">{act.result.pairings.map((pairing) => <article key={pairing.ordinal}><span>Cruce {pairing.ordinal}</span><b>{pairing.participantA.name}</b><i>vs</i><b>{pairing.participantB.name}</b></article>)}{act.result.bye === null ? null : <article><span>Pase libre</span><b>{act.result.bye.participant.name}</b></article>}</section>}
    <section className="public-draw-verification"><span>Código de verificación SHA-256</span><code>{publication.verificationCode}</code><p>Este código protege la competencia, participantes, reglas congeladas, resultado, semilla y datos del acta.</p><a href={publicDrawActUrl(publication.id)}>Descargar acta verificable</a><Link href={`/draws/${publication.id}/presentation?step=0`}>Abrir modo presentación</Link></section>
  </main>;
}
