import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstitutionsClient } from '../components/institutions-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const catalogApi = vi.hoisted(() => ({
  adminCatalog: vi.fn(),
  catalogAssetUrl: vi.fn((id: string) => `/asset/${id}`),
  createInstitution: vi.fn(),
  iconFromFile: vi.fn(),
  updateInstitution: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/catalog-admin-api', () => catalogApi);

const actor = { displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' };
const event = { active: true, code: 'COL', id: 'event-1', name: 'Colegiales' };
const emptyCatalog = {
  combinations: [],
  editions: [],
  events: [event],
  institutions: [],
  modalities: [],
  sports: [],
};
const createdInstitution = {
  active: true,
  code: 'ENC',
  eventId: event.id,
  iconAssetId: null,
  id: 'institution-1',
  name: 'Escuela Nacional de Comercio',
  revision: 1,
};
const populatedCatalog = { ...emptyCatalog, institutions: [createdInstitution] };

describe('InstitutionsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    catalogApi.iconFromFile.mockResolvedValue(null);
    catalogApi.createInstitution.mockResolvedValue(createdInstitution);
    catalogApi.updateInstitution.mockResolvedValue(createdInstitution);
    catalogApi.adminCatalog.mockReset().mockResolvedValueOnce(emptyCatalog).mockResolvedValue(populatedCatalog);
  });

  it('lists the module and creates an institution from its drawer', async () => {
    render(<InstitutionsClient />);

    expect(await screen.findByRole('heading', { name: 'Instituciones', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('No hay instituciones todavía.')).toBeInTheDocument();

    const createButton = screen.getAllByRole('button', { name: '+ Nueva institución' })[0];
    if (createButton === undefined) throw new Error('Expected institution create button');
    fireEvent.click(createButton);
    expect(screen.getByRole('heading', { name: 'Nueva institución' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Escuela Nacional de Comercio' } });
    fireEvent.change(screen.getByLabelText('Código *'), { target: { value: 'ENC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar institución' }));

    await waitFor(() => expect(catalogApi.createInstitution).toHaveBeenCalledWith({
      code: 'ENC',
      eventId: 'event-1',
      icon: null,
      name: 'Escuela Nacional de Comercio',
    }));
    expect(await screen.findByText('Escuela Nacional de Comercio')).toBeInTheDocument();
  });
});
