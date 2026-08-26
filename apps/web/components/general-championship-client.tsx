'use client';

import { Button, Card, Chip } from '@heroui/react';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  activateGeneralChampionship,
  addGeneralPlacementContribution,
  addGeneralSpecialContribution,
  annulGeneralContribution,
  confirmGeneralContribution,
  createGeneralChampionship,
  finalizeGeneralChampionship,
  generalChampionshipByScope,
  generalChampionshipCatalog,
  generalChampionshipOptions,
  saveGeneralScoring,
  syncGeneralChampionship,
  type GeneralChampionshipCatalogView,
  type GeneralChampionshipOptionsView,
  type GeneralChampionshipView,
  type GeneralScoringRuleView,
} from '../lib/general-championship-api';
import { DataTable, type DataTableColumn, InlineActions, Notice, PageHeader, PageLayout, Panel, PanelStack, StatusBadge } from '../ui';
import { AppShell } from './app-shell';
import styles from './general-championship-client.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const WORKSPACE_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;

type StandingRow = GeneralChampionshipView['standings'][number];

const standingColumns: readonly DataTableColumn<StandingRow>[] = [
  { className: styles.positionColumn ?? '', id: 'position', label: '#', render: (row) => <strong>{row.position}{row.tied ? '=' : ''}</strong> },
  { className: styles.institutionColumn ?? '', id: 'institution', label: 'Institución', render: (row) => <span className={styles.institutionCell}><strong>{row.institution.name}</strong><small>{row.contributionCount} aportes oficiales</small></span> },
  { align: 'right', className: styles.sourceColumn ?? '', id: 'sources', label: 'Fuentes', render: (row) => <span>{row.placementContributionCount} dep. · {row.specialContributionCount} esp.</span> },
  { align: 'right', className: styles.pointsColumn ?? '', id: 'points', label: 'Puntos', render: (row) => <strong className={styles.totalPoints}>{row.totalPoints}</strong> },
];

function statusTone(status: GeneralChampionshipView['status']): 'default' | 'success' | 'warning' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'default';
}

function contributionStatus(status: GeneralChampionshipView['contributions'][number]['status']): { label: string; tone: 'default' | 'success' | 'warning' } {
  if (status === 'CONFIRMED') return { label: 'Confirmado', tone: 'success' };
  if (status === 'PENDING_CONFIRMATION') return { label: 'Por confirmar', tone: 'warning' };
  return { label: 'Anulado', tone: 'default' };
}

