'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { logout, type Actor } from '../lib/auth-api';
import styles from './app-shell.module.css';
import { OesMark } from './oes-mark';

type NavIconKind = 'audit' | 'competition' | 'confirmation' | 'dashboard' | 'edition' | 'event' | 'institution' | 'match' | 'modality' | 'settings' | 'sport' | 'standings' | 'draw' | 'users';

interface AppShellProps {
  readonly actor: Actor;
  readonly active: string;
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly title: string;
}

interface NavEntry {
  readonly href?: string;
  readonly icon: NavIconKind;
  readonly id: string;
  readonly label: string;
  readonly soon?: boolean;
}

const roleLabels = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  SUPERADMIN: 'Superadministrador',
} as const;

const organization: readonly NavEntry[] = [
  { href: '/admin/editions', icon: 'edition', id: 'editions', label: 'Ediciones' },
  { href: '/admin/events', icon: 'event', id: 'events', label: 'Eventos' },
  { href: '/admin/institutions', icon: 'institution', id: 'institutions', label: 'Instituciones' },
  { href: '/admin/sports', icon: 'sport', id: 'sports', label: 'Deportes' },
  { href: '/admin/modalities', icon: 'modality', id: 'modalities', label: 'Modalidades' },
];

const competition: readonly NavEntry[] = [
  { href: '/competitions', icon: 'competition', id: 'competitions', label: 'Competencias' },
  { href: '/draws', icon: 'draw', id: 'draws', label: 'Sorteos' },
  { href: '/matches', icon: 'match', id: 'matches', label: 'Encuentros' },
  { icon: 'standings', id: 'standings', label: 'Clasificación', soon: true },
];

const control: readonly NavEntry[] = [
  { icon: 'confirmation', id: 'confirmations', label: 'Confirmaciones', soon: true },
  { icon: 'audit', id: 'audit', label: 'Auditoría', soon: true },
  { icon: 'users', id: 'users', label: 'Usuarios', soon: true },
  { icon: 'settings', id: 'settings', label: 'Configuración', soon: true },
];

function NavIcon({ kind }: { readonly kind: NavIconKind }): React.JSX.Element {
  const path = {
    audit: <><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    competition: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M6 5H4a3 3 0 0 0 3 3M18 5h2a3 3 0 0 1-3 3M12 12v4M9 20h6M10 16h4"/></>,
    confirmation: <><path d="M7 3h10l3 3v14H4V3h3Z"/><path d="m8 12 2.5 2.5L16 9"/></>,
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    draw: <><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/><path d="M7.5 7.5h.01M16.5 16.5h.01M18.5 14.5h.01M14.5 18.5h.01"/></>,
    edition: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
    event: <><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z"/></>,
    institution: <><path d="M3 10h18M5 10V8l7-4 7 4v2M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16v2H4z"/></>,
    match: <><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h6"/></>,
    modality: <><circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="4"/><path d="M11 11l2 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4L19 13a7 7 0 0 0 .1-1Z"/></>,
    sport: <><circle cx="12" cy="12" r="8"/><path d="M12 4v4l3 2-1 4-4 1-3-3 1-4 4-4M4.7 14.8l4.3.2M15 10l4.3-1.5M14 14l1.8 4.4"/></>,
    standings: <><path d="M5 20V10h4v10M10 20V4h4v16M15 20v-7h4v7"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/></>,
  } as const;

  return <svg aria-hidden="true" className={styles.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">{path[kind]}</svg>;
}

function NavLabel({ icon, label }: { readonly icon: NavIconKind; readonly label: string }): React.JSX.Element {
  return <span className={styles.navLabel}><NavIcon kind={icon}/><span className={styles.navText}>{label}</span></span>;
}

function NavGroup({ active, entries, label }: { readonly active: string; readonly entries: readonly NavEntry[]; readonly label: string }): React.JSX.Element {
  return (
    <>
      <span className="nav-heading">{label}</span>
      {entries.map((entry) => {
        const className = `nav-item${active === entry.id ? ' nav-item--active' : ''}${entry.soon ? ' nav-item--disabled' : ''}`;
        const content = <><NavLabel icon={entry.icon} label={entry.label}/>{entry.soon ? <small>Próximo</small> : null}</>;
        return entry.soon || entry.href === undefined
          ? <span aria-disabled="true" className={className} key={entry.id}>{content}</span>
          : <a className={className} href={entry.href} key={entry.id}>{content}</a>;
      })}
    </>
  );
}

export function AppShell({ actor, active, children, eyebrow = 'OES Workspace', title }: AppShellProps): React.JSX.Element {
  const router = useRouter();

  async function closeSession(): Promise<void> {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <OesMark />
        <nav aria-label="Navegación principal">
          <a className={`nav-item${active === 'dashboard' ? ' nav-item--active' : ''}`} href="/dashboard"><NavLabel icon="dashboard" label="Inicio"/></a>
          {actor.role === 'OPERATOR' ? null : <NavGroup active={active} entries={organization} label="Organización" />}
          <NavGroup active={active} entries={competition} label="Competencia" />
          {actor.role === 'OPERATOR' ? null : <NavGroup active={active} entries={control} label="Control" />}
        </nav>
        <div className="sidebar__footer">Sistema oficial · OES</div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>
          <div className="account-menu">
            <span className="account-avatar" aria-hidden="true">{actor.displayName.charAt(0)}</span>
            <span><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span>
            <button className="text-button" onClick={() => void closeSession()} type="button">Salir</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
