import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditionsClient } from '../components/editions-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const catalogApi = vi.hoisted(() => ({
  adminCatalog: vi.fn(),
  createEdition: vi.fn(),
  updateEdition: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/catalog-admin-api', () => catalogApi);

const actor = { displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' };
const emptyCatalog = {
  combinations: [],
  editions: [],
  events: [],
  institutions: [],
  modalities: [],
  sports: [],
};
const createdEdition = { id: 'edition-1', name: 'OES 2027', status: 'OPEN', year: 2027 };
const populatedCatalog = { ...emptyCatalog, editions: [createdEdition] };

describe('EditionsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    catalogApi.createEdition.mockResolvedValue(createdEdition);
    catalogApi.updateEdition.mockResolvedValue(createdEdition);
    catalogApi.adminCatalog.mockReset().mockResolvedValueOnce(emptyCatalog).mockResolvedValue(populatedCatalog);
  });

  it('lists editions in UX 2.0 and creates the first edition from its drawer', async () => {
    render(<EditionsClient />);

    expect(await screen.findByRole('heading', { name: 'Ediciones', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ediciones/ })).toHaveAttribute('href', '/admin/editions');
    expect(screen.getByText('No hay ediciones todavía.')).toBeInTheDocument();

    const createButton = screen.getAllByRole('button', { name: '+ Nueva edición' })[0];
    if (createButton === undefined) throw new Error('Expected edition create button');
    fireEvent.click(createButton);
    expect(screen.getByRole('heading', { name: 'Nueva edición' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'OES 2027' } });
    fireEvent.change(screen.getByLabelText('Año *'), { target: { value: '2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar edición' }));

    await waitFor(() => expect(catalogApi.createEdition).toHaveBeenCalledWith({ name: 'OES 2027', status: 'OPEN', year: 2027 }));
    expect(await screen.findByText('OES 2027')).toBeInTheDocument();
  });
});
