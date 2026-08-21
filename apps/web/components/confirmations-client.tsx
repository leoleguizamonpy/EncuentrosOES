'use client';

import { useEffect, useMemo, useState } from 'react';

import { champion, confirmChampion } from '../lib/champion-api';
import {
  competitions,
  confirmGroupQualification,
  confirmMatchResult,
  confirmOfficialDraw,
  drawWorkspace,
  resultsWorkspace,
  type CompetitionSummary,
} from '../lib/competition-api';
import type { Actor } from '../lib/auth-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const CONTROL_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type DecisionKind = 'CHAMPION' | 'DRAW' | 'QUALIFICATION' | 'RESULT';
type DecisionFilter = 'ALL' | DecisionKind;

interface PendingDecision {
  readonly competition: CompetitionSummary;
  readonly detail: string;
  readonly kind: DecisionKind;
  readonly originatorId: string;
  readonly originatorName: string;
  readonly resourceId: string;
  readonly revision: number;
  readonly title: string;
}

const kindLabels: Readonly<Record<DecisionKind, string>> = {
  CHAMPION: 'Campeón',
  DRAW: 'Sorteo',
  QUALIFICATION: 'Clasificados',
  RESULT: 'Resultado',
};

function competitionLabel(competition: CompetitionSummary): string {
  return `${competition.edition.name} · ${competition.event.name} · ${competition.sport.name} · ${competition.modality.name}`;
}

