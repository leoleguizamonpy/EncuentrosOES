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
import { ActionButton, DataList, DataRow, ListToolbar, Notice, PageHeader, PageLayout, StatusBadge, StatusSummary } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const CONTROL_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
type DecisionKind = 'CHAMPION' | 'DRAW' | 'QUALIFICATION' | 'RESULT';
type DecisionFilter = 'ALL' | DecisionKind;
const FILTER_OPTIONS: readonly { readonly label: string; readonly value: DecisionFilter }[] = [
  { label: 'Todos los tipos', value: 'ALL' },
  { label: 'Sorteos', value: 'DRAW' },
  { label: 'Resultados', value: 'RESULT' },
  { label: 'Clasificados', value: 'QUALIFICATION' },
  { label: 'Campeón', value: 'CHAMPION' },
];

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

const kindLabels: Readonly<Record<DecisionKind, string>> = { CHAMPION: 'Campeón', DRAW: 'Sorteo', QUALIFICATION: 'Clasificados', RESULT: 'Resultado' };
function competitionLabel(competition: CompetitionSummary): string { return `${competition.edition.name} · ${competition.event.name} · ${competition.sport.name} · ${competition.modality.name}`; }

async function decisionsFor(competition: CompetitionSummary): Promise<readonly PendingDecision[]> {
  const decisions: PendingDecision[] = [];
  const [draw, results, championView] = await Promise.all([drawWorkspace(competition.id).catch(() => null), resultsWorkspace(competition.id).catch(() => null), champion(competition.id).catch(() => null)]);
  if (draw?.execution?.status === 'PENDING_CONFIRMATION') decisions.push({ competition, detail: `${String(draw.execution.matchCount)} encuentros · evidencia ${draw.execution.evidenceHash.slice(0, 10)}…`, kind: 'DRAW', originatorId: draw.execution.executedBy.id, originatorName: draw.execution.executedBy.displayName, resourceId: draw.execution.id, revision: draw.execution.revision, title: 'Sorteo oficial pendiente' });
  for (const match of results?.matches ?? []) if (match.result?.status === 'PENDING_CONFIRMATION') decisions.push({ competition, detail: `${match.participantA.displayName} vs ${match.participantB.displayName} · ${match.group === null ? `Ronda ${String(match.roundNumber)}` : `Grupo ${match.group.label}`}`, kind: 'RESULT', originatorId: match.result.recordedBy.id, originatorName: match.result.recordedBy.displayName, resourceId: match.result.id, revision: match.result.revision, title: 'Resultado pendiente' });
  for (const group of results?.groups ?? []) { const qualification = group.qualification; if (qualification?.status === 'PENDING_CONFIRMATION') decisions.push({ competition, detail: `Grupo ${group.label}: 1.º ${qualification.firstParticipant.displayName} · 2.º ${qualification.secondParticipant.displayName}`, kind: 'QUALIFICATION', originatorId: qualification.proposedBy.id, originatorName: qualification.proposedBy.displayName, resourceId: qualification.id, revision: qualification.revision, title: 'Clasificados pendientes' }); }
  if (championView?.status === 'PENDING_CONFIRMATION') decisions.push({ competition, detail: `${championView.participantDisplayName} · ronda final ${String(championView.sourceRoundNumber)}`, kind: 'CHAMPION', originatorId: championView.proposedBy, originatorName: championView.proposedBy, resourceId: championView.proposalId, revision: championView.competitionRevision, title: 'Campeón pendiente' });
  return decisions;
}

