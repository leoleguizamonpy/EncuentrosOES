'use client';

import { Alert, Button, Card, Chip, Skeleton } from '@heroui/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { publicDraw, type PublicDrawPublication } from '../lib/competition-api';
import { drawPresentationItems, normalizedPresentationStep } from '../lib/draw-presentation';
import { OesMark } from './oes-mark';

export function OfficialDrawPresentation({ publicationId }: { readonly publicationId: string }): React.JSX.Element {
  const [publication, setPublication] = useState<PublicDrawPublication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    void publicDraw(publicationId)
      .then((loaded) => { if (active) setPublication(loaded); })
      .catch(() => { if (active) setError('La publicación oficial no está disponible o fue revocada.'); });
    return () => { active = false; };
  }, [publicationId]);

  const items = useMemo(() => publication === null ? [] : drawPresentationItems(publication), [publication]);
  const step = normalizedPresentationStep(searchParams.get('step'), items.length);
  const visible = items.slice(0, step);

  function setStep(next: number): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', String(Math.max(0, Math.min(next, items.length))));
    router.replace(`${pathname}?${params.toString()}`);
  }

  if (error !== null) return <main id="main-content" className="public-draw-shell"><OesMark /><Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Title>Presentación no disponible</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert></main>;
  if (publication === null) return <main id="main-content" className="public-draw-shell"><OesMark /><Card variant="tertiary"><Card.Content style={{ display: 'grid', gap: 12, padding: 24 }}><Skeleton style={{ height: 10, width: '35%' }} /><strong>Cargando sorteo oficial…</strong></Card.Content></Card></main>;

  const act = publication.act;
  return <main id="main-content" className="public-draw-shell">
    <header className="public-draw-header"><OesMark /><div><span>Presentación oficial · solo lectura</span><h1>{act.competition.sport} · {act.competition.modality}</h1><p>{act.competition.edition} / {act.competition.event}</p></div><Chip color={publication.verified ? 'success' : 'danger'} size="sm" variant="soft">{publication.verified ? '✓ Publicación verificada' : 'No verificable'}</Chip></header>
    <section className="public-draw-meta" aria-label="Resumen de presentación"><div><span>Ronda</span><b>{act.configuration.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Eliminatoria ${String(act.configuration.roundNumber)}`}</b></div><div><span>Revelados</span><b aria-live="polite">{step} / {items.length}</b></div><div><span>Publicada</span><b>{new Date(publication.publishedAt).toLocaleString('es-PY')}</b></div><div><span>Verificación</span><code>{publication.verificationCode.slice(0, 16)}…</code></div></section>
    <section aria-live="polite" aria-atomic="false" aria-label="Resultado revelado" className={act.result.formatCode === 'GROUP_STAGE' ? 'public-draw-groups' : 'public-draw-pairings'}>
      {visible.map((item) => {
        if (item.kind === 'GROUP') return <Card key={item.label}><Card.Header>{item.label}</Card.Header><Card.Content><ol>{item.members.map((member) => <li key={member.id}>{member.name}</li>)}</ol></Card.Content></Card>;
        if (item.kind === 'BYE') return <Card key={item.label}><Card.Content><span>{item.label}</span><b>{item.participant.name}</b></Card.Content></Card>;
        return <Card key={item.label}><Card.Content><span>{item.label}</span><b>{item.participantA.name}</b><i>vs</i><b>{item.participantB.name}</b></Card.Content></Card>;
      })}
    </section>
    {items.length > 0 && <Card className="public-draw-verification" aria-labelledby="presentation-controls-heading"><Card.Content><h2 className="public-round-heading" id="presentation-controls-heading">Control de presentación</h2><p>Estos controles solo cambian qué parte del resultado ya publicado se ve en pantalla. No ejecutan, recalculan ni modifican el sorteo.</p><div className="public-presentation-controls"><Button isDisabled={step === 0} onPress={() => setStep(step - 1)} variant="secondary">Anterior</Button><Button isDisabled={step === items.length} onPress={() => setStep(step + 1)} variant="primary">Mostrar siguiente</Button><Button isDisabled={step === items.length} onPress={() => setStep(items.length)} variant="secondary">Mostrar todo</Button></div><code>{publication.verificationCode}</code></Card.Content></Card>}
  </main>;
}
