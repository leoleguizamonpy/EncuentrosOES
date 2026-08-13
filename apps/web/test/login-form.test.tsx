import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../components/login-form';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('LoginForm', () => {
  beforeEach(() => { vi.restoreAllMocks(); replace.mockReset(); });

  it('submits credentials and enters the dashboard', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      actor: { displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' },
      csrfToken: 'token', expiresAt: '2026-08-13T20:00:00.000Z',
    }), { status: 200 })));
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Correo institucional'), 'admin@oes.test');
    await user.type(screen.getByLabelText('Contraseña'), 'frase-segura-de-prueba');
    await user.click(screen.getByRole('button', { name: 'Ingresar al sistema' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a safe message when authentication fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Correo institucional'), 'admin@oes.test');
    await user.type(screen.getByLabelText('Contraseña'), 'credencial-incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar al sistema' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos iniciar sesión');
    expect(replace).not.toHaveBeenCalled();
  });
});
