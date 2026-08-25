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
import { DataList, DataRow, EntityDrawer, Field, FormActions, FormStack, ListToolbar, Notice, PageHeader, PageLayout, StatusBadge, TextField } from '../ui';
import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const SUPERADMIN_ONLY = ['SUPERADMIN'] as const;
type UserFilter = 'ALL' | ManagedUserStatus;
const FILTER_OPTIONS: readonly { readonly label: string; readonly value: UserFilter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Activos', value: 'ACTIVE' },
  { label: 'Desactivados', value: 'DISABLED' },
];
const roleLabels: Readonly<Record<ManagedUserRole, string>> = { ADMIN: 'Administrador', OPERATOR: 'Operador', SUPERADMIN: 'Superadministrador' };

interface UserDraft {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly role: ManagedUserRole;
  readonly status: ManagedUserStatus;
}
const emptyDraft: UserDraft = { displayName: '', email: '', password: '', role: 'OPERATOR', status: 'ACTIVE' };

function UserDrawer({ item, onClose, onSaved }: { readonly item: ManagedUser | null; readonly onClose: () => void; readonly onSaved: (user: ManagedUser) => void }): React.JSX.Element {
  const [draft, setDraft] = useState<UserDraft>(item === null ? emptyDraft : { displayName: item.displayName, email: item.email, password: '', role: item.role, status: item.status });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      const saved = item === null
        ? await createManagedUser({ displayName: draft.displayName.trim(), email: draft.email.trim(), password: draft.password, role: draft.role })
        : await updateManagedUser(item.id, { displayName: draft.displayName.trim(), role: draft.role, status: draft.status, ...(draft.password.length === 0 ? {} : { password: draft.password }) });
      onSaved(saved); onClose();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el usuario.'); }
    finally { setSaving(false); }
  }

  return <EntityDrawer eyebrow="Control" onClose={onClose} title={item === null ? 'Nuevo usuario' : 'Editar usuario'}>
    {error === null ? null : <Notice description={error} tone="danger" />}
    <FormStack onSubmit={(event) => void save(event)}>
      <TextField label="Nombre visible *" maxLength={120} minLength={2} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} required value={draft.displayName} />
      <TextField disabled={item !== null} label="Correo electrónico *" maxLength={254} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} required type="email" value={draft.email} />
      <TextField label={item === null ? 'Contraseña inicial *' : 'Nueva contraseña (opcional)'} maxLength={256} minLength={12} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} required={item === null} type="password" value={draft.password} />
      <Field label="Rol *"><select onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as ManagedUserRole }))} value={draft.role}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option><option value="SUPERADMIN">Superadministrador</option></select></Field>
      {item === null ? null : <Field label="Estado *"><select onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ManagedUserStatus }))} value={draft.status}><option value="ACTIVE">Activo</option><option value="DISABLED">Desactivado</option></select></Field>}
      <FormActions onCancel={onClose} submitLabel={saving ? 'Guardando…' : 'Guardar usuario'} submitting={saving} />
    </FormStack>
  </EntityDrawer>;
}

function UsersWorkspace(): React.JSX.Element {
  const [items, setItems] = useState<readonly ManagedUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('ALL');
  const [drawer, setDrawer] = useState<ManagedUser | 'NEW' | null>(null);

  async function reload(): Promise<void> { setItems(await managedUsers()); }
  useEffect(() => { let mounted = true; void reload().catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar los usuarios.'); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);
  const filtered = useMemo(() => { if (items === null) return []; const normalized = query.trim().toLocaleLowerCase('es-PY'); return items.filter((item) => (filter === 'ALL' || item.status === filter) && (normalized.length === 0 || `${item.displayName} ${item.email} ${item.role}`.toLocaleLowerCase('es-PY').includes(normalized))); }, [filter, items, query]);
  function saved(user: ManagedUser): void { setItems((current) => current === null ? [user] : current.some((item) => item.id === user.id) ? current.map((item) => item.id === user.id ? user : item) : [...current, user]); }
  async function retry(): Promise<void> { setLoading(true); setError(null); try { await reload(); } catch (caught: unknown) { setItems(null); setError(caught instanceof Error ? caught.message : 'No fue posible reintentar.'); } finally { setLoading(false); } }

  if (loading) return <WorkspaceState detail="Recuperando cuentas y roles del sistema." title="Cargando usuarios…" />;
  if (items === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor e inténtalo nuevamente.'} onAction={() => void retry()} title="No fue posible cargar Usuarios." tone="error" />;

  return <PageLayout>
    <PageHeader action={{ label: '+ Nuevo usuario', onPress: () => setDrawer('NEW') }} description="Administra cuentas, roles y acceso. Los cambios de rol, estado o contraseña invalidan sesiones vigentes." eyebrow="Control" title="Usuarios" />
    {error === null ? null : <Notice description={error} tone="danger" />}
    <ListToolbar count={filtered.length} onQueryChange={setQuery} onStatusChange={setFilter} query={query} searchLabel="Buscar usuario" searchPlaceholder="Buscar nombre, correo o rol…" status={filter} statusLabel="Filtrar usuarios por estado" statusOptions={FILTER_OPTIONS} total={items.length} />
    <DataList empty={{ description: items.length === 0 ? 'Crea la primera cuenta administrada.' : 'Ajusta la búsqueda o el filtro.', title: items.length === 0 ? 'Aún no hay usuarios.' : 'No encontramos usuarios.' }} isEmpty={filtered.length === 0} label="Listado de usuarios">
      {filtered.map((item) => <DataRow description={`${item.email}${item.lastLoginAt === null ? ' · nunca ingresó' : ` · último acceso ${new Intl.DateTimeFormat('es-PY', { dateStyle: 'short' }).format(new Date(item.lastLoginAt))}`}`} key={item.id} meta={roleLabels[item.role]} onPress={() => setDrawer(item)} status={<StatusBadge label={item.status === 'ACTIVE' ? 'Activo' : 'Desactivado'} tone={item.status === 'ACTIVE' ? 'success' : 'default'} />} title={item.displayName} visual={item.displayName.charAt(0).toUpperCase()} />)}
    </DataList>
    {drawer === null ? null : <UserDrawer item={drawer === 'NEW' ? null : drawer} onClose={() => setDrawer(null)} onSaved={saved} />}
  </PageLayout>;
}

export function UsersClient(): React.JSX.Element { return <SessionBoundary allowedRoles={SUPERADMIN_ONLY}>{(actor) => <AppShell actor={actor} active="users" title="Usuarios"><UsersWorkspace /></AppShell>}</SessionBoundary>; }
