import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsClient } from '../components/settings-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const settingsApi = vi.hoisted(() => ({ runtimeSettings: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/settings-api', () => settingsApi);

describe('SettingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue({ displayName: 'Super OES', id: 'actor-1', role: 'SUPERADMIN' });
    authApi.logout.mockResolvedValue(undefined);
    settingsApi.runtimeSettings.mockResolvedValue({
      apiPort: 3001,
      editable: false,
      runtimeMode: 'PRODUCTION',
      sessionAbsoluteMinutes: 720,
      sessionIdleMinutes: 30,
      source: 'ENVIRONMENT',
      webOrigin: 'https://oes.example.com',
    });
  });

  it('shows safe environment policy as read-only and enables settings navigation', async () => {
    render(<SettingsClient />);

    expect(await screen.findByRole('heading', { name: 'Configuración', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Configuración/ })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByText('30 minutos')).toBeInTheDocument();
    expect(screen.getByText('720 minutos')).toBeInTheDocument();
    expect(screen.getByText('https://oes.example.com')).toBeInTheDocument();
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
    expect(screen.queryByText(/DATABASE_URL/)).not.toBeInTheDocument();
  });
});
