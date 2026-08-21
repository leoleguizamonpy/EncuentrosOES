import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceState } from '../components/workspace-state';

describe('WorkspaceState', () => {
  it('exposes an accessible retry action for recoverable errors', () => {
    const retry = vi.fn();
    render(<WorkspaceState detail="Revisa la conexión." onAction={retry} title="No fue posible cargar." tone="error" />);

    expect(screen.getByRole('alert')).toHaveTextContent('No fue posible cargar.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('announces neutral loading states without an action', () => {
    render(<WorkspaceState detail="Recuperando datos." title="Cargando…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
