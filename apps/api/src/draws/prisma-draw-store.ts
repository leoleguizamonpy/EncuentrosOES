import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaDrawConfigurationRepository,
  PrismaOfficialDrawService,
  type Prisma,
  type PrismaClient,
} from '@oes/database';
import {
  CompetitionRuleSet,
  DomainError,
  DrawConfiguration,
  generateOfficialSeed,
  type AuthorityRole,
  type CompetitionRuleSetSnapshot,
  type DrawEvidence,
  type MetricCode,
  type PublicDrawAct,
  type TieBreakCriterion,
} from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  ANNUL_SCOPE,
  CONFIRM_SCOPE,
  DrawIdempotencyCoordinator,
  EXECUTE_SCOPE,
  PREPARE_SCOPE,
  PUBLISH_SCOPE,
  type DrawMutationInput,
} from './draw-idempotency.js';
import { DrawReadModel } from './draw-read-model.js';
import {
  DrawStoreError,
  type AnnulDrawInput,
  type ConfirmDrawInput,
  type DrawStore,
  type DrawWorkspace,
  type ExecuteDrawInput,
  type PrepareDrawInput,
  type PublicDrawPublicationView,
  type PublishDrawInput,
} from './draw-store.js';

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function authorityRole(role: DrawMutationInput['actorRole']): AuthorityRole {
  if (role === 'ADMIN' || role === 'SUPERADMIN') return role;
  throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'An administrator authority is required.');
}

function mappedDomainError(
  error: DomainError,
  fallback:
    | 'DRAW_ANNULMENT_INVALID'
    | 'DRAW_CONFIGURATION_INVALID'
    | 'DRAW_CONFIRMATION_INVALID'
    | 'DRAW_EXECUTION_INVALID',
): DrawStoreError {
  return new DrawStoreError(
    error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : fallback,
    error.message,
  );
}

