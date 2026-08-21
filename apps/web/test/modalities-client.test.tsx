import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModalitiesClient } from '../components/modalities-client';

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
const createdModality = {
  active: true,
  code: 'MASC',
  iconAssetId: null,
  id: 'modality-1',
  name: 'Masculina',
};
const populatedCatalog = { ...emptyCatalog, modalities: [createdModality] };

describe('ModalitiesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    catalogApi.iconFromFile.mockResolvedValue(null);
    catalogApi.createModality.mockResolvedValue(createdModality);
    catalogApi.updateModality.mockResolvedValue(createdModality);
    catalogApi.adminCatalog.mockReset().mockResolvedValueOnce(emptyCatalog).mockResolvedValue(populatedCatalog);
  });

  it('lists modalities in UX 2.0 and creates the first modality from its drawer', async () => {
    render(<ModalitiesClient />);

    expect(await screen.findByRole('heading', { name: 'Modalidades', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Modalidades/ })).toHaveAttribute('href', '/admin/modalities');
    expect(screen.getByText('No hay modalidades todavía.')).toBeInTheDocument();

    const createButton = screen.getAllByRole('button', { name: '+ Nueva modalidad' })[0];
    if (createButton === undefined) throw new Error('Expected modality create button');
    fireEvent.click(createButton);
    expect(screen.getByRole('heading', { name: 'Nueva modalidad' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Masculina' } });
    fireEvent.change(screen.getByLabelText('Código *'), { target: { value: 'MASC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar modalidad' }));

    await waitFor(() => expect(catalogApi.createModality).toHaveBeenCalledWith({ code: 'MASC', icon: null, name: 'Masculina' }));
    expect(await screen.findByText('Masculina')).toBeInTheDocument();
  });
});
