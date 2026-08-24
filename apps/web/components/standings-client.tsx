'use client';

import { Alert, Card, Chip, Input } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';

import {
  competitions,
  resultsWorkspace,
  type CompetitionSummary,
  type ResultsWorkspace,
  type StandingRowView,
} from '../lib/competition-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;
type StandingFilter = 'ALL' | 'COMPLETE' | 'PARTIAL' | 'QUALIFIED' | 'PENDING_QUALIFICATION';

interface StandingGroup {
  readonly competition: CompetitionSummary;
  readonly group: ResultsWorkspace['groups'][number];
  readonly resultProfile: ResultsWorkspace['resultProfile'];
}

interface CompetitionStandingsLoad {
  readonly failed: boolean;
  readonly groups: readonly StandingGroup[];
}

function groupState(group: StandingGroup['group']): Exclude<StandingFilter, 'ALL'> {
  if (group.qualification?.status === 'CONFIRMED') return 'QUALIFIED';
  if (group.qualification?.status === 'PENDING_CONFIRMATION') return 'PENDING_QUALIFICATION';
  return group.complete ? 'COMPLETE' : 'PARTIAL';
}

function stateLabel(group: StandingGroup['group']): string {
  if (group.qualification?.status === 'CONFIRMED') return 'Clasificación confirmada';
  if (group.qualification?.status === 'PENDING_CONFIRMATION') return 'Clasificación por confirmar';
  return group.complete ? 'Tabla completa' : 'Tabla parcial';
}

function MetricHeaders({ setBased }: { readonly setBased: boolean }): React.JSX.Element {
  return setBased
    ? <><th>J</th><th>G</th><th>P</th><th>Pts.</th><th>SG</th><th>DP</th></>
    : <><th>J</th><th>G</th><th>E</th><th>P</th><th>Pts.</th><th>GF</th><th>GC</th><th>DG</th></>;
}

function MetricCells({ row, setBased }: { readonly row: StandingRowView; readonly setBased: boolean }): React.JSX.Element {
  return setBased
    ? <><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td><strong>{row.tablePoints}</strong></td><td>{row.setDifference}</td><td>{row.sportPointDifference}</td></>
    : <><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td><strong>{row.tablePoints}</strong></td><td>{row.scoreFor}</td><td>{row.scoreAgainst}</td><td>{row.scoreDifference}</td></>;
}

