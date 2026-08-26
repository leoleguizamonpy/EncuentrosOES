import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PrintAction } from '../components/print-action';

describe('PrintAction', () => {
  it('delegates printing to the browser only after an explicit user action', () => {
    const print = vi.fn();
    Object.defineProperty(window, 'print', { configurable: true, value: print });

    render(<PrintAction label="Imprimir acta" />);

    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir acta' }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
