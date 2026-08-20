import { describe, expect, it } from 'vitest';

import { loadApiConfig } from '../src/config.js';

const productionEnvironment = {
  API_PORT: '3001',
  DATABASE_URL: 'postgresql://oes_user:secret@db.internal:5432/oes?schema=public',
  NODE_ENV: 'production',
  SESSION_ABSOLUTE_MINUTES: '720',
  SESSION_IDLE_MINUTES: '30',
  WEB_ORIGIN: 'https://www.oesparaguay.com',
} satisfies NodeJS.ProcessEnv;

describe('loadApiConfig', () => {
  it('keeps safe development defaults while requiring explicit connection and origin', () => {
    expect(loadApiConfig({
      DATABASE_URL: 'postgresql://oes:oes@localhost:5432/oes?schema=public',
      WEB_ORIGIN: 'http://localhost:3000',
    })).toMatchObject({
      apiPort: 3001,
      production: false,
      sessionAbsoluteMinutes: 720,
      sessionIdleMinutes: 30,
      webOrigin: 'http://localhost:3000',
    });
  });

  it('accepts an explicit HTTPS production configuration', () => {
    expect(loadApiConfig(productionEnvironment)).toMatchObject({
      apiPort: 3001,
      production: true,
      sessionAbsoluteMinutes: 720,
      sessionIdleMinutes: 30,
      webOrigin: 'https://www.oesparaguay.com',
    });
  });

  it.each(['API_PORT', 'SESSION_ABSOLUTE_MINUTES', 'SESSION_IDLE_MINUTES'] as const)(
    'rejects production when %s is implicit',
    (key) => {
      const environment: NodeJS.ProcessEnv = { ...productionEnvironment };
      environment[key] = undefined;
      expect(() => loadApiConfig(environment)).toThrow(`${key} must be explicitly configured in production.`);
    },
  );

  it('rejects an insecure production web origin', () => {
    expect(() => loadApiConfig({
      ...productionEnvironment,
      WEB_ORIGIN: 'http://www.oesparaguay.com',
    })).toThrow('Production WEB_ORIGIN must use HTTPS.');
  });

  it('rejects production databases pointing to localhost', () => {
    expect(() => loadApiConfig({
      ...productionEnvironment,
      DATABASE_URL: 'postgresql://oes:secret@localhost:5432/oes?schema=public',
    })).toThrow('Production DATABASE_URL cannot target localhost.');
  });

  it('rejects non-PostgreSQL database protocols', () => {
    expect(() => loadApiConfig({
      ...productionEnvironment,
      DATABASE_URL: 'https://db.internal/oes',
    })).toThrow('DATABASE_URL must use the postgresql:// or postgres:// protocol.');
  });

  it('rejects a web origin containing a path', () => {
    expect(() => loadApiConfig({
      ...productionEnvironment,
      WEB_ORIGIN: 'https://www.oesparaguay.com/app',
    })).toThrow('WEB_ORIGIN must not contain a path.');
  });

  it('rejects an idle session lifetime that is not shorter than the absolute lifetime', () => {
    expect(() => loadApiConfig({
      ...productionEnvironment,
      SESSION_ABSOLUTE_MINUTES: '30',
      SESSION_IDLE_MINUTES: '30',
    })).toThrow('SESSION_IDLE_MINUTES must be lower than SESSION_ABSOLUTE_MINUTES.');
  });
});
