import {
  DomainError,
  OfficialDraw,
  type AuthorityRole,
  type DrawEvidence,
  type OfficialDrawSnapshot,
  type OfficialDrawStatus,
} from '@oes/domain';

import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { PrismaDrawConfigurationRepository } from './draw-configuration-repository.js';

export interface ExecutePersistedOfficialDrawInput {
  readonly actorId: string;
  readonly configurationId: string;
  readonly executionId: string;
  readonly occurredAt: Date;
  readonly seed: Uint8Array;
}

export interface ConfirmPersistedOfficialDrawInput {
  readonly actorId: string;
  readonly executionId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

export interface AnnulPersistedOfficialDrawInput extends ConfirmPersistedOfficialDrawInput {
  readonly reason: string;
}

const statuses = new Set<OfficialDrawStatus>([
  'ANNULLED',
  'CONFIRMED',
  'PENDING_CONFIRMATION',
]);

type DrawPersistenceClient = Prisma.TransactionClient | PrismaClient;

function parseRole(role: string, status: string): AuthorityRole {
  if (status === 'ACTIVE' && (role === 'ADMIN' || role === 'SUPERADMIN')) return role;
  throw new DomainError('DRAW_AUTHORITY_INVALID', 'An active draw authority is required.');
}

function parseStatus(status: string): OfficialDrawStatus {
  if (statuses.has(status as OfficialDrawStatus)) return status as OfficialDrawStatus;
  throw new DomainError('DRAW_EXECUTION_INVALID', `Unknown persisted draw status: ${status}.`);
}

function evidenceJson(evidence: DrawEvidence): Prisma.InputJsonValue {
  return structuredClone(evidence) as unknown as Prisma.InputJsonValue;
}

export class PrismaOfficialDrawService {
  readonly #client: PrismaClient;
  readonly #configurationRepository: PrismaDrawConfigurationRepository;

  public constructor(client: PrismaClient) {
    this.#client = client;
    this.#configurationRepository = new PrismaDrawConfigurationRepository(client);
  }

  public execute(input: ExecutePersistedOfficialDrawInput): Promise<OfficialDraw> {
    return this.#client.$transaction((transaction) => this.executeInTransaction(transaction, input));
  }

