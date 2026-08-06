import {
  DomainError,
  DrawConfiguration,
  type DrawConfigurationSnapshot,
  type DrawConfigurationStatus,
  type DrawFormatCode,
} from '@oes/domain';

import type { PrismaClient } from './generated/prisma/client.js';

const formats = new Set<DrawFormatCode>(['GROUP_STAGE', 'KNOCKOUT']);
const statuses = new Set<DrawConfigurationStatus>(['DRAFT', 'FROZEN', 'DISCARDED']);

function parseCode<T extends string>(value: string, allowed: ReadonlySet<T>, field: string): T {
  if (allowed.has(value as T)) return value as T;
  throw new DomainError(
    'DRAW_CONFIGURATION_INTEGRITY_FAILURE',
    `Unknown persisted ${field}: ${value}.`,
  );
}

export class PrismaDrawConfigurationRepository {
  readonly #client: PrismaClient;

  public constructor(client: PrismaClient) {
    this.#client = client;
  }

  public async insert(configuration: DrawConfiguration): Promise<void> {
    const snapshot = configuration.toSnapshot();
    await this.#client.drawConfiguration.create({
      data: {
        algorithmVersion: snapshot.algorithmVersion,
        canonicalHash: snapshot.canonicalHash,
        competitionId: snapshot.competitionId,
        createdAt: snapshot.createdAt,
        createdById: snapshot.createdBy,
        formatCode: snapshot.formatCode,
        frozenAt: snapshot.frozenAt,
        frozenById: snapshot.frozenBy,
        groupCount: snapshot.groupCount,
        id: snapshot.id,
        participantCount: snapshot.participantCount,
        revision: snapshot.revision,
        roundNumber: snapshot.roundNumber,
        ruleSetId: snapshot.ruleSetId,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
        updatedById: snapshot.updatedBy,
      },
    });
  }

  public async findById(id: string): Promise<DrawConfiguration | null> {
    const record = await this.#client.drawConfiguration.findUnique({ where: { id } });
    if (record === null) return null;
    if (record.algorithmVersion !== 'oes-draw-v1') {
      throw new DomainError(
        'DRAW_CONFIGURATION_INTEGRITY_FAILURE',
        `Unknown persisted algorithm: ${record.algorithmVersion}.`,
      );
    }
    const snapshot: DrawConfigurationSnapshot = {
      algorithmVersion: record.algorithmVersion,
      canonicalHash: record.canonicalHash,
      competitionId: record.competitionId,
      createdAt: record.createdAt,
      createdBy: record.createdById,
      formatCode: parseCode(record.formatCode, formats, 'draw format'),
      frozenAt: record.frozenAt,
      frozenBy: record.frozenById,
      groupCount: record.groupCount,
      id: record.id,
      participantCount: record.participantCount,
      revision: record.revision,
      roundNumber: record.roundNumber,
      ruleSetId: record.ruleSetId,
      status: parseCode(record.status, statuses, 'draw status'),
      updatedAt: record.updatedAt,
      updatedBy: record.updatedById,
    };
    return DrawConfiguration.rehydrate(snapshot);
  }

  public async save(
    configuration: DrawConfiguration,
    expectedRevision: number,
  ): Promise<void> {
    const snapshot = configuration.toSnapshot();
    const update = await this.#client.drawConfiguration.updateMany({
      data: {
        canonicalHash: snapshot.canonicalHash,
        formatCode: snapshot.formatCode,
        frozenAt: snapshot.frozenAt,
        frozenById: snapshot.frozenBy,
        groupCount: snapshot.groupCount,
        participantCount: snapshot.participantCount,
        revision: snapshot.revision,
        roundNumber: snapshot.roundNumber,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
        updatedById: snapshot.updatedBy,
      },
      where: { id: snapshot.id, revision: expectedRevision },
    });
    if (update.count !== 1) {
      throw new DomainError(
        'CONCURRENCY_CONFLICT',
        'The persisted draw revision no longer matches.',
      );
    }
  }
}
