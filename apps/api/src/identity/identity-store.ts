export type AccountRole = 'ADMIN' | 'OPERATOR' | 'SUPERADMIN';

export interface AccountRecord {
  readonly credentialVersion: number;
  readonly displayName: string;
  readonly emailNormalized: string;
  readonly failedLoginCount: number;
  readonly id: string;
  readonly loginBlockedUntil: Date | null;
  readonly passwordHash: string;
  readonly role: AccountRole;
  readonly status: string;
}

export interface SessionRecord {
  readonly credentialVersion: number;
  readonly csrfHash: string;
  readonly expiresAt: Date;
  readonly id: string;
  readonly idleExpiresAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
  readonly tokenHash: string;
  readonly user: AccountRecord;
  readonly userId: string;
}

export interface CreateSessionRecord {
  readonly credentialVersion: number;
  readonly csrfHash: string;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
  readonly occurredAt: Date;
  readonly tokenHash: string;
  readonly userId: string;
}

export interface IdentityStore {
  createSession(input: CreateSessionRecord): Promise<SessionRecord>;
  findAccountByEmail(emailNormalized: string): Promise<AccountRecord | null>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  recordFailedLogin(userId: string, occurredAt: Date): Promise<void>;
  resetFailedLogin(userId: string): Promise<void>;
  revokeSession(sessionId: string, occurredAt: Date): Promise<void>;
  touchSession(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
}

export const IDENTITY_STORE = Symbol('IDENTITY_STORE');
