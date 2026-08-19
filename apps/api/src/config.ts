import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'production', 'test']);
const portSchema = z.coerce.number().int().min(1).max(65_535);
const sessionAbsoluteSchema = z.coerce.number().int().min(30).max(1_440);
const sessionIdleSchema = z.coerce.number().int().min(5).max(240);

const commonEnvironmentSchema = z.object({
  API_PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  SESSION_ABSOLUTE_MINUTES: z.string().optional(),
  SESSION_IDLE_MINUTES: z.string().optional(),
  WEB_ORIGIN: z.url(),
});

function parseDatabaseUrl(value: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must use the postgresql:// or postgres:// protocol.');
  }
  if (production && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')) {
    throw new Error('Production DATABASE_URL cannot target localhost.');
  }
  return value;
}

function parseWebOrigin(value: string, production: boolean): string {
  const url = new URL(value);
  if (url.username.length > 0 || url.password.length > 0 || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('WEB_ORIGIN must contain only an origin, without credentials, query or fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('WEB_ORIGIN must not contain a path.');
  }
  if (production && url.protocol !== 'https:') {
    throw new Error('Production WEB_ORIGIN must use HTTPS.');
  }
  return url.origin;
}

function requiredProductionValue(
  environment: NodeJS.ProcessEnv,
  key: 'API_PORT' | 'SESSION_ABSOLUTE_MINUTES' | 'SESSION_IDLE_MINUTES',
): string {
  const value = environment[key];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${key} must be explicitly configured in production.`);
  }
  return value;
}

export interface ApiConfig {
  readonly apiPort: number;
  readonly databaseUrl: string;
  readonly environment: 'development' | 'production' | 'test';
  readonly production: boolean;
  readonly sessionAbsoluteMinutes: number;
  readonly sessionIdleMinutes: number;
  readonly webOrigin: string;
}

export const API_CONFIG = Symbol('API_CONFIG');

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = commonEnvironmentSchema.parse(environment);
  const production = parsed.NODE_ENV === 'production';
  const apiPortValue = production
    ? requiredProductionValue(environment, 'API_PORT')
    : parsed.API_PORT ?? '3001';
  const sessionAbsoluteValue = production
    ? requiredProductionValue(environment, 'SESSION_ABSOLUTE_MINUTES')
    : parsed.SESSION_ABSOLUTE_MINUTES ?? '720';
  const sessionIdleValue = production
    ? requiredProductionValue(environment, 'SESSION_IDLE_MINUTES')
    : parsed.SESSION_IDLE_MINUTES ?? '30';
  const apiPort = portSchema.parse(apiPortValue);
  const sessionAbsoluteMinutes = sessionAbsoluteSchema.parse(sessionAbsoluteValue);
  const sessionIdleMinutes = sessionIdleSchema.parse(sessionIdleValue);

  if (sessionIdleMinutes >= sessionAbsoluteMinutes) {
    throw new Error('SESSION_IDLE_MINUTES must be lower than SESSION_ABSOLUTE_MINUTES.');
  }

  return Object.freeze({
    apiPort,
    databaseUrl: parseDatabaseUrl(parsed.DATABASE_URL, production),
    environment: parsed.NODE_ENV,
    production,
    sessionAbsoluteMinutes,
    sessionIdleMinutes,
    webOrigin: parseWebOrigin(parsed.WEB_ORIGIN, production),
  });
}