  public async executeInTransaction(
    transaction: Prisma.TransactionClient,
    input: ExecutePersistedOfficialDrawInput,
  ): Promise<OfficialDraw> {
    const configuration = await this.#configurationRepository.findByIdInTransaction(
      transaction,
      input.configurationId,
    );
    if (configuration === null) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw configuration does not exist.');
    }
    const configurationSnapshot = configuration.toSnapshot();
    const [actor, competition] = await Promise.all([
      transaction.user.findUnique({
        select: { role: true, status: true },
        where: { id: input.actorId },
      }),
      transaction.competition.findUnique({
        select: { status: true },
        where: { id: configurationSnapshot.competitionId },
      }),
    ]);
    if (actor === null || competition === null) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Draw execution dependencies are missing.');
    }
    const draw = OfficialDraw.execute({
      actorId: input.actorId,
      actorRole: parseRole(actor.role, actor.status),
      competitionStatus: competition.status as 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN',
      configuration: configurationSnapshot,
      id: input.executionId,
      occurredAt: input.occurredAt,
      seed: input.seed,
    });
    const snapshot = draw.toSnapshot();
    await transaction.officialDraw.create({
      data: {
        algorithmVersion: snapshot.evidence.algorithmVersion,
        competitionId: snapshot.competitionId,
        configurationId: snapshot.configurationId,
        evidenceHash: snapshot.evidence.evidenceHash,
        evidenceJson: evidenceJson(snapshot.evidence),
        executedAt: snapshot.executedAt,
        executedById: snapshot.executedBy,
        id: snapshot.id,
        resultHash: snapshot.evidence.resultHash,
        revision: snapshot.revision,
        seedCommitment: snapshot.evidence.seedCommitment,
        seedHex: snapshot.seedHex,
        status: snapshot.status,
      },
    });
    return draw;
  }

  public findById(id: string): Promise<OfficialDraw | null> {
    return this.findByIdInTransaction(this.#client, id);
  }

  public async findByIdInTransaction(
    client: DrawPersistenceClient,
    id: string,
  ): Promise<OfficialDraw | null> {
    const record = await client.officialDraw.findUnique({ where: { id } });
    if (record === null) return null;
    const configuration = await this.#configurationRepository.findByIdInTransaction(
      client,
      record.configurationId,
    );
    if (configuration === null) {
      throw new DomainError('DRAW_EXECUTION_INVALID', 'Persisted draw configuration is missing.');
    }
    const snapshot: OfficialDrawSnapshot = {
      annulledAt: record.annulledAt,
      annulledBy: record.annulledById,
      annulmentReason: record.annulmentReason,
      competitionId: record.competitionId,
      configurationId: record.configurationId,
      confirmedAt: record.confirmedAt,
      confirmedBy: record.confirmedById,
      evidence: record.evidenceJson as unknown as DrawEvidence,
      executedAt: record.executedAt,
      executedBy: record.executedById,
      id: record.id,
      revision: record.revision,
      seedHex: record.seedHex,
      status: parseStatus(record.status),
    };
    return OfficialDraw.rehydrate(snapshot, configuration.toSnapshot());
  }

  public confirm(input: ConfirmPersistedOfficialDrawInput): Promise<OfficialDraw> {
    return this.#client.$transaction((transaction) => this.confirmInTransaction(transaction, input));
  }

  public async confirmInTransaction(
    transaction: Prisma.TransactionClient,
    input: ConfirmPersistedOfficialDrawInput,
  ): Promise<OfficialDraw> {
    const [draw, actor] = await Promise.all([
      this.findByIdInTransaction(transaction, input.executionId),
      transaction.user.findUnique({
        select: { role: true, status: true },
        where: { id: input.actorId },
      }),
    ]);
    if (draw === null || actor === null) {
      throw new DomainError('DRAW_CONFIRMATION_INVALID', 'Draw or confirming authority is missing.');
    }
    draw.confirm({
      actorId: input.actorId,
      actorRole: parseRole(actor.role, actor.status),
      expectedRevision: input.expectedRevision,
      occurredAt: input.occurredAt,
    });
    const snapshot = draw.toSnapshot();
    const changed = await transaction.officialDraw.updateMany({
      data: {
        confirmedAt: snapshot.confirmedAt,
        confirmedById: snapshot.confirmedBy,
        revision: snapshot.revision,
        status: snapshot.status,
      },
      where: {
        id: snapshot.id,
        revision: input.expectedRevision,
        status: 'PENDING_CONFIRMATION',
      },
    });
    if (changed.count !== 1) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted draw revision is stale.');
    }
    await this.#materialize(snapshot, transaction);
    return draw;
  }

  public annul(input: AnnulPersistedOfficialDrawInput): Promise<OfficialDraw> {
    return this.#client.$transaction((transaction) => this.annulInTransaction(transaction, input));
  }

  public async annulInTransaction(
    transaction: Prisma.TransactionClient,
    input: AnnulPersistedOfficialDrawInput,
  ): Promise<OfficialDraw> {
    const [draw, actor] = await Promise.all([
      this.findByIdInTransaction(transaction, input.executionId),
      transaction.user.findUnique({
        select: { role: true, status: true },
        where: { id: input.actorId },
      }),
    ]);
    if (draw === null || actor === null) {
      throw new DomainError('DRAW_ANNULMENT_INVALID', 'Draw or annulling authority is missing.');
    }
    draw.annul({
      actorId: input.actorId,
      actorRole: parseRole(actor.role, actor.status),
      expectedRevision: input.expectedRevision,
      occurredAt: input.occurredAt,
      reason: input.reason,
    });
    const snapshot = draw.toSnapshot();
    const changed = await transaction.officialDraw.updateMany({
      data: {
        annulledAt: snapshot.annulledAt,
        annulledById: snapshot.annulledBy,
        annulmentReason: snapshot.annulmentReason,
        revision: snapshot.revision,
        status: snapshot.status,
      },
      where: { id: snapshot.id, revision: input.expectedRevision, status: 'CONFIRMED' },
    });
    if (changed.count !== 1) {
      throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted draw revision is stale.');
    }
    return draw;
  }

  async #materialize(snapshot: OfficialDrawSnapshot, transaction: Prisma.TransactionClient) {
    const result = snapshot.evidence.result;
    let matchOrdinal = 1;
    if (result.formatCode === 'GROUP_STAGE') {
      for (const group of result.groups) {
        const persistedGroup = await transaction.drawGroup.create({
          data: {
            competitionId: snapshot.competitionId,
            executionId: snapshot.id,
            label: group.label,
            ordinal: group.ordinal,
          },
        });
        await transaction.drawGroupMember.createMany({
          data: group.members.map((participantId, index) => ({
            competitionId: snapshot.competitionId,
            groupId: persistedGroup.id,
            memberOrdinal: index + 1,
            participantId,
          })),
        });
        for (let first = 0; first < group.members.length; first += 1) {
          for (let second = first + 1; second < group.members.length; second += 1) {
            const participantAId = group.members[first];
            const participantBId = group.members[second];
            if (participantAId === undefined || participantBId === undefined) {
              throw new DomainError(
                'DRAW_EVIDENCE_INVALID',
                'Confirmed group evidence contains an incomplete match.',
              );
            }
            await transaction.logicalMatch.create({
              data: {
                competitionId: snapshot.competitionId,
                executionId: snapshot.id,
                groupId: persistedGroup.id,
                ordinal: matchOrdinal,
                participantAId,
                participantBId,
                roundNumber: 0,
              },
            });
            matchOrdinal += 1;
          }
        }
      }
      return;
    }
    for (const pairing of result.pairings) {
      const persistedPairing = await transaction.drawPairing.create({
        data: {
          competitionId: snapshot.competitionId,
          executionId: snapshot.id,
          ordinal: pairing.ordinal,
          pairingType: 'MATCH',
          participantAId: pairing.participantAId,
          participantBId: pairing.participantBId,
        },
      });
      await transaction.logicalMatch.create({
        data: {
          competitionId: snapshot.competitionId,
          executionId: snapshot.id,
          ordinal: matchOrdinal,
          pairingId: persistedPairing.id,
          participantAId: pairing.participantAId,
          participantBId: pairing.participantBId,
          roundNumber: result.roundNumber,
        },
      });
      matchOrdinal += 1;
    }
    if (result.bye !== null) {
      await transaction.drawPairing.create({
        data: {
          competitionId: snapshot.competitionId,
          executionId: snapshot.id,
          ordinal: result.pairings.length + 1,
          pairingType: 'BYE',
          participantAId: result.bye.participantId,
          priorByeCount: result.bye.priorByeCount,
        },
      });
    }
  }
}
