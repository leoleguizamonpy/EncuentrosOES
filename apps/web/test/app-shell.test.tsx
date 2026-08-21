import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../components/app-shell';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const authApi = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);

const actor = { displayName: 'Admin OES', id: 'actor-1', role: 'ADMIN' } as const;

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.logout.mockResolvedValue(undefined);
  });

  it('exposes a collapsible navigation control for narrow viewports', () => {
    render(<AppShell actor={actor} active="dashboard" title="Inicio"><div>Contenido</div></AppShell>);

    const trigger = screen.getByRole('button', { name: 'Abrir navegación' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Cerrar navegación' })).toHaveAttribute('aria-expanded', 'true');

    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar navegación' });
    const backdrop = closeButtons.find((button) => button.getAttribute('aria-controls') === null);
    if (backdrop === undefined) throw new Error('Expected mobile navigation backdrop');
    fireEvent.click(backdrop);

    expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps superadmin-only navigation hidden from admins', () => {
    render(<AppShell actor={actor} active="dashboard" title="Inicio"><div>Contenido</div></AppShell>);

    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Configuración/ })).not.toBeInTheDocument();
  });
});