async function decisionsFor(competition: CompetitionSummary): Promise<readonly PendingDecision[]> {
  const decisions: PendingDecision[] = [];
  const [draw, results, championView] = await Promise.all([
    drawWorkspace(competition.id).catch(() => null),
    resultsWorkspace(competition.id).catch(() => null),
    champion(competition.id).catch(() => null),
  ]);

  if (draw?.execution?.status === 'PENDING_CONFIRMATION') {
    decisions.push({
      competition,
      detail: `${draw.execution.matchCount} encuentros · evidencia ${draw.execution.evidenceHash.slice(0, 10)}…`,
      kind: 'DRAW',
      originatorId: draw.execution.executedBy.id,
      originatorName: draw.execution.executedBy.displayName,
      resourceId: draw.execution.id,
      revision: draw.execution.revision,
      title: 'Sorteo oficial pendiente',
    });
  }

  for (const match of results?.matches ?? []) {
    if (match.result?.status !== 'PENDING_CONFIRMATION') continue;
    decisions.push({
      competition,
      detail: `${match.participantA.displayName} vs ${match.participantB.displayName} · ${match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`}`,
      kind: 'RESULT',
      originatorId: match.result.recordedBy.id,
      originatorName: match.result.recordedBy.displayName,
      resourceId: match.result.id,
      revision: match.result.revision,
      title: 'Resultado pendiente',
    });
  }

  for (const group of results?.groups ?? []) {
    const qualification = group.qualification;
    if (qualification?.status !== 'PENDING_CONFIRMATION') continue;
    decisions.push({
      competition,
      detail: `Grupo ${group.label}: 1.º ${qualification.firstParticipant.displayName} · 2.º ${qualification.secondParticipant.displayName}`,
      kind: 'QUALIFICATION',
      originatorId: qualification.proposedBy.id,
      originatorName: qualification.proposedBy.displayName,
      resourceId: qualification.id,
      revision: qualification.revision,
      title: 'Clasificados pendientes',
    });
  }

  if (championView?.status === 'PENDING_CONFIRMATION') {
    decisions.push({
      competition,
      detail: `${championView.participantDisplayName} · ronda final ${String(championView.sourceRoundNumber)}`,
      kind: 'CHAMPION',
      originatorId: championView.proposedBy,
      originatorName: championView.proposedBy,
      resourceId: championView.proposalId,
      revision: championView.competitionRevision,
      title: 'Campeón pendiente',
    });
  }

  return decisions;
}

function ConfirmationsWorkspace({ actor }: { readonly actor: Actor }): React.JSX.Element {
  const [items, setItems] = useState<readonly PendingDecision[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DecisionFilter>('ALL');
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const list = await competitions();
    const pending = await Promise.all(list.map(decisionsFor));
    setItems(pending.flat());
  }

  useEffect(() => {
    let mounted = true;
    void reload()
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar las confirmaciones.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return items.filter((item) => {
      const identity = `${item.title} ${item.detail} ${competitionLabel(item.competition)} ${item.originatorName}`.toLocaleLowerCase('es-PY');
      return (filter === 'ALL' || item.kind === filter) && (normalized.length === 0 || identity.includes(normalized));
    });
  }, [filter, items, query]);

  async function confirm(decision: PendingDecision): Promise<void> {
    setError(null);
    setSubmitting(`${decision.kind}:${decision.resourceId}`);
    try {
      if (decision.kind === 'DRAW') await confirmOfficialDraw(decision.resourceId, decision.revision);
      if (decision.kind === 'RESULT') await confirmMatchResult(decision.resourceId, decision.revision);
      if (decision.kind === 'QUALIFICATION') await confirmGroupQualification(decision.resourceId, decision.revision);
      if (decision.kind === 'CHAMPION') await confirmChampion(decision.competition.id, decision.resourceId, decision.revision);
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible confirmar la decisión.');
    } finally {
      setSubmitting(null);
    }
  }

  async function retry(): Promise<void> {
    setLoading(true); setError(null);
    try { await reload(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="empty-state"><strong>Cargando confirmaciones…</strong><p>Buscando decisiones que requieren una segunda autoridad.</p></div>;
  if (items === null) return <div className="empty-state"><strong>No fue posible cargar Confirmaciones.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  const actionable = items.filter((item) => item.originatorId !== actor.id).length;
  const own = items.length - actionable;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Control</span><h2>Confirmaciones</h2><p>Bandeja única para sorteos, resultados, clasificados y campeón pendientes de segunda autoridad. El actor que originó una decisión no puede confirmarla desde aquí.</p></div>
    </section>
    {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
    <section aria-label="Resumen de confirmaciones" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
      <span className={[styles.status, styles.active].filter(Boolean).join(' ')}>{actionable} disponibles para confirmar</span>
      <span className={[styles.status, styles.inactive].filter(Boolean).join(' ')}>{own} requieren otra autoridad</span>
    </section>
    <section aria-label="Filtros de confirmaciones" className={styles.toolbar}>
      <input aria-label="Buscar confirmación" placeholder="Buscar competencia, participante o autoridad…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filtrar confirmaciones por tipo" value={filter} onChange={(event) => setFilter(event.target.value as DecisionFilter)}>
        <option value="ALL">Todos los tipos</option>
        <option value="DRAW">Sorteos</option>
        <option value="RESULT">Resultados</option>
        <option value="QUALIFICATION">Clasificados</option>
        <option value="CHAMPION">Campeón</option>
      </select>
      <span />
      <span className={styles.counter}>{filtered.length} de {items.length}</span>
    </section>
    <section aria-label="Decisiones pendientes" className={styles.tableCard}>
      <div className={styles.tableHeader}><span>Tipo</span><span>Decisión</span><span>Competencia</span><span>Autoridad</span><span>Acción</span></div>
      {filtered.length === 0 ? <div className={styles.empty}><strong>{items.length === 0 ? 'No hay confirmaciones pendientes.' : 'No encontramos decisiones.'}</strong><p>{items.length === 0 ? 'La bandeja está al día.' : 'Ajusta la búsqueda o el filtro.'}</p></div> : filtered.map((decision) => {
        const ownDecision = decision.originatorId === actor.id;
        const key = `${decision.kind}:${decision.resourceId}`;
        return <article className={styles.row} key={key}>
          <span className={styles.logo}>{kindLabels[decision.kind].slice(0, 2).toUpperCase()}</span>
          <div className={styles.identity}><strong>{decision.title}</strong><small>{decision.detail}</small></div>
          <span className={styles.eventName}>{competitionLabel(decision.competition)}</span>
          <span className={[styles.status, ownDecision ? styles.inactive : styles.active].filter(Boolean).join(' ')}>{ownDecision ? 'Originada por ti' : `Por ${decision.originatorName}`}</span>
          {ownDecision
            ? <span className={styles.eventName}>Otra autoridad debe confirmar</span>
            : <button className={styles.editButton} disabled={submitting !== null} onClick={() => void confirm(decision)} type="button">{submitting === key ? 'Confirmando…' : `Confirmar ${kindLabels[decision.kind].toLocaleLowerCase('es-PY')}`}</button>}
        </article>;
      })}
    </section>
  </div>;
}

export function ConfirmationsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={CONTROL_ROLES}>{(actor) => <AppShell actor={actor} active="confirmations" title="Confirmaciones"><ConfirmationsWorkspace actor={actor} /></AppShell>}</SessionBoundary>;
}
