'use client';

import { developerProfile } from '../lib/developer-profile';
import { DataList, DataRow, PageHeader, PageLayout, Panel, StatusBadge, StatusSummary } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';

const DEVELOPER_ROLES = ['ADMIN', 'OPERATOR', 'SUPERADMIN'] as const;

function DeveloperWorkspace(): React.JSX.Element {
  return <PageLayout>
    <PageHeader
      eyebrow="Sistema · Créditos"
      title="Desarrollador"
      description="Identidad del responsable del desarrollo y acceso a sus datos profesionales oficiales."
    />

    <StatusSummary label="Identidad del sistema">
      <StatusBadge label="Desarrollo oficial" tone="success" />
      <StatusBadge label="Datos centralizados" />
      <StatusBadge label="Acceso permanente" />
    </StatusSummary>

    <DataList label="Responsable del desarrollo">
      <DataRow visual="DL" title="Nombre completo" description="Desarrollador responsable de EncuentrosOES." meta={developerProfile.fullName} />
      <DataRow visual="RL" title="Rol" description="Responsabilidad principal dentro del producto." meta={developerProfile.role} />
      <DataRow visual="UB" title="Ubicación" description="Base profesional declarada del desarrollador." meta={developerProfile.location} />
    </DataList>

    <DataList label="Datos y enlaces oficiales">
      {developerProfile.links.map((link) => <DataRow
        key={link.href}
        visual="LK"
        title={link.label}
        description="Acceso directo al perfil oficial del desarrollador."
        meta={<a href={link.href} rel="noreferrer" target="_blank">{link.value}</a>}
        status={<StatusBadge label="Oficial" tone="success" />}
      />)}
    </DataList>

    <Panel padded>
      <strong>Créditos de desarrollo</strong>
      <p>EncuentrosOES fue diseñado y desarrollado para la gestión verificable de competencias de la OES. Los datos profesionales mostrados en esta página se administran desde una única fuente interna para evitar inconsistencias.</p>
    </Panel>
  </PageLayout>;
}

export function DeveloperClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={DEVELOPER_ROLES}>{(actor) => <AppShell actor={actor} active="developer" eyebrow="OES Workspace" title="Desarrollador"><DeveloperWorkspace /></AppShell>}</SessionBoundary>;
}
