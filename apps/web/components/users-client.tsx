'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  createManagedUser,
  managedUsers,
  updateManagedUser,
  type ManagedUser,
  type ManagedUserRole,
  type ManagedUserStatus,
} from '../lib/users-admin-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const SUPERADMIN_ONLY = ['SUPERADMIN'] as const;
type UserFilter = 'ALL' | ManagedUserStatus;

const roleLabels: Readonly<Record<ManagedUserRole, string>> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  SUPERADMIN: 'Superadministrador',
};

interface UserDraft {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly role: ManagedUserRole;
  readonly status: ManagedUserStatus;
}

const emptyDraft: UserDraft = { displayName: '', email: '', password: '', role: 'OPERATOR', status: 'ACTIVE' };

function UserDrawer({ item, onClose, onSaved }: { readonly item: ManagedUser | null; readonly onClose: () => void; readonly onSaved: (user: ManagedUser) => void }): React.JSX.Element {
  const [draft, setDraft] = useState<UserDraft>(item === null ? emptyDraft : {
    displayName: item.displayName,
    email: item.email,
    password: '',
    role: item.role,
    status: item.status,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const saved = item === null
        ? await createManagedUser({ displayName: draft.displayName.trim(), email: draft.email.trim(), password: draft.password, role: draft.role })
        : await updateManagedUser(item.id, {
          displayName: draft.displayName.trim(),
          role: draft.role,
          status: draft.status,
          ...(draft.password.length === 0 ? {} : { password: draft.password }),
        });
      onSaved(saved);
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.drawerBackdrop} role="presentation"><aside aria-label={item === null ? 'Nuevo usuario' : 'Editar usuario'} className={styles.drawer}>
    <header className={styles.drawerHeader}><div><span className="eyebrow eyebrow--dark">Control</span><h3>{item === null ? 'Nuevo usuario' : 'Editar usuario'}</h3></div><button aria-label="Cerrar" onClick={onClose} type="button">×</button></header>
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      <label>Nombre visible *<input required maxLength={120} minLength={2} value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label>
      <label>Correo electrónico *<input required disabled={item !== null} maxLength={254} type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label>
      <label>{item === null ? 'Contraseña inicial *' : 'Nueva contraseña (opcional)'}<input required={item === null} minLength={12} maxLength={256} type="password" value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} /></label>
      <label>Rol *<select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as ManagedUserRole }))}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option><option value="SUPERADMIN">Superadministrador</option></select></label>
      {item === null ? null : <label>Estado *<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ManagedUserStatus }))}><option value="ACTIVE">Activo</option><option value="DISABLED">Desactivado</option></select></label>}
      {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
      <footer className={styles.drawerActions}><button disabled={saving} type="button" onClick={onClose}>Cancelar</button><button className={styles.primaryButton} disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar usuario'}</button></footer>
    </form>
  </aside></div>;
}

function UsersWorkspace(): React.JSX.Element {
  const [items, setItems] = useState<readonly ManagedUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('ALL');
  const [drawer, setDrawer] = useState<ManagedUser | 'NEW' | null>(null);

  async function reload(): Promise<void> { setItems(await managedUsers()); }

  useEffect(() => {
    let mounted = true;
    void reload().catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los usuarios.'); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const normalized = query.trim().toLocaleLowerCase('es-PY');
    return items.filter((item) => (filter === 'ALL' || item.status === filter) && (normalized.length === 0 || `${item.displayName} ${item.email} ${item.role}`.toLocaleLowerCase('es-PY').includes(normalized)));
  }, [filter, items, query]);

  function saved(user: ManagedUser): void {
    setItems((current) => current === null ? [user] : current.some((item) => item.id === user.id) ? current.map((item) => item.id === user.id ? user : item) : [...current, user]);
  }

  async function retry(): Promise<void> {
    setLoading(true); setError(null);
    try { await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); }
  }

  if (loading) return <div className="empty-state"><strong>Cargando usuarios…</strong><p>Recuperando cuentas y roles del sistema.</p></div>;
  if (items === null) return <div className="empty-state"><strong>No fue posible cargar Usuarios.</strong><p>{error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'}</p><button className={styles.primaryButton} onClick={() => void retry()} type="button">Reintentar</button></div>;

  return <div className={styles.workspace}>
    <section className={styles.heading}><div><span className="eyebrow eyebrow--dark">Control</span><h2>Usuarios</h2><p>Administra cuentas, roles y acceso. Solo el SUPERADMIN puede modificar esta superficie; cambios de rol, estado o contraseña invalidan sesiones vigentes.</p></div><button className={styles.primaryButton} onClick={() => setDrawer('NEW')} type="button">+ Nuevo usuario</button></section>
    {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
    <section aria-label="Filtros de usuarios" className={styles.toolbar}><input aria-label="Buscar usuario" placeholder="Buscar nombre, correo o rol…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filtrar usuarios por estado" value={filter} onChange={(event) => setFilter(event.target.value as UserFilter)}><option value="ALL">Todos</option><option value="ACTIVE">Activos</option><option value="DISABLED">Desactivados</option></select><span/><span className={styles.counter}>{filtered.length} de {items.length}</span></section>
    <section aria-label="Listado de usuarios" className={styles.tableCard}><div className={styles.tableHeader}><span>Cuenta</span><span>Usuario</span><span>Rol</span><span>Estado</span><span>Acción</span></div>{filtered.length === 0 ? <div className={styles.empty}><strong>{items.length === 0 ? 'Aún no hay usuarios.' : 'No encontramos usuarios.'}</strong><p>{items.length === 0 ? 'Crea la primera cuenta administrada.' : 'Ajusta la búsqueda o el filtro.'}</p></div> : filtered.map((item) => <article className={styles.row} key={item.id}><span className={styles.logo}>{item.displayName.charAt(0).toUpperCase()}</span><div className={styles.identity}><strong>{item.displayName}</strong><small>{item.email}{item.lastLoginAt === null ? ' · nunca ingresó' : ` · último acceso ${new Intl.DateTimeFormat('es-PY', { dateStyle: 'short' }).format(new Date(item.lastLoginAt))}`}</small></div><span className={styles.eventName}>{roleLabels[item.role]}</span><span className={[styles.status, item.status === 'ACTIVE' ? styles.active : styles.inactive].filter(Boolean).join(' ')}>{item.status === 'ACTIVE' ? 'Activo' : 'Desactivado'}</span><button className={styles.editButton} onClick={() => setDrawer(item)} type="button">Editar</button></article>)}</section>
    {drawer === null ? null : <UserDrawer item={drawer === 'NEW' ? null : drawer} onClose={() => setDrawer(null)} onSaved={saved} />}
  </div>;
}

export function UsersClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={SUPERADMIN_ONLY}>{(actor) => <AppShell actor={actor} active="users" title="Usuarios"><UsersWorkspace /></AppShell>}</SessionBoundary>;
}
