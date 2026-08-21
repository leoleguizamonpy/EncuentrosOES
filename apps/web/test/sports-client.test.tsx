import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SportsClient } from '../components/sports-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const catalogApi = vi.hoisted(() => ({
  adminCatalog: vi.fn(),
  catalogAssetUrl: vi.fn((id: string) => `/asset/${id}`),
  createModality: vi.fn(),
  createSport: vi.fn(),
  iconFromFile: vi.fn(),
  updateModality: vi.fn(),
  updateSport: vi.fn(),
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
const createdSport = {
  active: true,
  code: 'FUTSAL',
  iconAssetId: null,
  id: 'sport-1',
  name: 'Futsal',
};
const populatedCatalog = { ...emptyCatalog, sports: [createdSport] };

describe('SportsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    catalogApi.iconFromFile.mockResolvedValue(null);
    catalogApi.createSport.mockResolvedValue(createdSport);
    catalogApi.updateSport.mockResolvedValue(createdSport);
    catalogApi.adminCatalog.mockReset().mockResolvedValueOnce(emptyCatalog).mockResolvedValue(populatedCatalog);
  });

  it('lists sports in UX 2.0 and creates the first sport from its drawer', async () => {
    render(<SportsClient />);

    expect(await screen.findByRole('heading', { name: 'Deportes', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Deportes/ })).toHaveAttribute('href', '/admin/sports');
    expect(screen.getByText('No hay deportes todavía.')).toBeInTheDocument();

    const createButton = screen.getAllByRole('button', { name: '+ Nuevo deporte' })[0];
    if (createButton === undefined) throw new Error('Expected sport create button');
    fireEvent.click(createButton);
    expect(screen.getByRole('heading', { name: 'Nuevo deporte' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Futsal' } });
    fireEvent.change(screen.getByLabelText('Código *'), { target: { value: 'FUTSAL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar deporte' }));

    await waitFor(() => expect(catalogApi.createSport).toHaveBeenCalledWith({ code: 'FUTSAL', icon: null, name: 'Futsal' }));
    expect(await screen.findByText('Futsal')).toBeInTheDocument();
  });
});
