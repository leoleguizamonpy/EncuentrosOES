'use client';

import { Alert, Card, Chip } from '@heroui/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { publicDraw, publicDrawActUrl, type PublicDrawPublication } from '../lib/competition-api';
import { LoadingPanel } from '../ui';
import { OesMark } from './oes-mark';
import { PrintAction } from './print-action';
import { PrintDocumentFooter } from './print-document-footer';

export function PublicDrawClient({ publicationId }: { readonly publicationId: string }): React.JSX.Element {
  const [publication, setPublication] = useState<PublicDrawPublication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printRequested = useRef(false);

  useEffect(() => { let active = true; void publicDraw(publicationId).then((loaded) => active && setPublication(loaded)).catch(() => active && setError('El acta solicitada no existe, fue revocada o no pudo verificarse.')); return () => { active = false; }; }, [publicationId]);

  useEffect(() => {
    if (publication === null || printRequested.current) return;
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get('print') !== '1') return;
    printRequested.current = true;
    window.setTimeout(() => window.print(), 0);
  }, [publication]);

  if (error !== null) return <main id="main-content" className="public-draw-shell"><OesMark /><Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Title>Acta no disponible</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert></main>;
  if (publication === null) return <main id="main-content" className="public-draw-shell"><OesMark /><LoadingPanel label="Verificando acta oficial…" /></main>;
  const { act } = publication;
  return <main id="main-content" className="public-draw-shell">
    <header className="public-draw-header"><OesMark /><div><span>Acta oficial de sorteo</span><h1>{act.competition.sport} · {act.competition.modality}</h1><p>{act.competition.edition} / {act.competition.event}</p></div><div className="public-draw-actions"><Chip color={publication.verified ? 'success' : 'danger'} size="sm" variant="soft">{publication.verified ? '✓ Verificada' : 'No verificable'}</Chip><PrintAction label="Imprimir acta" /></div></header>
    <section className="public-draw-meta" aria-label="Datos de la publicación"><div><span>Identificador</span><code>{publication.id}</code></div><div><span>Fecha oficial</span><b>{new Date(act.confirmedAt).toLocaleString('es-PY')}</b></div><div><span>Algoritmo</span><b>{act.algorithmVersion}</b></div><div><span>Ronda</span><b>{act.configuration.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : act.configuration.roundNumber}</b></div></section>
    {act.result.formatCode === 'GROUP_STAGE' ? <section className="public-draw-groups" aria-label="Grupos sorteados">{act.result.groups.map((group) => <Card key={group.label}><Card.Header>Grupo {group.label}</Card.Header><Card.Content><ol>{group.members.map((member) => <li key={member.id}>{member.name}</li>)}</ol></Card.Content></Card>)}</section> : <section className="public-draw-pairings" aria-label="Cruces sorteados">{act.result.pairings.map((pairing) => <Card key={pairing.ordinal}><Card.Content><span>Cruce {pairing.ordinal}</span><b>{pairing.participantA.name}</b><i>vs</i><b>{pairing.participantB.name}</b></Card.Content></Card>)}{act.result.bye === null ? null : <Card><Card.Content><span>Pase libre</span><b>{act.result.bye.participant.name}</b></Card.Content></Card>}</section>}
    <Card className="public-draw-verification" aria-labelledby="verification-heading"><Card.Content><h2 className="public-round-heading" id="verification-heading">Verificación oficial</h2><span>Código SHA-256</span><code>{publication.verificationCode}</code><p>Este código protege la competencia, participantes, reglas congeladas, resultado, semilla y datos del acta.</p><a href={publicDrawActUrl(publication.id)}>Descargar acta verificable</a><Link href={`/draws/${publication.id}/presentation?step=0`}>Abrir modo presentación</Link></Card.Content></Card>
    <PrintDocumentFooter documentId={publication.id} verificationCode={publication.verificationCode} />
  </main>;
}
