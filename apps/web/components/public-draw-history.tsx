'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { publicDrawHistory, type PublicDrawHistoryItem } from '../lib/public-competition-api';

function publicationLabel(item: PublicDrawHistoryItem): string {
  return item.formatCode === 'GROUP_STAGE' ? 'Fase de grupos' : `Ronda eliminatoria ${String(item.roundNumber)}`;
}

export function PublicDrawHistory({ competitionId }: { readonly competitionId: string }): React.JSX.Element {
  const [items, setItems] = useState<readonly PublicDrawHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void publicDrawHistory(competitionId)
      .then((loaded) => { if (active) setItems(loaded); })
      .catch(() => { if (active) setError('No fue posible cargar el historial de publicaciones.'); });
    return () => { active = false; };
  }, [competitionId]);

  if (error !== null) return <section className="public-draw-verification" role="alert"><h2 className="public-round-heading">Historial público</h2><p>{error}</p></section>;
  if (items === null) return <section className="public-draw-verification" role="status" aria-live="polite"><h2 className="public-round-heading">Historial público</h2><p>Cargando publicaciones y verificaciones…</p></section>;
  if (items.length === 0) return <section className="public-draw-verification"><h2 className="public-round-heading">Historial público</h2><p>Aún no existen publicaciones oficiales para esta competencia.</p></section>;

  return <section className="public-draw-verification" aria-labelledby="public-history-heading">
    <h2 className="public-round-heading" id="public-history-heading">Historial público de publicaciones</h2>
    <p>Cada entrada conserva su estado histórico. Una publicación revocada permanece visible como evidencia, pero deja de ser un acta vigente.</p>
    <ol className="public-history-list">
      {items.map((item) => <li key={item.publicationId} className="public-history-item">
        <div>
          <span>{publicationLabel(item)}</span>
          <b>{new Date(item.publishedAt).toLocaleString('es-PY')}</b>
          <code>{item.verificationCode}</code>
        </div>
        <div>
          <strong className="public-state-label" role="status">{item.status === 'PUBLISHED' ? '✓ Vigente' : 'Revocada'}</strong>
          <small>{item.integrityValid ? 'Integridad criptográfica válida' : 'Integridad no verificable'}</small>
          {item.status === 'PUBLISHED'
            ? <Link href={`/draws/${item.publicationId}`}>Ver acta vigente</Link>
            : <p>Revocada {item.revokedAt === null ? '' : `el ${new Date(item.revokedAt).toLocaleString('es-PY')}`}{item.revocationReason === null ? '' : ` · ${item.revocationReason}`}</p>}
        </div>
      </li>)}
    </ol>
  </section>;
}
