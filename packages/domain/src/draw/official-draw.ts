import { DomainError } from '../errors/domain-error.js';
import type { CompetitionStatus } from '../competition/competition.js';
import {
  executeOfficialDraw,
  verifyOfficialDraw,
  type DrawEvidence,
} from './draw-engine.js';
import type { DrawConfigurationSnapshot } from './draw-configuration.js';

export type AuthorityRole = 'ADMIN' | 'SUPERADMIN';
export type OfficialDrawStatus = 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';

export interface OfficialDrawSnapshot {
  readonly annulledAt: Date | null;
  readonly annulledBy: string | null;
  readonly annulmentReason: string | null;
  readonly competitionId: string;
  readonly configurationId: string;
  readonly confirmedAt: Date | null;
  readonly confirmedBy: string | null;
  readonly evidence: DrawEvidence;
  readonly executedAt: Date;
  readonly executedBy: string;
  readonly id: string;
  readonly revision: number;
  readonly seedHex: string;
  readonly status: OfficialDrawStatus;
}

export interface ExecuteOfficialDrawInput {
  readonly actorId: string;
  readonly actorRole: AuthorityRole;
  readonly competitionStatus: CompetitionStatus;
  readonly configuration: DrawConfigurationSnapshot;
  readonly id: string;
  readonly occurredAt: Date;
  readonly seed: Uint8Array;
}

export interface ConfirmOfficialDrawInput {
  readonly actorId: string;
  readonly actorRole: AuthorityRole;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

export interface AnnulOfficialDrawInput extends ConfirmOfficialDrawInput {
  readonly reason: string;
}

function cloneEvidence(evidence: DrawEvidence): DrawEvidence {
  return structuredClone(evidence);
}

function assertActor(actorId: string, actorRole: AuthorityRole): void {
  if (actorId.trim().length === 0 || !['ADMIN', 'SUPERADMIN'].includes(actorRole)) {
    throw new DomainError('DRAW_AUTHORITY_INVALID', 'An active draw authority is required.');
  }
}

export class OfficialDraw {
  #snapshot: OfficialDrawSnapshot;

  private constructor(snapshot: OfficialDrawSnapshot) {
    this.#snapshot = {
      ...snapshot,
      annulledAt: snapshot.annulledAt === null ? null : new Date(snapshot.annulledAt),
      confirmedAt: snapshot.confirmedAt === null ? null : new Date(snapshot.confirmedAt),
      evidence: cloneEvidence(snapshot.evidence),
      executedAt: new Date(snapshot.executedAt),
    };
  }

  public static execute(input: ExecuteOfficialDrawInput): OfficialDraw {
    assertActor(input.actorId, input.actorRole);
    if (input.id.trim().length === 0) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw execution identifier is required.');
    }
    if (input.competitionStatus !== 'LOCKED') {
      throw new DomainError(
        'DRAW_EXECUTION_INVALID',
        'Official draws require a locked competition.',
      );
    }
    if (input.configuration.competitionId.trim().length === 0) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw competition is required.');
    }
    const evidence = executeOfficialDraw(input.configuration, input.seed);
    return new OfficialDraw({
      annulledAt: null,
      annulledBy: null,
      annulmentReason: null,
      competitionId: input.configuration.competitionId,
      configurationId: input.configuration.id,
      confirmedAt: null,
      confirmedBy: null,
      evidence,
      executedAt: input.occurredAt,
      executedBy: input.actorId,
      id: input.id,
      revision: 1,
      seedHex: Buffer.from(input.seed).toString('hex'),
      status: 'PENDING_CONFIRMATION',
    });
  }

  public static rehydrate(
    snapshot: OfficialDrawSnapshot,
    configuration: DrawConfigurationSnapshot,
  ): OfficialDraw {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision <= 0) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw execution revision must be positive.');
    }
    if (!/^[0-9a-f]{64}$/.test(snapshot.seedHex)) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Persisted draw seed is invalid.');
    }
    if (
      snapshot.configurationId !== configuration.id ||
      snapshot.competitionId !== configuration.competitionId ||
      !verifyOfficialDraw(configuration, Buffer.from(snapshot.seedHex, 'hex'), snapshot.evidence)
    ) {
      throw new DomainError('DRAW_EVIDENCE_INVALID', 'Persisted draw evidence is invalid.');
    }
    const confirmed = snapshot.status === 'CONFIRMED' || snapshot.status === 'ANNULLED';
    if (confirmed !== (snapshot.confirmedAt !== null && snapshot.confirmedBy !== null)) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw confirmation evidence is inconsistent.');
    }
    const annulled = snapshot.status === 'ANNULLED';
    const hasAnnulment =
      snapshot.annulledAt !== null &&
      snapshot.annulledBy !== null &&
      snapshot.annulmentReason !== null;
    if (annulled !== hasAnnulment) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw annulment evidence is inconsistent.');
    }
    return new OfficialDraw(snapshot);
  }

  public confirm(input: ConfirmOfficialDrawInput): void {
    this.#assertRevision(input.expectedRevision);
    assertActor(input.actorId, input.actorRole);
    if (this.#snapshot.status !== 'PENDING_CONFIRMATION') {
      throw new DomainError('DRAW_CONFIRMATION_INVALID', 'Only a pending draw can be confirmed.');
    }
    if (input.actorId === this.#snapshot.executedBy && input.actorRole !== 'SUPERADMIN') {
      throw new DomainError(
        'DRAW_CONFIRMATION_INVALID',
        'An administrator cannot confirm the same draw execution they executed.',
      );
    }
    this.#snapshot = {
      ...this.#snapshot,
      confirmedAt: new Date(input.occurredAt),
      confirmedBy: input.actorId,
      revision: this.#snapshot.revision + 1,
      status: 'CONFIRMED',
    };
  }

  public annul(input: AnnulOfficialDrawInput): void {
    this.#assertRevision(input.expectedRevision);
    assertActor(input.actorId, input.actorRole);
    const reason = input.reason.trim().replaceAll(/\s+/g, ' ');
    if (input.actorRole !== 'SUPERADMIN' || this.#snapshot.status !== 'CONFIRMED') {
      throw new DomainError(
        'DRAW_ANNULMENT_INVALID',
        'Only a superadministrator can annul a confirmed draw.',
      );
    }
    if (reason.length === 0) {
      throw new DomainError('DRAW_ANNULMENT_INVALID', 'An annulment reason is required.');
    }
    this.#snapshot = {
      ...this.#snapshot,
      annulledAt: new Date(input.occurredAt),
      annulledBy: input.actorId,
      annulmentReason: reason,
      revision: this.#snapshot.revision + 1,
      status: 'ANNULLED',
    };
  }

  public toSnapshot(): OfficialDrawSnapshot {
    return Object.freeze({
      ...this.#snapshot,
      annulledAt:
        this.#snapshot.annulledAt === null ? null : new Date(this.#snapshot.annulledAt),
      confirmedAt:
        this.#snapshot.confirmedAt === null ? null : new Date(this.#snapshot.confirmedAt),
      evidence: cloneEvidence(this.#snapshot.evidence),
      executedAt: new Date(this.#snapshot.executedAt),
    });
  }

  #assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.#snapshot.revision) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The draw execution revision is stale.');
    }
  }
}