function GeneralChampionshipWorkspace({ actorId, role }: { readonly actorId: string; readonly role: 'ADMIN' | 'OPERATOR' | 'SUPERADMIN' }): React.JSX.Element {
  const [catalog, setCatalog] = useState<GeneralChampionshipCatalogView | null>(null);
  const [editionId, setEditionId] = useState('');
  const [eventId, setEventId] = useState('');
  const [championship, setChampionship] = useState<GeneralChampionshipView | null | undefined>(undefined);
  const [options, setOptions] = useState<GeneralChampionshipOptionsView | null>(null);
  const [rules, setRules] = useState<readonly GeneralScoringRuleView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);

  async function loadScope(nextEditionId: string, nextEventId: string): Promise<void> {
    if (nextEditionId.length === 0 || nextEventId.length === 0) { setChampionship(null); setOptions(null); return; }
    const loaded = await generalChampionshipByScope(nextEditionId, nextEventId);
    setChampionship(loaded);
    setRules(loaded?.rules ?? []);
    setOptions(loaded === null ? null : await generalChampionshipOptions(loaded.id));
  }

  useEffect(() => {
    let mounted = true;
    void generalChampionshipCatalog().then(async (loaded) => {
      if (!mounted) return;
      setCatalog(loaded);
      const firstEdition = loaded.editions[0]?.id ?? '';
      const firstEvent = loaded.events[0]?.id ?? '';
      setEditionId(firstEdition);
      setEventId(firstEvent);
      if (firstEdition.length > 0 && firstEvent.length > 0) await loadScope(firstEdition, firstEvent);
    }).catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar Campeonato General.'); });
    return () => { mounted = false; };
  }, []);

  async function apply(action: string, mutation: () => Promise<GeneralChampionshipView>): Promise<void> {
    setBusy(action); setError(null);
    try {
      const next = await mutation();
      setChampionship(next); setRules(next.rules);
      setOptions(await generalChampionshipOptions(next.id));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible completar la operación.');
    } finally { setBusy(null); }
  }

  const selectedEdition = catalog?.editions.find((entry) => entry.id === editionId);
  const selectedEvent = catalog?.events.find((entry) => entry.id === eventId);
  const pending = championship?.contributions.filter((entry) => entry.status === 'PENDING_CONFIRMATION') ?? [];
  const uniqueLeader = championship !== null && championship !== undefined && championship.standings.length > 0 && (championship.standings[1]?.totalPoints ?? -1) !== championship.standings[0]?.totalPoints;

  if (catalog === null && error === null) return <WorkspaceState detail="Recuperando ediciones, categorías y tabla general." title="Cargando Campeonato General…" />;
  if (catalog === null) return <WorkspaceState detail={error ?? 'No fue posible abrir el módulo.'} title="No fue posible cargar Campeonato General." tone="error" />;

  async function changeScope(nextEditionId: string, nextEventId: string): Promise<void> {
    setEditionId(nextEditionId); setEventId(nextEventId); setChampionship(undefined); setError(null);
    try { await loadScope(nextEditionId, nextEventId); } catch (caught: unknown) { setChampionship(null); setError(caught instanceof Error ? caught.message : 'No fue posible cambiar el alcance.'); }
  }

  return <PageLayout>
    <PageHeader description="Suma aportes oficiales de todos los deportes y actividades de una edición. El total siempre se reconstruye desde contribuciones confirmadas." eyebrow="Competencia" title="Campeonato General" />

    <Panel>
      <div className={styles.scopeBar}>
        <label>Edición<select aria-label="Edición del Campeonato General" onChange={(event) => void changeScope(event.target.value, eventId)} value={editionId}>{catalog.editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.name}</option>)}</select></label>
        <label>Categoría / evento<select aria-label="Categoría del Campeonato General" onChange={(event) => void changeScope(editionId, event.target.value)} value={eventId}>{catalog.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
        <div className={styles.scopeContext}><span>Tabla independiente</span><strong>{selectedEdition === undefined ? '—' : String(selectedEdition.year)} · {selectedEvent?.name ?? 'Selecciona una categoría'}</strong></div>
      </div>
    </Panel>

    {error === null ? null : <Notice description={error} title="La operación no pudo completarse" tone="danger" />}
    {championship === undefined ? <WorkspaceState detail="Recuperando el ledger oficial de puntos." title="Actualizando tabla general…" /> : championship === null ? <EmptyChampionship canCreate={role !== 'OPERATOR'} edition={selectedEdition?.name ?? 'Edición'} event={selectedEvent?.name ?? 'Categoría'} loading={busy === 'create'} onCreate={() => void apply('create', () => createGeneralChampionship({ editionId, eventId, name: `Campeonato General ${selectedEvent?.name ?? ''} ${selectedEdition === undefined ? '' : String(selectedEdition.year)}`.trim() }))} /> : <>
      <section aria-label="Resumen del Campeonato General" className={styles.hero}>
        <div><span className={styles.heroEyebrow}>{championship.status === 'FINALIZED' ? 'Campeonato cerrado' : 'Tabla oficial acumulada'}</span><h2>{championship.name}</h2><p>{championship.edition.name} · {championship.event.name}</p></div>
        <div className={styles.heroStatus}><StatusBadge label={championship.status === 'DRAFT' ? 'Configuración' : championship.status === 'ACTIVE' ? 'En curso' : 'Finalizado'} tone={statusTone(championship.status)} />{championship.champion === null ? <small>{championship.standings[0] === undefined ? 'Sin puntuaciones confirmadas' : `Líder provisional · ${championship.standings[0].institution.name}`}</small> : <><strong>{championship.champion.institutionName}</strong><small>Campeón General · {championship.champion.points} pts</small></>}</div>
      </section>

      {championship.status === 'DRAFT' ? <ScoringEditor busy={busy} onActivate={() => void apply('activate', () => activateGeneralChampionship(championship.id, championship.revision))} onChange={setRules} onSave={() => void apply('rules', () => saveGeneralScoring(championship.id, championship.revision, rules))} readOnly={role === 'OPERATOR'} rules={rules} /> : <>
        <Panel header={<><div className={styles.panelIdentity}><span>Clasificación transversal</span><strong>Tabla general</strong></div><StatusBadge label={`${String(championship.standings.length)} instituciones con puntos`} tone="default" /></>}>
          {championship.standings.length === 0 ? <div className={styles.emptyBlock}><strong>Aún no existen puntos confirmados.</strong><small>Sincroniza competencias finalizadas o registra un aporte oficial.</small></div> : <DataTable columns={standingColumns} getRowKey={(row) => row.institution.id} label="Tabla del Campeonato General" rows={championship.standings} width="medium" />}
        </Panel>

        {role === 'OPERATOR' || championship.status === 'FINALIZED' ? null : <Panel header={<><div className={styles.panelIdentity}><span>Operación</span><strong>Incorporar puntuaciones</strong></div><Chip size="sm" variant="soft">Total derivado, no editable</Chip></>}>
          <div className={styles.operationGrid}>
            <OperationCard description="Busca competencias finalizadas del mismo evento y agrega únicamente campeón/subcampeón cuando la evidencia permite demostrarlo." label="Resultados deportivos" title="Sincronizar finalizadas"><Button isDisabled={busy !== null} onPress={() => void apply('sync', () => syncGeneralChampionship(championship.id, championship.revision))} variant="secondary">{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar'}</Button></OperationCard>
            <OperationCard description="Registra un puesto oficial que el sistema no puede inferir automáticamente. Los puntos salen de la plantilla congelada." label="Ubicación verificada" title="Agregar puesto"><Button isDisabled={busy !== null || (options?.competitions.length ?? 0) === 0} onPress={() => setPlacementOpen((value) => !value)} variant="secondary">Agregar ubicación</Button></OperationCard>
            <OperationCard description="Mejor Hinchada, Fair Play u otra actividad que aporta al Campeonato General sin ser una competencia deportiva." label="Puntuación adicional" title="Agregar aporte"><Button isDisabled={busy !== null} onPress={() => setSpecialOpen((value) => !value)} variant="secondary">Agregar especial</Button></OperationCard>
          </div>
          {placementOpen ? <PlacementForm championship={championship} loading={busy === 'placement'} onCancel={() => setPlacementOpen(false)} onSubmit={(input) => void apply('placement', () => addGeneralPlacementContribution(championship.id, { ...input, expectedRevision: championship.revision })).then(() => setPlacementOpen(false))} options={options} /> : null}
          {specialOpen ? <SpecialForm loading={busy === 'special'} onCancel={() => setSpecialOpen(false)} onSubmit={(input) => void apply('special', () => addGeneralSpecialContribution(championship.id, { ...input, expectedRevision: championship.revision })).then(() => setSpecialOpen(false))} options={options} /> : null}
        </Panel>}

        <ContributionLedger actorId={actorId} busy={busy} championship={championship} onApply={apply} role={role} />

        {championship.status === 'ACTIVE' && role === 'SUPERADMIN' ? <Panel header={<><div className={styles.panelIdentity}><span>Cierre oficial</span><strong>Campeón General</strong></div><StatusBadge label={pending.length > 0 ? `${String(pending.length)} aportes pendientes` : uniqueLeader ? 'Listo para cerrar' : 'Revisión necesaria'} tone={pending.length > 0 || !uniqueLeader ? 'warning' : 'success'} /></>}>
          <div className={styles.finalizeRow}><div><strong>{championship.standings[0]?.institution.name ?? 'Sin líder todavía'}</strong><small>{championship.standings[0] === undefined ? 'Necesitas al menos una contribución confirmada.' : uniqueLeader ? `${String(championship.standings[0].totalPoints)} puntos · líder único.` : 'Existe empate en el primer puesto. No se aplicará un desempate oculto.'}</small></div><Button isDisabled={busy !== null || pending.length > 0 || !uniqueLeader} onPress={() => void apply('finalize', () => finalizeGeneralChampionship(championship.id, championship.revision))} variant="primary">{busy === 'finalize' ? 'Finalizando…' : 'Confirmar Campeón General'}</Button></div>
        </Panel> : null}
      </>}
    </>}
  </PageLayout>;
}

function EmptyChampionship({ canCreate, edition, event, loading, onCreate }: { readonly canCreate: boolean; readonly edition: string; readonly event: string; readonly loading: boolean; readonly onCreate: () => void }): React.JSX.Element {
  return <Panel><div className={styles.emptyState}><span className={styles.trophy}>★</span><div><strong>No existe un Campeonato General para {event}.</strong><p>Crea una tabla independiente para {edition}. Se inicia con 100 / 70 / 50 / 25 puntos, totalmente configurable antes de activarla.</p></div>{canCreate ? <Button isDisabled={loading} onPress={onCreate} variant="primary">{loading ? 'Creando…' : 'Crear Campeonato General'}</Button> : <small>Una autoridad administrativa debe crear esta tabla.</small>}</div></Panel>;
}

function ScoringEditor({ busy, onActivate, onChange, onSave, readOnly, rules }: { readonly busy: string | null; readonly onActivate: () => void; readonly onChange: (rules: readonly GeneralScoringRuleView[]) => void; readonly onSave: () => void; readonly readOnly: boolean; readonly rules: readonly GeneralScoringRuleView[] }): React.JSX.Element {
  return <Panel header={<><div className={styles.panelIdentity}><span>Plantilla previa</span><strong>Puntos por posición</strong></div><StatusBadge label="Borrador editable" tone="warning" /></>}>
    <p className={styles.supportText}>Esta tabla define cuánto suma cada puesto en cada deporte. Al activarla queda congelada para preservar la trazabilidad.</p>
    <div className={styles.ruleGrid}>{rules.map((rule, index) => <div className={styles.ruleRow} key={rule.placement}><span>{rule.placement}.º</span><input aria-label={`Nombre del puesto ${String(rule.placement)}`} disabled={readOnly} onChange={(event) => onChange(rules.map((entry, current) => current === index ? { ...entry, label: event.target.value } : entry))} value={rule.label}/><label><input aria-label={`Puntos del puesto ${String(rule.placement)}`} disabled={readOnly} min="0" onChange={(event) => onChange(rules.map((entry, current) => current === index ? { ...entry, points: Number(event.target.value) } : entry))} type="number" value={rule.points}/><span>pts</span></label></div>)}</div>
    {readOnly ? null : <InlineActions><Button isDisabled={busy !== null} onPress={onSave} variant="secondary">{busy === 'rules' ? 'Guardando…' : 'Guardar puntuación'}</Button><Button isDisabled={busy !== null || rules.length === 0} onPress={onActivate} variant="primary">{busy === 'activate' ? 'Activando…' : 'Activar y congelar'}</Button></InlineActions>}
  </Panel>;
}

function OperationCard({ children, description, label, title }: { readonly children: React.ReactNode; readonly description: string; readonly label: string; readonly title: string }): React.JSX.Element {
  return <Card className={styles.operationCard ?? ''}><Card.Content><span>{label}</span><strong>{title}</strong><p>{description}</p>{children}</Card.Content></Card>;
}

function PlacementForm({ championship, loading, onCancel, onSubmit, options }: { readonly championship: GeneralChampionshipView; readonly loading: boolean; readonly onCancel: () => void; readonly onSubmit: (input: { competitionId: string; description: string; institutionId: string; placement: number }) => void; readonly options: GeneralChampionshipOptionsView | null }): React.JSX.Element {
  const [competitionId, setCompetitionId] = useState(options?.competitions[0]?.id ?? '');
  const [institutionId, setInstitutionId] = useState(options?.institutions[0]?.id ?? '');
  const [placement, setPlacement] = useState(championship.rules[0]?.placement ?? 1);
  const [description, setDescription] = useState('Ubicación oficial validada por la organización de la OES.');
  function submit(event: SyntheticEvent<HTMLFormElement>): void { event.preventDefault(); onSubmit({ competitionId, description, institutionId, placement }); }
  return <form className={styles.inlineForm} onSubmit={submit}><div className={styles.formHeader}><span>Ubicación oficial</span><strong>Aporte deportivo manual</strong></div><div className={styles.formGrid}><label>Competencia<select onChange={(event) => setCompetitionId(event.target.value)} required value={competitionId}>{options?.competitions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label><label>Institución<select onChange={(event) => setInstitutionId(event.target.value)} required value={institutionId}>{options?.institutions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Puesto<select onChange={(event) => setPlacement(Number(event.target.value))} value={placement}>{championship.rules.map((rule) => <option key={rule.placement} value={rule.placement}>{rule.placement}.º · {rule.label} · {rule.points} pts</option>)}</select></label><label className={styles.wideField}>Descripción<textarea maxLength={500} minLength={5} onChange={(event) => setDescription(event.target.value)} value={description}/></label></div><InlineActions><Button isDisabled={loading} type="submit" variant="primary">{loading ? 'Registrando…' : 'Enviar a confirmación'}</Button><Button isDisabled={loading} onPress={onCancel} type="button" variant="ghost">Cancelar</Button></InlineActions></form>;
}

function SpecialForm({ loading, onCancel, onSubmit, options }: { readonly loading: boolean; readonly onCancel: () => void; readonly onSubmit: (input: { description: string; institutionId: string; points: number; title: string }) => void; readonly options: GeneralChampionshipOptionsView | null }): React.JSX.Element {
  const [institutionId, setInstitutionId] = useState(options?.institutions[0]?.id ?? '');
  const [title, setTitle] = useState('Mejor Hinchada');
  const [description, setDescription] = useState('Reconocimiento oficial que suma al Campeonato General.');
  const [points, setPoints] = useState(50);
  function submit(event: SyntheticEvent<HTMLFormElement>): void { event.preventDefault(); onSubmit({ description, institutionId, points, title }); }
  return <form className={styles.inlineForm} onSubmit={submit}><div className={styles.formHeader}><span>Aporte adicional</span><strong>Actividad o reconocimiento especial</strong></div><div className={styles.formGrid}><label>Institución<select onChange={(event) => setInstitutionId(event.target.value)} required value={institutionId}>{options?.institutions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Concepto<input maxLength={120} minLength={2} onChange={(event) => setTitle(event.target.value)} required value={title}/></label><label>Puntos<input min="1" onChange={(event) => setPoints(Number(event.target.value))} required type="number" value={points}/></label><label className={styles.wideField}>Descripción<textarea maxLength={500} minLength={5} onChange={(event) => setDescription(event.target.value)} required value={description}/></label></div><InlineActions><Button isDisabled={loading} type="submit" variant="primary">{loading ? 'Registrando…' : 'Enviar a confirmación'}</Button><Button isDisabled={loading} onPress={onCancel} type="button" variant="ghost">Cancelar</Button></InlineActions></form>;
}

function ContributionLedger({ actorId, busy, championship, onApply, role }: { readonly actorId: string; readonly busy: string | null; readonly championship: GeneralChampionshipView; readonly onApply: (action: string, mutation: () => Promise<GeneralChampionshipView>) => Promise<void>; readonly role: 'ADMIN' | 'OPERATOR' | 'SUPERADMIN' }): React.JSX.Element {
  const grouped = useMemo(() => championship.standings.map((standing) => ({ standing, contributions: championship.contributions.filter((entry) => entry.institution.id === standing.institution.id && entry.status !== 'ANNULLED') })), [championship]);
  return <PanelStack>{grouped.map(({ contributions, standing }) => <Panel key={standing.institution.id} header={<><div className={styles.panelIdentity}><span>{standing.position}.º en la general</span><strong>{standing.institution.name}</strong></div><span className={styles.ledgerTotal}>{standing.totalPoints} pts</span></>}>
    <div className={styles.ledger}>{contributions.map((entry) => { const state = contributionStatus(entry.status); const own = entry.recordedBy?.id === actorId; return <div className={styles.ledgerRow} key={entry.id}><div className={styles.ledgerSource}><span>{entry.sourceType === 'SPECIAL' ? 'Especial' : entry.source?.label ?? 'Competencia'}</span><strong>{entry.title}</strong><small>{entry.description}</small></div><div className={styles.ledgerState}><strong>+{entry.points}</strong><StatusBadge label={state.label} tone={state.tone} /></div>{role === 'OPERATOR' || championship.status === 'FINALIZED' ? null : <div className={styles.ledgerActions}>{entry.status === 'PENDING_CONFIRMATION' && (role === 'SUPERADMIN' || !own) ? <Button isDisabled={busy !== null} onPress={() => void onApply(`confirm-${entry.id}`, () => confirmGeneralContribution(entry.id, entry.revision))} size="sm" variant="secondary">Confirmar</Button> : null}{entry.status === 'CONFIRMED' && role === 'SUPERADMIN' ? <Button isDisabled={busy !== null} onPress={() => { const reason = window.prompt('Motivo formal de anulación (mínimo 10 caracteres)'); if (reason !== null && reason.trim().length >= 10) void onApply(`annul-${entry.id}`, () => annulGeneralContribution(entry.id, entry.revision, reason.trim())); }} size="sm" variant="ghost">Anular</Button> : null}</div>}</div>; })}</div>
  </Panel>)}</PanelStack>;
}

export function GeneralChampionshipClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={WORKSPACE_ROLES}>{(actor) => <AppShell actor={actor} active="general-championship" title="Campeonato General"><GeneralChampionshipWorkspace actorId={actor.id} role={actor.role} /></AppShell>}</SessionBoundary>;
}
