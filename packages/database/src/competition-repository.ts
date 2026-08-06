import {
  Competition,
  DomainError,
  type CompetitionSnapshot,
  type CompetitionStatus,
  type ParticipantSnapshot,
  type ParticipantStatus,
} from '@oes/domain';

import type { PrismaClient } from './generated/prisma/client.js';

const competitionStatuses = new Set<CompetitionStatus>([
  'DRAFT',
  'OPEN',
  'LOCKED',
  'FINALIZED',
]);
const participantStatuses = new Set<ParticipantStatus>(['ENABLED', 'WITHDRAWN']);

function parseCompetitionStatus(value: string): CompetitionStatus {
  if (competitionStatuses.has(value as CompetitionStatus)) {
    return value as CompetitionStatus;
  }

  throw new DomainError(
    'INVALID_COMPETITION_STATE',
    `Unknown persisted competition status: ${value}.`,
  );
}

function parseParticipantStatus(value: string): ParticipantStatus {
  if (participantStatuses.has(value as ParticipantStatus)) {
    return value as ParticipantStatus;
  }

  throw new DomainError(
    'INVALID_COMPETITION_STATE',
    `Unknown persisted participant status: ${value}.`,
  );
}

export class PrismaCompetitionRepository {
  readonly #client: PrismaClient;

  public constructor(client: PrismaClient) {
    this.#client = client;
  }

  public async insert(competition: Competition): Promise<void> {
    const snapshot = competition.toSnapshot();

    await this.#client.competition.create({
      data: {
        createdAt: snapshot.createdAt,
        createdById: snapshot.createdBy,
        editionId: snapshot.key.editionId,
        eventId: snapshot.key.eventId,
        id: snapshot.id,
        modalityId: snapshot.key.modalityId,
        participants: {
          create: snapshot.participants.map((participant) => ({
            displayName: participant.displayName,
            enabledAt: participant.enabledAt,
            enabledById: participant.enabledBy,
            eventId: participant.eventId,
            id: participant.id,
            institutionId: participant.institutionId,
            revision: participant.revision,
            status: participant.status,
          })),
        },
        revision: snapshot.revision,
        sportId: snapshot.key.sportId,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
        updatedById: snapshot.updatedBy,
      },
    });
  }

  public async findById(id: string): Promise<Competition | null> {
    const record = await this.#client.competition.findUnique({
      include: { participants: { orderBy: { id: 'asc' } } },
      where: { id },
    });

    if (record === null) return null;

    const participants: ParticipantSnapshot[] = record.participants.map(
      (participant) => ({
        displayName: participant.displayName,
        enabledAt: participant.enabledAt,
        enabledBy: participant.enabledById,
        eventId: participant.eventId,
        id: participant.id,
        institutionId: participant.institutionId,
        revision: participant.revision,
        status: parseParticipantStatus(participant.status),
      }),
    );
    const snapshot: CompetitionSnapshot = {
      createdAt: record.createdAt,
      createdBy: record.createdById,
      id: record.id,
      key: {
        editionId: record.editionId,
        eventId: record.eventId,
        modalityId: record.modalityId,
        sportId: record.sportId,
      },
      participants,
      revision: record.revision,
      status: parseCompetitionStatus(record.status),
      updatedAt: record.updatedAt,
      updatedBy: record.updatedById,
    };

    return Competition.rehydrate(snapshot);
  }

  public async save(
    competition: Competition,
    expectedRevision: number,
  ): Promise<void> {
    const snapshot = competition.toSnapshot();

    await this.#client.$transaction(async (transaction) => {
      const update = await transaction.competition.updateMany({
        data: {
          revision: snapshot.revision,
          status: snapshot.status,
          updatedAt: snapshot.updatedAt,
          updatedById: snapshot.updatedBy,
        },
        where: { id: snapshot.id, revision: expectedRevision },
      });

      if (update.count !== 1) {
        throw new DomainError(
          'CONCURRENCY_CONFLICT',
          'The persisted competition revision no longer matches.',
        );
      }

      const persisted = await transaction.competitionParticipant.findMany({
        select: { id: true },
        where: { competitionId: snapshot.id },
      });
      const persistedIds = new Set(persisted.map(({ id }) => id));
      const additions = snapshot.participants.filter(
        ({ id }) => !persistedIds.has(id),
      );

      if (additions.length > 0) {
        await transaction.competitionParticipant.createMany({
          data: additions.map((participant) => ({
            competitionId: snapshot.id,
            displayName: participant.displayName,
            enabledAt: participant.enabledAt,
            enabledById: participant.enabledBy,
            eventId: participant.eventId,
            id: participant.id,
            institutionId: participant.institutionId,
            revision: participant.revision,
            status: participant.status,
          })),
        });
      }
    });
  }
}
