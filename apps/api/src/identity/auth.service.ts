import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { API_CONFIG, type ApiConfig } from '../config.js';
import {
  DUMMY_PASSWORD_HASH,
  verifyPassword,
} from './password.js';
import {
  IDENTITY_STORE,
  type AccountRole,
  type IdentityStore,
  type SessionRecord,
} from './identity-store.js';

export interface AuthenticatedActor {
  readonly displayName: string;
  readonly id: string;
  readonly role: AccountRole;
  readonly sessionId: string;
}

export interface LoginResult {
  readonly actor: AuthenticatedActor;
  readonly csrfToken: string;
  readonly expiresAt: Date;
  readonly sessionToken: string;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function genericFailure(): UnauthorizedException {
  return new UnauthorizedException('Invalid credentials or unavailable account.');
}

@Injectable()
export class AuthService {
  public constructor(
    @Inject(IDENTITY_STORE) private readonly store: IdentityStore,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  public async login(email: string, password: string, occurredAt = new Date()): Promise<LoginResult> {
    const emailNormalized = email.trim().toLocaleLowerCase('en-US');
    const account = await this.store.findAccountByEmail(emailNormalized);
    const passwordValid = await verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
    const blocked = account?.loginBlockedUntil !== null &&
      account?.loginBlockedUntil !== undefined &&
      account.loginBlockedUntil.getTime() > occurredAt.getTime();
    if (account === null || !passwordValid || account.status !== 'ACTIVE' || blocked) {
      if (account !== null && !blocked) await this.store.recordFailedLogin(account.id, occurredAt);
      throw genericFailure();
    }
    await this.store.resetFailedLogin(account.id);
    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      occurredAt.getTime() + this.config.sessionAbsoluteMinutes * 60_000,
    );
    const idleExpiresAt = new Date(
      Math.min(
        occurredAt.getTime() + this.config.sessionIdleMinutes * 60_000,
        expiresAt.getTime(),
      ),
    );
    const session = await this.store.createSession({
      credentialVersion: account.credentialVersion,
      csrfHash: digest(csrfToken),
      expiresAt,
      idleExpiresAt,
      occurredAt,
      tokenHash: digest(sessionToken),
      userId: account.id,
    });
    return {
      actor: this.#actor(session),
      csrfToken,
      expiresAt,
      sessionToken,
    };
  }

  public async authenticate(sessionToken: string, occurredAt = new Date()): Promise<{
    readonly actor: AuthenticatedActor;
    readonly session: SessionRecord;
  }> {
    const session = await this.store.findSessionByTokenHash(digest(sessionToken));
    const invalid = session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= occurredAt.getTime() ||
      session.idleExpiresAt.getTime() <= occurredAt.getTime() ||
      session.user.status !== 'ACTIVE' ||
      session.credentialVersion !== session.user.credentialVersion;
    if (invalid) {
      if (session !== null && session.revokedAt === null) {
        await this.store.revokeSession(session.id, occurredAt);
      }
      throw genericFailure();
    }
    const idleExpiresAt = new Date(
      Math.min(
        occurredAt.getTime() + this.config.sessionIdleMinutes * 60_000,
        session.expiresAt.getTime(),
      ),
    );
    await this.store.touchSession(session.id, occurredAt, idleExpiresAt);
    return { actor: this.#actor(session), session };
  }

  public verifyCsrf(session: SessionRecord, token: string): boolean {
    const actual = Buffer.from(digest(token), 'hex');
    const expected = Buffer.from(session.csrfHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  public async logout(sessionId: string, occurredAt = new Date()): Promise<void> {
    await this.store.revokeSession(sessionId, occurredAt);
  }

  #actor(session: SessionRecord): AuthenticatedActor {
    return {
      displayName: session.user.displayName,
      id: session.user.id,
      role: session.user.role,
      sessionId: session.id,
    };
  }
}