function ConfirmationsWorkspace({ actor }: { readonly actor: Actor }): React.JSX.Element {
  const [items, setItems] = useState<readonly PendingDecision[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DecisionFilter>('ALL');
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function reload(): Promise<void> { const list = await competitions(); const pending = await Promise.all(list.map(decisionsFor)); setItems(pending.flat()); }
  useEffect(() => { let mounted = true; void reload().catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar las confirmaciones.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return items.filter((item) => { const identity = `${item.title} ${item.detail} ${competitionLabel(item.competition)} ${item.originatorName}`.toLocaleLowerCase('es-PY'); return (filter === 'ALL' || item.kind === filter) && (normalized.length === 0 || identity.includes(normalized)); });
  }, [filter, items, query]);

  async function confirm(decision: PendingDecision): Promise<void> {
    setError(null); setSubmitting(`${decision.kind}:${decision.resourceId}`);
    try {
      if (decision.kind === 'DRAW') await confirmOfficialDraw(decision.resourceId, decision.revision);
      if (decision.kind === 'RESULT') await confirmMatchResult(decision.resourceId, decision.revision);
      if (decision.kind === 'QUALIFICATION') await confirmGroupQualification(decision.resourceId, decision.revision);
      if (decision.kind === 'CHAMPION') await confirmChampion(decision.competition.id, decision.resourceId, decision.revision);
      await reload();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible confirmar la decisión.'); }
    finally { setSubmitting(null); }
  }

  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setItems(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }
  if (loading) return <WorkspaceState detail="Buscando decisiones pendientes de confirmación." title="Cargando confirmaciones…" />;
  if (items === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Confirmaciones." tone="error" />;

  const canConfirmOwn = actor.role === 'SUPERADMIN';
  const actionable = items.filter((item) => item.originatorId !== actor.id || canConfirmOwn).length;
  const ownBlocked = items.filter((item) => item.originatorId === actor.id && !canConfirmOwn).length;

  return <PageLayout>
    <PageHeader description="Revisa decisiones críticas con separación de funciones. Cada confirmación es una transición explícita y auditada." eyebrow="Control" title="Confirmaciones" />
    {error === null ? null : <Notice description={error} title="No fue posible confirmar" tone="danger" />}
    <StatusSummary label="Resumen de confirmaciones"><StatusBadge label={`${String(actionable)} disponibles para confirmar`} tone="success" />{ownBlocked > 0 ? <StatusBadge label={`${String(ownBlocked)} requieren otra autoridad`} tone="warning" /> : null}</StatusSummary>
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setFilter} query={query} searchLabel="Buscar confirmación" searchPlaceholder="Buscar competencia, participante o autoridad…" status={filter} statusLabel="Filtrar confirmaciones por tipo" statusOptions={FILTER_OPTIONS} total={items.length} />
    <DataList empty={{ description: items.length === 0 ? 'La bandeja está al día.' : 'Ajusta la búsqueda o el filtro.', title: items.length === 0 ? 'No hay confirmaciones pendientes.' : 'No encontramos decisiones.' }} isEmpty={filtered.length === 0} label="Decisiones pendientes">
      {filtered.map((decision) => {
        const ownDecision = decision.originatorId === actor.id; const blockedOwnDecision = ownDecision && !canConfirmOwn; const key = `${decision.kind}:${decision.resourceId}`;
        return <DataRow action={blockedOwnDecision ? undefined : <ActionButton disabled={submitting !== null} onPress={() => void confirm(decision)} size="sm" variant="secondary">{submitting === key ? 'Confirmando…' : 'Confirmar'}</ActionButton>} description={decision.detail} key={key} meta={competitionLabel(decision.competition)} status={<StatusBadge label={ownDecision ? canConfirmOwn ? 'Originada por ti · confirmable' : 'Requiere otra autoridad' : `Por ${decision.originatorName}`} tone={blockedOwnDecision ? 'warning' : 'success'} />} title={decision.title} visual={kindLabels[decision.kind].slice(0, 2).toUpperCase()} />;
      })}
    </DataList>
  </PageLayout>;
}

export function ConfirmationsClient(): React.JSX.Element { return <SessionBoundary allowedRoles={CONTROL_ROLES}>{(actor) => <AppShell actor={actor} active="confirmations" title="Confirmaciones"><ConfirmationsWorkspace actor={actor} /></AppShell>}</SessionBoundary>; }
