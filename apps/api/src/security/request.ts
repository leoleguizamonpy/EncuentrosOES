import type { Request } from 'express';

import type { AuthenticatedActor } from '../identity/auth.service.js';
import type { AccountRole, SessionRecord } from '../identity/identity-store.js';

export type ActorRole = AccountRole;

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
  authSession?: SessionRecord;
  sessionToken?: string;
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (header === undefined) return null;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    const value = pair.slice(separator + 1).trim();
    if (value.length === 0) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}
