'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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

  if (error !== null) return <main className="public-draw-shell"><OesMark /><section className="public-draw-error"><h1>Presentación no disponible</h1><p>{error}</p></section></main>;
  if (publication === null) return <main className="public-draw-shell"><OesMark /><p className="public-draw-loading">Cargando sorteo oficial…</p></main>;

  const act = publication.act;
  return <main className="public-draw-shell">
    <header className="public-draw-header">
      <OesMark />
      <div><span>Presentación oficial · solo lectura</span><h1>{act.competition.sport} · {act.competition.modality}</h1><p>{act.competition.edition} / {act.competition.event}</p></div>
      <strong>{publication.verified ? '✓ Publicación verificada' : 'No verificable'}</strong>
    </header>

    <section className="public-draw-meta">
      <div><span>Ronda</span><b>{act.configuration.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Eliminatoria ${String(act.configuration.roundNumber)}`}</b></div>
      <div><span>Revelados</span><b>{step} / {items.length}</b></div>
      <div><span>Publicada</span><b>{new Date(publication.publishedAt).toLocaleString('es-PY')}</b></div>
      <div><span>Verificación</span><code>{publication.verificationCode.slice(0, 16)}…</code></div>
    </section>

    <section aria-live="polite" className={act.result.formatCode === 'GROUP_STAGE' ? 'public-draw-groups' : 'public-draw-pairings'}>
      {visible.map((item) => {
        if (item.kind === 'GROUP') return <article key={item.label}><header>{item.label}</header><ol>{item.members.map((member) => <li key={member.id}>{member.name}</li>)}</ol></article>;
        if (item.kind === 'BYE') return <article key={item.label}><span>{item.label}</span><b>{item.participant.name}</b></article>;
        return <article key={item.label}><span>{item.label}</span><b>{item.participantA.name}</b><i>vs</i><b>{item.participantB.name}</b></article>;
      })}
    </section>

    {items.length > 0 && <section className="public-draw-verification">
      <span>Control de presentación</span>
      <p>Estos controles solo cambian qué parte del resultado ya publicado se ve en pantalla. No ejecutan, recalculan ni modifican el sorteo.</p>
      <div>
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>Anterior</button>
        <button type="button" disabled={step === items.length} onClick={() => setStep(step + 1)}>Mostrar siguiente</button>
        <button type="button" disabled={step === items.length} onClick={() => setStep(items.length)}>Mostrar todo</button>
      </div>
      <code>{publication.verificationCode}</code>
    </section>}
  </main>;
}
