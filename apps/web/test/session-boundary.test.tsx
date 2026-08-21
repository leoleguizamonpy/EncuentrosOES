import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionBoundary } from '../components/session-boundary';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const authApi = vi.hoisted(() => ({ currentActor: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);

describe('SessionBoundary', () => {
  it('lets the user retry a failed session restoration', async () => {
    authApi.currentActor
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ displayName: 'Admin OES', id: 'actor-1', role: 'ADMIN' });

    render(<SessionBoundary>{(actor) => <div>Sesión de {actor.displayName}</div>}</SessionBoundary>);

    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible restaurar la sesión.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sesión de Admin OES')).toBeInTheDocument();
    expect(authApi.currentActor).toHaveBeenCalledTimes(2);
  });
});
