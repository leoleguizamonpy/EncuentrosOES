import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventsClient } from '../components/events-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const catalogApi = vi.hoisted(() => ({
  adminCatalog: vi.fn(),
  createCombination: vi.fn(),
  createEvent: vi.fn(),
  updateCombination: vi.fn(),
  updateEvent: vi.fn(),
}));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/catalog-admin-api', () => catalogApi);

const actor = { displayName: 'Autoridad OES', id: 'actor-1', role: 'ADMIN' };
const event = { active: true, code: 'COLEGIALES', id: 'event-1', name: 'Colegiales' };
const sport = { active: true, code: 'FUTSAL', iconAssetId: null, id: 'sport-1', name: 'Futsal' };
const modality = { active: true, code: 'MALE', iconAssetId: null, id: 'modality-1', name: 'Masculina' };
const emptyCatalog = {
  combinations: [],
  editions: [],
  events: [],
  institutions: [],
  modalities: [modality],
  sports: [sport],
};
const eventCatalog = { ...emptyCatalog, events: [event] };

describe('EventsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue(actor);
    authApi.logout.mockResolvedValue(undefined);
    catalogApi.createEvent.mockResolvedValue(event);
    catalogApi.updateEvent.mockResolvedValue(event);
    catalogApi.createCombination.mockResolvedValue({ active: true, event, eventId: event.id, modality, modalityId: modality.id, sport, sportId: sport.id });
    catalogApi.updateCombination.mockResolvedValue(undefined);
  });

  it('creates the first event from the UX 2.0 module', async () => {
    catalogApi.adminCatalog.mockReset().mockResolvedValueOnce(emptyCatalog).mockResolvedValue(eventCatalog);
    render(<EventsClient />);

    expect(await screen.findByRole('heading', { name: 'Eventos', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Eventos/ })).toHaveAttribute('href', '/admin/events');
    expect(screen.getByText('No hay eventos todavía.')).toBeInTheDocument();

    const createButton = screen.getAllByRole('button', { name: '+ Nuevo evento' })[0];
    if (createButton === undefined) throw new Error('Expected event create button');
    fireEvent.click(createButton);
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Colegiales' } });
    fireEvent.change(screen.getByLabelText('Código *'), { target: { value: 'COLEGIALES' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evento' }));

    await waitFor(() => expect(catalogApi.createEvent).toHaveBeenCalledWith({ code: 'COLEGIALES', name: 'Colegiales' }));
    expect(await screen.findByText('Colegiales')).toBeInTheDocument();
  });

  it('enables sport and modality contextually inside an event', async () => {
    const enabledCatalog = {
      ...eventCatalog,
      combinations: [{ active: true, event, eventId: event.id, modality, modalityId: modality.id, sport, sportId: sport.id }],
    };
    catalogApi.adminCatalog.mockReset().mockResolvedValueOnce(eventCatalog).mockResolvedValue(enabledCatalog);
    render(<EventsClient />);

    expect(await screen.findByText('Colegiales')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Colegiales/ }));
    const relation = screen.getByRole('checkbox', { name: 'Futsal · Masculina' });
    expect(relation).not.toBeChecked();
    fireEvent.click(relation);

    await waitFor(() => expect(catalogApi.createCombination).toHaveBeenCalledWith({ eventId: 'event-1', modalityId: 'modality-1', sportId: 'sport-1' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Futsal · Masculina' })).toBeChecked());
  });
});
