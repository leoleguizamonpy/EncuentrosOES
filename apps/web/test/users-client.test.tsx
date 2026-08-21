import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersClient } from '../components/users-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const usersApi = vi.hoisted(() => ({ createManagedUser: vi.fn(), managedUsers: vi.fn(), updateManagedUser: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/users-admin-api', () => usersApi);

describe('UsersClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue({ displayName: 'Super OES', id: 'actor-1', role: 'SUPERADMIN' });
    authApi.logout.mockResolvedValue(undefined);
    usersApi.managedUsers.mockResolvedValue([{
      createdAt: '2026-08-21T12:00:00.000Z',
      displayName: 'Operador Uno',
      email: 'operador@oes.test',
      id: 'user-1',
      lastLoginAt: null,
      role: 'OPERATOR',
      status: 'ACTIVE',
      updatedAt: '2026-08-21T12:00:00.000Z',
    }]);
    usersApi.createManagedUser.mockResolvedValue({
      createdAt: '2026-08-21T15:00:00.000Z',
      displayName: 'Admin Dos',
      email: 'admin2@oes.test',
      id: 'user-2',
      lastLoginAt: null,
      role: 'ADMIN',
      status: 'ACTIVE',
      updatedAt: '2026-08-21T15:00:00.000Z',
    });
  });

  it('shows users only as a real SUPERADMIN control module and creates an account', async () => {
    render(<UsersClient />);

    expect(await screen.findByRole('heading', { name: 'Usuarios', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Usuarios/ })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByText('Operador Uno')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/ }));
    fireEvent.change(screen.getByLabelText(/Nombre visible/), { target: { value: 'Admin Dos' } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: 'admin2@oes.test' } });
    fireEvent.change(screen.getByLabelText(/Contraseña inicial/), { target: { value: 'contraseña-segura-2026' } });
    fireEvent.change(screen.getByLabelText(/Rol/), { target: { value: 'ADMIN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar usuario' }));

    await waitFor(() => expect(usersApi.createManagedUser).toHaveBeenCalledWith({
      displayName: 'Admin Dos',
      email: 'admin2@oes.test',
      password: 'contraseña-segura-2026',
      role: 'ADMIN',
    }));
    expect(await screen.findByText('Admin Dos')).toBeInTheDocument();
  });
});
