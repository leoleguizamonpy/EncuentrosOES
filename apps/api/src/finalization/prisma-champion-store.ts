import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PrismaChampionFinalizationService, type PersistedChampionView, type Prisma, type PrismaClient } from '@oes/database';
import { DomainError } from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  ChampionStoreError,
  type ChampionStore,
  type ChampionView,
  type ConfirmChampionInput,
  type ProposeChampionInput,
  type PublicCompetitionJourney,
} from './champion-store.js';

const PROPOSE_SCOPE = 'champion:propose';
const CONFIRM_SCOPE = 'champion:confirm';

type MutationInput = ProposeChampionInput | ConfirmChampionInput;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function authorityRole(role: MutationInput['actorRole']): 'ADMIN' | 'SUPERADMIN' {
  if (role === 'ADMIN' || role === 'SUPERADMIN') return role;
  throw new ChampionStoreError('CHAMPION_INVALID', 'An administrator authority is required.');
}

function requestDigest(input: MutationInput): string {
  return sha256(JSON.stringify({
    competitionId: input.competitionId,
    expectedRevision: input.expectedRevision,
    ...('proposalId' in input ? { proposalId: input.proposalId } : {}),
  }));
}

function view(value: PersistedChampionView): ChampionView {
  return {
    ...value,
    confirmedAt: value.confirmedAt?.toISOString() ?? null,
    proposedAt: value.proposedAt.toISOString(),
  };
}

function parseReplay(value: unknown): ChampionView {
  if (
    !isJsonObject(value) ||
    typeof value.competitionId !== 'string' ||
    typeof value.competitionRevision !== 'number' ||
    typeof value.participantId !== 'string' ||
    typeof value.proposalId !== 'string' ||
    (value.status !== 'CONFIRMED' && value.status !== 'PENDING_CONFIRMATION')
  ) {
    throw new ChampionStoreError('IDEMPOTENCY_CONFLICT', 'The stored champion response is invalid.');
  }
  return value as unknown as ChampionView;
}

