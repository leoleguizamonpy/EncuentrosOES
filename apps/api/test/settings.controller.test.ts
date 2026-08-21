import { describe, expect, it } from 'vitest';

import type { ApiConfig } from '../src/config.js';
import { SettingsController } from '../src/settings/settings.controller.js';

describe('SettingsController', () => {
  it('exposes only non-secret runtime policy', () => {
    const config: ApiConfig = {
      apiPort: 3001,
      databaseUrl: 'postgresql://secret:secret@database.internal/oes',
      production: true,
      sessionAbsoluteMinutes: 720,
      sessionIdleMinutes: 30,
      webOrigin: 'https://oes.example.com',
    };
    const result = new SettingsController(config).settings();

    expect(result).toEqual({
      apiPort: 3001,
      editable: false,
      runtimeMode: 'PRODUCTION',
      sessionAbsoluteMinutes: 720,
      sessionIdleMinutes: 30,
      source: 'ENVIRONMENT',
      webOrigin: 'https://oes.example.com',
    });
    expect(JSON.stringify(result)).not.toContain('database.internal');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