@Injectable()
export class PrismaDrawStore implements DrawStore {
  readonly #configurationRepository: PrismaDrawConfigurationRepository;
  readonly #idempotency: DrawIdempotencyCoordinator;
  readonly #officialDrawService: PrismaOfficialDrawService;
  readonly #reads: DrawReadModel;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#configurationRepository = new PrismaDrawConfigurationRepository(client);
    this.#idempotency = new DrawIdempotencyCoordinator(client);
    this.#officialDrawService = new PrismaOfficialDrawService(client);
    this.#reads = new DrawReadModel(client);
  }

  public workspace(competitionId: string): Promise<DrawWorkspace> {
    return this.#reads.workspace(competitionId);
  }

  public async prepare(input: PrepareDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#idempotency.begin(transaction, input, PREPARE_SCOPE);
        if (replay !== null) return replay;
        const competition = await transaction.competition.findUnique({
          include: { participants: { orderBy: { id: 'asc' }, where: { status: 'ENABLED' } } },
          where: { id: input.competitionId },
        });
        if (competition === null) {
          throw new DrawStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
        }
        if (competition.revision !== input.expectedRevision) {
          throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
        }
        if ((competition.status !== 'DRAFT' && competition.status !== 'OPEN') || competition.formatCode === null) {
          throw new DrawStoreError(
            'DRAW_CONFIGURATION_INVALID',
            'The competition must have an editable format before preparing the draw.',
          );
        }
        const ruleSet = await this.#latestFrozenRuleSet(transaction, input.competitionId);
        if (ruleSet === null) {
          throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'Freeze the scoring rules before preparing the draw.');
        }
        const byeCounts = await transaction.drawPairing.groupBy({
          _count: { participantAId: true },
          by: ['participantAId'],
          where: {
            execution: { competitionId: input.competitionId, status: 'CONFIRMED' },
            pairingType: 'BYE',
          },
        });
        const byes = new Map(byeCounts.map((entry) => [entry.participantAId, entry._count.participantAId]));
        const occurredAt = new Date();
        let configuration: DrawConfiguration;
        try {
          configuration = DrawConfiguration.create({
            actorId: input.actorId,
            competitionId: input.competitionId,
            formatCode: competition.formatCode as 'GROUP_STAGE' | 'KNOCKOUT',
            groupCount: competition.groupCount,
            id: randomUUID(),
            occurredAt,
            participants: competition.participants.map((participant) => ({
              byeCount: byes.get(participant.id) ?? 0,
              displayName: participant.displayName,
              id: participant.id,
            })),
            roundNumber: competition.formatCode === 'GROUP_STAGE' ? 0 : 1,
            ruleSetId: ruleSet.toSnapshot().id,
          } as Parameters<typeof DrawConfiguration.create>[0]);
          configuration.freeze({ actorId: input.actorId, expectedRevision: 1, occurredAt });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIGURATION_INVALID');
          throw error;
        }
        const snapshot = configuration.toSnapshot();
        await this.#configurationRepository.insertInTransaction(transaction, configuration);
        let revision = input.expectedRevision;
        if (competition.status === 'DRAFT') {
          const opened = await transaction.competition.updateMany({
            data: {
              revision: revision + 1,
              status: 'OPEN',
              updatedAt: occurredAt,
              updatedById: input.actorId,
            },
            where: { id: input.competitionId, revision, status: 'DRAFT' },
          });
          if (opened.count !== 1) {
            throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
          }
          revision += 1;
        }
        const locked = await transaction.competition.updateMany({
          data: {
            formatCode: snapshot.formatCode,
            groupCount: snapshot.groupCount,
            lockedAt: occurredAt,
            lockedById: input.actorId,
            revision: revision + 1,
            status: 'LOCKED',
            updatedAt: occurredAt,
            updatedById: input.actorId,
          },
          where: { id: input.competitionId, revision, status: 'OPEN' },
        });
        if (locked.count !== 1) {
          throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The competition could not be locked.');
        }
        await transaction.auditEntry.createMany({
          data: [
            {
              actionCode: 'DRAW_CONFIGURATION_FROZEN',
              actorId: input.actorId,
              actorRole: input.actorRole,
              competitionId: input.competitionId,
              correlationId: input.correlationId,
              id: randomUUID(),
              metadata: { canonicalHash: snapshot.canonicalHash, participantCount: snapshot.participantCount },
              resourceId: snapshot.id,
              resourceType: 'DRAW_CONFIGURATION',
              revisionAfter: snapshot.revision,
            },
            {
              actionCode: 'COMPETITION_LOCKED',
              actorId: input.actorId,
              actorRole: input.actorRole,
              competitionId: input.competitionId,
              correlationId: input.correlationId,
              id: randomUUID(),
              metadata: { drawConfigurationId: snapshot.id, ruleSetId: snapshot.ruleSetId },
              resourceId: input.competitionId,
              resourceType: 'COMPETITION',
              revisionAfter: revision + 1,
              revisionBefore: input.expectedRevision,
            },
          ],
        });
        const response = await this.#reads.workspaceInTransaction(transaction, input.competitionId);
        await this.#idempotency.complete(transaction, input, PREPARE_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#idempotency.recover(error, input, PREPARE_SCOPE, 'DRAW_CONFIGURATION_INVALID');
    }
  }

  public async execute(input: ExecuteDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#idempotency.begin(transaction, input, EXECUTE_SCOPE);
        if (replay !== null) return replay;
        const configuration = await this.#configuration(transaction, input.configurationId);
        if (configuration === null) {
          throw new DrawStoreError('DRAW_NOT_FOUND', 'The draw configuration does not exist.');
        }
        const configurationSnapshot = configuration.toSnapshot();
        if (configurationSnapshot.revision !== input.expectedRevision || configurationSnapshot.status !== 'FROZEN') {
          throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The draw configuration revision is stale.');
        }
        authorityRole(input.actorRole);
        let draw;
        try {
          draw = await this.#officialDrawService.executeInTransaction(transaction, {
            actorId: input.actorId,
            configurationId: input.configurationId,
            executionId: randomUUID(),
            occurredAt: new Date(),
            seed: generateOfficialSeed(),
          });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_EXECUTION_INVALID');
          throw error;
        }
        const snapshot = draw.toSnapshot();
        await transaction.auditEntry.create({
          data: {
            actionCode: 'OFFICIAL_DRAW_EXECUTED',
            actorId: input.actorId,
            actorRole: input.actorRole,
            competitionId: snapshot.competitionId,
            correlationId: input.correlationId,
            id: randomUUID(),
            metadata: {
              configurationId: snapshot.configurationId,
              evidenceHash: snapshot.evidence.evidenceHash,
              seedCommitment: snapshot.evidence.seedCommitment,
            },
            resourceId: snapshot.id,
            resourceType: 'OFFICIAL_DRAW',
            revisionAfter: snapshot.revision,
          },
        });
        const response = await this.#reads.workspaceInTransaction(transaction, snapshot.competitionId);
        await this.#idempotency.complete(transaction, input, EXECUTE_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#idempotency.recover(error, input, EXECUTE_SCOPE, 'DRAW_EXECUTION_INVALID');
    }
  }

  public async confirm(input: ConfirmDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#idempotency.begin(transaction, input, CONFIRM_SCOPE);
        if (replay !== null) return replay;
        const existing = await this.#officialDraw(transaction, input.executionId);
        if (existing === null) {
          throw new DrawStoreError('DRAW_NOT_FOUND', 'The official draw does not exist.');
        }
        authorityRole(input.actorRole);
        let draw;
        try {
          draw = await this.#officialDrawService.confirmInTransaction(transaction, {
            actorId: input.actorId,
            executionId: input.executionId,
            expectedRevision: input.expectedRevision,
            occurredAt: new Date(),
          });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIRMATION_INVALID');
          throw error;
        }
        const snapshot = draw.toSnapshot();
        await transaction.auditEntry.create({
          data: {
            actionCode: 'OFFICIAL_DRAW_CONFIRMED',
            actorId: input.actorId,
            actorRole: input.actorRole,
            competitionId: snapshot.competitionId,
            correlationId: input.correlationId,
            id: randomUUID(),
            metadata: { evidenceHash: snapshot.evidence.evidenceHash },
            resourceId: snapshot.id,
            resourceType: 'OFFICIAL_DRAW',
            revisionAfter: snapshot.revision,
            revisionBefore: input.expectedRevision,
          },
        });
        const response = await this.#reads.workspaceInTransaction(transaction, snapshot.competitionId);
        await this.#idempotency.complete(transaction, input, CONFIRM_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#idempotency.recover(error, input, CONFIRM_SCOPE, 'DRAW_CONFIRMATION_INVALID');
    }
  }

  public async annul(input: AnnulDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#idempotency.begin(transaction, input, ANNUL_SCOPE);
        if (replay !== null) return replay;
        const existing = await this.#officialDraw(transaction, input.executionId);
        if (existing === null) {
          throw new DrawStoreError('DRAW_NOT_FOUND', 'The official draw does not exist.');
        }
        authorityRole(input.actorRole);
        let draw;
        try {
          draw = await this.#officialDrawService.annulInTransaction(transaction, {
            actorId: input.actorId,
            executionId: input.executionId,
            expectedRevision: input.expectedRevision,
            occurredAt: new Date(),
            reason: input.reason,
          });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_ANNULMENT_INVALID');
          throw error;
        }
        const snapshot = draw.toSnapshot();
        await transaction.drawPublication.updateMany({
          data: {
            revocationReason: snapshot.annulmentReason,
            revokedAt: snapshot.annulledAt,
            revision: { increment: 1 },
            status: 'REVOKED',
          },
          where: { officialDrawId: snapshot.id, status: 'PUBLISHED' },
        });
        await transaction.auditEntry.create({
          data: {
            actionCode: 'OFFICIAL_DRAW_ANNULLED',
            actorId: input.actorId,
            actorRole: input.actorRole,
            competitionId: snapshot.competitionId,
            correlationId: input.correlationId,
            id: randomUUID(),
            metadata: { evidenceHash: snapshot.evidence.evidenceHash, reason: snapshot.annulmentReason },
            resourceId: snapshot.id,
            resourceType: 'OFFICIAL_DRAW',
            revisionAfter: snapshot.revision,
            revisionBefore: input.expectedRevision,
          },
        });
        const response = await this.#reads.workspaceInTransaction(transaction, snapshot.competitionId);
        await this.#idempotency.complete(transaction, input, ANNUL_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#idempotency.recover(error, input, ANNUL_SCOPE, 'DRAW_ANNULMENT_INVALID');
    }
  }

  public async publish(input: PublishDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#idempotency.begin(transaction, input, PUBLISH_SCOPE);
        if (replay !== null) return replay;
        const record = await transaction.officialDraw.findUnique({
          include: {
            competition: {
              include: {
                combination: { include: { event: true, modality: true, sport: true } },
                edition: true,
              },
            },
            configuration: {
              include: {
                participants: { orderBy: { canonicalOrder: 'asc' } },
                ruleSet: true,
              },
            },
          },
          where: { id: input.executionId },
        });
        if (record === null) {
          throw new DrawStoreError('DRAW_NOT_FOUND', 'The official draw does not exist.');
        }
        if (record.status !== 'CONFIRMED' || record.revision !== input.expectedRevision || record.confirmedAt === null) {
          throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Only the current confirmed draw can be published.');
        }
        const existing = await transaction.drawPublication.findUnique({ where: { officialDrawId: record.id } });
        if (existing !== null) {
          const response = await this.#reads.workspaceInTransaction(transaction, record.competitionId);
          await this.#idempotency.complete(transaction, input, PUBLISH_SCOPE, response);
          return response;
        }
        if (record.configuration.canonicalHash === null || record.configuration.ruleSet.canonicalHash === null) {
          throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Frozen publication evidence is incomplete.');
        }
        const publicationId = randomUUID();
        const publishedAt = new Date();
        const participantNames = new Map(record.configuration.participants.map((item) => [
          item.competitionParticipantId,
          item.displayNameSnapshot,
        ]));
        const evidence = record.evidenceJson as unknown as DrawEvidence;
        const act: PublicDrawAct = {
          algorithmVersion: record.algorithmVersion,
          competition: {
            edition: record.competition.edition.name,
            event: record.competition.combination.event.name,
            id: record.competitionId,
            modality: record.competition.combination.modality.name,
            sport: record.competition.combination.sport.name,
          },
          configuration: {
            canonicalHash: record.configuration.canonicalHash,
            formatCode: record.configuration.formatCode as 'GROUP_STAGE' | 'KNOCKOUT',
            groupCount: record.configuration.groupCount,
            id: record.configuration.id,
            participantCount: record.configuration.participantCount,
            roundNumber: record.configuration.roundNumber,
            ruleSetHash: record.configuration.ruleSet.canonicalHash,
            ruleSetId: record.configuration.ruleSetId,
          },
          confirmedAt: record.confirmedAt.toISOString(),
          evidenceHash: record.evidenceHash,
          officialDrawId: record.id,
          participants: record.configuration.participants.map((item) => ({
            byeCount: item.byeCountSnapshot,
            id: item.competitionParticipantId,
            name: item.displayNameSnapshot,
          })),
          publicationId,
          publishedAt: publishedAt.toISOString(),
          result: this.#reads.buildPublicActResult(evidence, participantNames),
          schemaVersion: 'oes-public-draw-act-v1',
          seedHex: record.seedHex,
        };
        const verificationCode = this.#reads.verificationCode(act);
        await transaction.drawPublication.create({
          data: {
            actJson: structuredClone(act) as unknown as Prisma.InputJsonValue,
            competitionId: record.competitionId,
            id: publicationId,
            officialDrawId: record.id,
            publishedAt,
            publishedById: input.actorId,
            verificationCode,
          },
        });
        await transaction.auditEntry.create({
          data: {
            actionCode: 'OFFICIAL_DRAW_PUBLISHED',
            actorId: input.actorId,
            actorRole: input.actorRole,
            competitionId: record.competitionId,
            correlationId: input.correlationId,
            id: randomUUID(),
            metadata: { evidenceHash: record.evidenceHash, publicationId, verificationCode },
            resourceId: record.id,
            resourceType: 'OFFICIAL_DRAW',
            revisionAfter: record.revision,
          },
        });
        const response = await this.#reads.workspaceInTransaction(transaction, record.competitionId);
        await this.#idempotency.complete(transaction, input, PUBLISH_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#idempotency.recover(error, input, PUBLISH_SCOPE, 'DRAW_EXECUTION_INVALID');
    }
  }

  public publicDraw(publicationId: string): Promise<PublicDrawPublicationView> {
    return this.#reads.publicDraw(publicationId);
  }

  public verify(verificationCode: string): Promise<Readonly<{ publicationId: string | null; valid: boolean }>> {
    return this.#reads.verify(verificationCode);
  }

  async #configuration(transaction: Prisma.TransactionClient, id: string): Promise<DrawConfiguration | null> {
    try {
      return await this.#configurationRepository.findByIdInTransaction(transaction, id);
    } catch (error: unknown) {
      if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIGURATION_INVALID');
      throw error;
    }
  }

  async #latestFrozenRuleSet(
    transaction: Prisma.TransactionClient,
    competitionId: string,
  ): Promise<CompetitionRuleSet | null> {
    const record = await transaction.competitionRuleSet.findFirst({
      include: {
        metrics: { orderBy: { metricCode: 'asc' } },
        outcomes: { orderBy: { outcomeCode: 'asc' } },
        tiebreaks: { orderBy: { position: 'asc' } },
      },
      orderBy: { revisionNumber: 'desc' },
      where: { competitionId, status: 'FROZEN' },
    });
    if (record === null || !isJsonObject(record.profileConfig)) return null;
    const config = record.profileConfig;
    const profile = config.profile === 'SCORE_BASED' && typeof config.allowDraws === 'boolean'
      ? { allowDraws: config.allowDraws, profile: 'SCORE_BASED' as const }
      : config.profile === 'SET_BASED' && typeof config.setsToWin === 'number'
        ? { profile: 'SET_BASED' as const, setsToWin: config.setsToWin }
        : null;
    if (profile === null) {
      throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'The frozen scoring profile is invalid.');
    }
    try {
      return CompetitionRuleSet.rehydrate({
        canonicalHash: record.canonicalHash,
        competitionId: record.competitionId,
        createdAt: record.createdAt,
        createdBy: record.createdById,
        frozenAt: record.frozenAt,
        frozenBy: record.frozenById,
        id: record.id,
        knockoutResolutionCode: record.knockoutResolutionCode as CompetitionRuleSetSnapshot['knockoutResolutionCode'],
        metrics: record.metrics.map(({ metricCode }) => metricCode as MetricCode),
        outcomes: record.outcomes.map(({ description, outcomeCode, tablePoints }) => ({
          code: outcomeCode,
          description,
          tablePoints,
        })),
        profileConfig: profile,
        resultProfile: record.resultProfile as CompetitionRuleSetSnapshot['resultProfile'],
        revision: record.revision,
        revisionNumber: record.revisionNumber,
        schemaVersion: record.schemaVersion,
        status: 'FROZEN',
        tieBreakCriteria: record.tiebreaks.map(({ criterionCode }) => criterionCode as TieBreakCriterion),
        updatedAt: record.updatedAt,
        updatedBy: record.updatedById,
      });
    } catch (error: unknown) {
      if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIGURATION_INVALID');
      throw error;
    }
  }

  async #officialDraw(transaction: Prisma.TransactionClient, id: string) {
    try {
      return await this.#officialDrawService.findByIdInTransaction(transaction, id);
    } catch (error: unknown) {
      if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_EXECUTION_INVALID');
      throw error;
    }
  }
}
