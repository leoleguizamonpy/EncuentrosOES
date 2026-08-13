import type {
  AccountRecord,
  CreateSessionRecord,
  IdentityStore,
  SessionRecord,
} from '../src/identity/identity-store.js';

export class FakeIdentityStore implements IdentityStore {
  public account: AccountRecord | null;
  public readonly sessions = new Map<string, SessionRecord>();
  public failedLogins = 0;

  public constructor(account: AccountRecord | null) {
    this.account = account;
  }

  public findAccountByEmail(emailNormalized: string): Promise<AccountRecord | null> {
    return Promise.resolve(
      this.account?.emailNormalized === emailNormalized ? structuredClone(this.account) : null,
    );
  }

  public recordFailedLogin(_userId: string, occurredAt: Date): Promise<void> {
    this.failedLogins += 1;
    if (this.account !== null) {
      const failedLoginCount = this.account.failedLoginCount + 1;
      this.account = {
        ...this.account,
        failedLoginCount,
        loginBlockedUntil: failedLoginCount >= 5
          ? new Date(occurredAt.getTime() + 30_000)
          : null,
      };
    }
    return Promise.resolve();
  }

  public resetFailedLogin(userId: string): Promise<void> {
    void userId;
    if (this.account !== null) {
      this.account = { ...this.account, failedLoginCount: 0, loginBlockedUntil: null };
    }
    return Promise.resolve();
  }

  public createSession(input: CreateSessionRecord): Promise<SessionRecord> {
    if (this.account === null) throw new Error('Missing fake account');
    const session: SessionRecord = {
      credentialVersion: input.credentialVersion,
      csrfHash: input.csrfHash,
      expiresAt: new Date(input.expiresAt),
      id: `session-${String(this.sessions.size + 1)}`,
      idleExpiresAt: new Date(input.idleExpiresAt),
      lastSeenAt: new Date(input.occurredAt),
      revokedAt: null,
      tokenHash: input.tokenHash,
      user: structuredClone(this.account),
      userId: input.userId,
    };
    this.sessions.set(session.id, session);
    return Promise.resolve(structuredClone(session));
  }

  public findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = [...this.sessions.values()].find((candidate) => candidate.tokenHash === tokenHash);
    return Promise.resolve(session === undefined ? null : structuredClone(session));
  }

  public touchSession(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session !== undefined) {
      this.sessions.set(sessionId, { ...session, idleExpiresAt, lastSeenAt });
    }
    return Promise.resolve();
  }

  public revokeSession(sessionId: string, occurredAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session !== undefined && session.revokedAt === null) {
      this.sessions.set(sessionId, { ...session, revokedAt: occurredAt });
    }
    return Promise.resolve();
  }
}
