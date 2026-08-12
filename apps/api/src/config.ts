import { z } from 'zod';

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_ABSOLUTE_MINUTES: z.coerce.number().int().min(30).max(1_440).default(720),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  WEB_ORIGIN: z.url(),
});

export interface ApiConfig {
  readonly apiPort: number;
  readonly databaseUrl: string;
  readonly production: boolean;
  readonly sessionAbsoluteMinutes: number;
  readonly sessionIdleMinutes: number;
  readonly webOrigin: string;
}

export const API_CONFIG = Symbol('API_CONFIG');

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  return Object.freeze({
    apiPort: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    production: parsed.NODE_ENV === 'production',
    sessionAbsoluteMinutes: parsed.SESSION_ABSOLUTE_MINUTES,
    sessionIdleMinutes: parsed.SESSION_IDLE_MINUTES,
    webOrigin: new URL(parsed.WEB_ORIGIN).origin,
  });
}