function StandingsWorkspace(): React.JSX.Element {
  const [groups, setGroups] = useState<readonly StandingGroup[] | null>(null);
  const [failedCompetitionCount, setFailedCompetitionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StandingFilter>('ALL');

  async function reload(): Promise<void> {
    const list = await competitions();
    const loaded = await Promise.all(list.map(async (competition): Promise<CompetitionStandingsLoad> => {
      if (competition.status !== 'LOCKED' && competition.status !== 'FINALIZED') return { failed: false, groups: [] };
      try {
        const workspace = await resultsWorkspace(competition.id);
        return { failed: false, groups: workspace.groups.map((group) => ({ competition, group, resultProfile: workspace.resultProfile } satisfies StandingGroup)) };
      } catch {
        return { failed: true, groups: [] };
      }
    }));
    setFailedCompetitionCount(loaded.filter((entry) => entry.failed).length);
    setGroups(loaded.flatMap((entry) => entry.groups));
  }

  useEffect(() => {
    let mounted = true;
    void reload()
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar la clasificación.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (groups === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return groups.filter(({ competition, group }) => {
      const participants = group.standings.map((row) => row.participant.displayName).join(' ');
      const identity = `${competition.edition.name} ${competition.event.name} ${competition.sport.name} ${competition.modality.name} ${group.label} ${participants}`.toLocaleLowerCase('es-PY');
      return (normalized.length === 0 || identity.includes(normalized)) && (filter === 'ALL' || groupState(group) === filter);
    });
  }, [filter, groups, query]);

  async function retry(): Promise<void> {
    setLoading(true); setError(null);
    try { await reload(); }
    catch (caught: unknown) { setGroups(null); setFailedCompetitionCount(0); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); }
    finally { setLoading(false); }
  }

  if (loading) return <WorkspaceState detail="Recuperando tablas oficiales desde el servidor." title="Cargando clasificación…" />;
  if (groups === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Clasificación." tone="error" />;

  const confirmed = groups.filter(({ group }) => group.qualification?.status === 'CONFIRMED').length;
  const pending = groups.filter(({ group }) => group.qualification?.status === 'PENDING_CONFIRMATION').length;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Competencia</span><h2>Clasificación</h2><p>Consulta las tablas calculadas por el motor competitivo y el estado oficial de los clasificados. Esta vista no recalcula posiciones: presenta la misma fuente de verdad utilizada por cada competencia.</p></div>
    </section>
    {failedCompetitionCount === 0 ? null : <Alert status="warning" role="status"><Alert.Indicator /><Alert.Content><Alert.Title>Tablas parciales</Alert.Title><Alert.Description>No fue posible recuperar tablas de {failedCompetitionCount} {failedCompetitionCount === 1 ? 'competencia' : 'competencias'}. Las tablas disponibles de las demás competencias siguen visibles.</Alert.Description></Alert.Content></Alert>}
    <section aria-label="Resumen de clasificación" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
      <Chip color="success" size="sm" variant="soft">{confirmed} grupos confirmados</Chip>
      <Chip color="warning" size="sm" variant="soft">{pending} por confirmar</Chip>
    </section>
    <section aria-label="Filtros de clasificación" className={styles.toolbar}>
      <Input aria-label="Buscar clasificación" placeholder="Buscar competencia, grupo o participante…" value={query} onChange={(event) => setQuery(event.target.value)} variant="secondary" />
      <select aria-label="Filtrar clasificación por estado" value={filter} onChange={(event) => setFilter(event.target.value as StandingFilter)}>
        <option value="ALL">Todos los estados</option>
        <option value="PARTIAL">Tabla parcial</option>
        <option value="COMPLETE">Tabla completa</option>
        <option value="PENDING_QUALIFICATION">Clasificación por confirmar</option>
        <option value="QUALIFIED">Clasificación confirmada</option>
      </select>
      <span />
      <span className={styles.counter}>{filtered.length} de {groups.length} grupos</span>
    </section>
    {filtered.length === 0 ? <Card className={styles.tableCard ?? ''}><Card.Content><div className={styles.empty}><strong>{groups.length === 0 ? 'Aún no hay tablas de grupos.' : 'No encontramos clasificaciones.'}</strong><p>{groups.length === 0 ? 'Las tablas aparecerán cuando existan encuentros de fase de grupos.' : 'Ajusta la búsqueda o el filtro.'}</p></div></Card.Content></Card> : filtered.map(({ competition, group, resultProfile }) => {
      const setBased = resultProfile === 'SET_BASED';
      const qualification = group.qualification;
      return <Card className={styles.tableCard ?? ''} key={`${competition.id}-${group.id}`} style={{ marginBottom: 18 }}>
        <Card.Header style={{ alignItems: 'center', display: 'flex', gap: 16, justifyContent: 'space-between', padding: '18px 22px' }}>
          <div className={styles.identity}><strong>{competition.sport.name} · {competition.modality.name} · Grupo {group.label}</strong><small>{competition.edition.name} / {competition.event.name}</small></div>
          <Chip color={qualification?.status === 'CONFIRMED' ? 'success' : qualification?.status === 'PENDING_CONFIRMATION' ? 'warning' : 'default'} size="sm" variant="soft">{stateLabel(group)}</Chip>
        </Card.Header>
        <Card.Content style={{ padding: 0 }}><div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: setBased ? 680 : 820, width: '100%' }}>
            <thead><tr><th style={{ padding: 14, textAlign: 'left' }}>Pos.</th><th style={{ padding: 14, textAlign: 'left' }}>Participante</th><MetricHeaders setBased={setBased} /></tr></thead>
            <tbody>{group.standings.map((row) => <tr key={row.participant.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: 14 }}>{row.position}{row.tied ? '=' : ''}</td><th style={{ padding: 14, textAlign: 'left' }}>{row.participant.displayName}</th><MetricCells row={row} setBased={setBased} /></tr>)}</tbody>
          </table>
        </div></Card.Content>
        {qualification === null ? null : <Card.Footer style={{ alignItems: 'center', background: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', padding: '16px 22px' }}>
          <div className={styles.identity}><strong>1.º {qualification.firstParticipant.displayName} · 2.º {qualification.secondParticipant.displayName}</strong><small>{qualification.status === 'CONFIRMED' ? `Confirmado por ${qualification.confirmedBy?.displayName ?? 'autoridad'}` : 'Propuesta pendiente de confirmación independiente'}</small></div>
          <a className={styles.editButton} href={`/competitions/${competition.id}#results-workspace`} style={{ alignItems: 'center', display: 'flex', justifyContent: 'center', padding: '0 14px', textDecoration: 'none' }}>Ver competencia</a>
        </Card.Footer>}
      </Card>;
    })}
  </div>;
}

export function StandingsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="standings" title="Clasificación"><StandingsWorkspace /></AppShell>}</SessionBoundary>;
}