@Injectable()
export class PrismaChampionStore implements ChampionStore {
  readonly #service: PrismaChampionFinalizationService;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#service = new PrismaChampionFinalizationService(client);
  }

  public async find(competitionId: string): Promise<ChampionView | null> {
    const champion = await this.#service.find(competitionId);
    return champion === null ? null : view(champion);
  }

  public async publicJourney(competitionId: string): Promise<PublicCompetitionJourney | null> {
    const [competition, champion] = await Promise.all([
      this.client.competition.findUnique({
        include: {
          combination: { include: { event: true, modality: true, sport: true } },
          edition: true,
          officialDraws: {
            include: {
              configuration: { select: { formatCode: true, roundNumber: true } },
              groups: {
                include: {
                  members: {
                    include: { participant: { select: { displayName: true, id: true } } },
                    orderBy: { memberOrdinal: 'asc' },
                  },
                  standings: {
                    include: { participant: { select: { displayName: true, id: true } } },
                    orderBy: [{ position: 'asc' }, { participantId: 'asc' }],
                  },
                },
                orderBy: { ordinal: 'asc' },
              },
              matches: {
                include: {
                  group: { select: { label: true } },
                  participantA: { select: { displayName: true, id: true } },
                  participantB: { select: { displayName: true, id: true } },
                  results: {
                    orderBy: { confirmedAt: 'desc' },
                    select: { detailJson: true, resolvedJson: true },
                    take: 1,
                    where: { status: 'CONFIRMED' },
                  },
                },
                orderBy: { ordinal: 'asc' },
              },
              publication: {
                select: { id: true, publishedAt: true, status: true, verificationCode: true },
              },
            },
            orderBy: [{ configuration: { roundNumber: 'asc' } }, { confirmedAt: 'asc' }],
            where: {
              publication: { is: { status: 'PUBLISHED' } },
              status: 'CONFIRMED',
            },
          },
        },
        where: { id: competitionId },
      }),
      this.#service.find(competitionId),
    ]);
    if (
      competition === null ||
      (competition.status !== 'LOCKED' && competition.status !== 'FINALIZED') ||
      competition.officialDraws.length === 0
    ) return null;

    const confirmedChampion = champion !== null && champion.status === 'CONFIRMED' && champion.confirmedAt !== null
      ? {
          confirmedAt: champion.confirmedAt.toISOString(),
          participantDisplayName: champion.participantDisplayName,
          participantId: champion.participantId,
        }
      : null;

    return {
      champion: confirmedChampion,
      competition: {
        edition: competition.edition.name,
        event: competition.combination.event.name,
        finalizedAt: competition.finalizedAt?.toISOString() ?? null,
        id: competition.id,
        modality: competition.combination.modality.name,
        sport: competition.combination.sport.name,
        status: competition.status,
      },
      rounds: competition.officialDraws.flatMap((execution) => {
        if (execution.publication === null || execution.publication.status !== 'PUBLISHED') return [];
        return [{
          confirmedAt: execution.confirmedAt?.toISOString() ?? execution.executedAt.toISOString(),
          executionId: execution.id,
          formatCode: execution.configuration.formatCode as 'GROUP_STAGE' | 'KNOCKOUT',
          groups: execution.groups.map((group) => ({
            label: group.label,
            members: group.members.map(({ participant }) => participant),
            ordinal: group.ordinal,
            standings: group.standings.map((standing) => ({
              draws: standing.draws,
              losses: standing.losses,
              participant: standing.participant,
              played: standing.played,
              position: standing.position,
              scoreAgainst: standing.scoreAgainst,
              scoreDifference: standing.scoreDifference,
              scoreFor: standing.scoreFor,
              setDifference: standing.setDifference,
              setsLost: standing.setsLost,
              setsWon: standing.setsWon,
              sportPointDifference: standing.sportPointDifference,
              sportPointsAgainst: standing.sportPointsAgainst,
              sportPointsFor: standing.sportPointsFor,
              tablePoints: standing.tablePoints,
              tied: standing.tied,
              wins: standing.wins,
            })),
          })),
          matches: execution.matches.map((match) => {
            const result = match.results[0];
            return {
              groupLabel: match.group?.label ?? null,
              id: match.id,
              ordinal: match.ordinal,
              participantA: match.participantA,
              participantB: match.participantB,
              result: result === undefined ? null : { detail: result.detailJson, resolved: result.resolvedJson },
              winnerParticipantId: result === undefined ? null : match.winnerParticipantId,
            };
          }),
          publication: {
            id: execution.publication.id,
            publishedAt: execution.publication.publishedAt.toISOString(),
            verificationCode: execution.publication.verificationCode,
          },
          roundNumber: execution.configuration.roundNumber,
        }];
      }),
    };
  }

  public propose(input: ProposeChampionInput): Promise<ChampionView> {
    return this.#mutate(input, PROPOSE_SCOPE);
  }

  public confirm(input: ConfirmChampionInput): Promise<ChampionView> {
    return this.#mutate(input, CONFIRM_SCOPE);
  }

  async #mutate(input: MutationInput, scope: string): Promise<ChampionView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, scope);
        if (replay !== null) return replay;

        const common = {
          actorId: input.actorId,
          actorRole: authorityRole(input.actorRole),
          competitionId: input.competitionId,
          correlationId: input.correlationId,
          expectedCompetitionRevision: input.expectedRevision,
          occurredAt: new Date(),
        };
        const persisted = 'proposalId' in input
          ? await this.#service.confirmInTransaction(transaction, { ...common, proposalId: input.proposalId })
          : await this.#service.proposeInTransaction(transaction, common);
        const response = view(persisted);
        await transaction.idempotencyRecord.update({
          data: {
            completedAt: new Date(),
            resourceId: persisted.proposalId,
            resourceType: 'COMPETITION_CHAMPION',
            responseBody: response as unknown as Prisma.InputJsonValue,
            responseStatus: 200,
            status: 'COMPLETED',
          },
          where: {
            actorId_scope_idempotencyKeyHash: {
              actorId: input.actorId,
              idempotencyKeyHash: sha256(input.idempotencyKey),
              scope,
            },
          },
        });
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (error instanceof ChampionStoreError) throw error;
      if (error instanceof DomainError) {
        throw new ChampionStoreError(
          error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : 'CHAMPION_INVALID',
          error.message,
        );
      }
      if (isUniqueConstraint(error)) return this.#recoverConcurrentReplay(input, scope);
      throw error;
    }
  }

  async #beginMutation(
    transaction: Prisma.TransactionClient,
    input: MutationInput,
    scope: string,
  ): Promise<ChampionView | null> {
    const idempotencyKeyHash = sha256(input.idempotencyKey);
    const digest = requestDigest(input);
    const existing = await transaction.idempotencyRecord.findUnique({
      where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash, scope } },
    });
    if (existing !== null) return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, digest);
    await transaction.idempotencyRecord.create({ data: {
      actorId: input.actorId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      id: randomUUID(),
      idempotencyKeyHash,
      requestHash: digest,
      scope,
      status: 'PROCESSING',
    } });
    return null;
  }

  async #recoverConcurrentReplay(input: MutationInput, scope: string): Promise<ChampionView> {
    const existing = await this.client.idempotencyRecord.findUnique({
      where: {
        actorId_scope_idempotencyKeyHash: {
          actorId: input.actorId,
          idempotencyKeyHash: sha256(input.idempotencyKey),
          scope,
        },
      },
    });
    if (existing === null) throw new ChampionStoreError('CHAMPION_INVALID', 'Another incompatible champion operation exists.');
    return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, requestDigest(input));
  }

  #existingResponse(storedHash: string, status: string, body: unknown, expectedHash: string): ChampionView {
    if (storedHash !== expectedHash) {
      throw new ChampionStoreError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another request.');
    }
    if (status !== 'COMPLETED') {
      throw new ChampionStoreError('IDEMPOTENCY_IN_PROGRESS', 'The original champion request is still being processed.');
    }
    return parseReplay(body);
  }
}
