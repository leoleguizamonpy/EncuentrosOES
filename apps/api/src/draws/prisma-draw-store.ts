import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaDrawConfigurationRepository,
  type Prisma,
  type PrismaClient,
} from '@oes/database';
import {
  CompetitionRuleSet,
  DomainError,
  DrawConfiguration,
  OfficialDraw,
  generateOfficialSeed,
  publicDrawVerificationCode,
  verifyPublicDrawAct,
  type AuthorityRole,
  type CompetitionRuleSetSnapshot,
  type DrawEvidence,
  type MetricCode,
  type OfficialDrawSnapshot,
  type PublicDrawAct,
  type PublicDrawResult,
  type TieBreakCriterion,
} from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import {
  DrawStoreError,
  type AnnulDrawInput,
  type ConfirmDrawInput,
  type DrawStore,
  type DrawWorkspace,
  type ExecuteDrawInput,
  type OfficialDrawResultView,
  type PrepareDrawInput,
  type PublicDrawPublicationView,
  type PublishDrawInput,
} from './draw-store.js';

const PREPARE_SCOPE = 'draw:prepare';
const EXECUTE_SCOPE = 'draw:execute';
const CONFIRM_SCOPE = 'draw:confirm';
const ANNUL_SCOPE = 'draw:annul';
const PUBLISH_SCOPE = 'draw:publish';

type MutationInput = PrepareDrawInput | ExecuteDrawInput | ConfirmDrawInput | AnnulDrawInput;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function authorityRole(role: MutationInput['actorRole']): AuthorityRole {
  if (role === 'ADMIN' || role === 'SUPERADMIN') return role;
  throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'An administrator authority is required.');
}

function mutationDigest(input: MutationInput): string {
  return sha256(JSON.stringify({
    expectedRevision: input.expectedRevision,
    ...('reason' in input ? { reason: input.reason.trim() } : {}),
    ...('competitionId' in input
      ? { competitionId: input.competitionId }
      : 'configurationId' in input
        ? { configurationId: input.configurationId }
        : { executionId: input.executionId }),
  }));
}

function parseReplay(value: unknown): DrawWorkspace {
  if (!isJsonObject(value) || typeof value.competitionId !== 'string') {
    throw new DrawStoreError('IDEMPOTENCY_CONFLICT', 'The stored draw response is invalid.');
  }
  return value as unknown as DrawWorkspace;
}

function mappedDomainError(error: DomainError, fallback: 'DRAW_ANNULMENT_INVALID' | 'DRAW_CONFIGURATION_INVALID' | 'DRAW_CONFIRMATION_INVALID' | 'DRAW_EXECUTION_INVALID'): DrawStoreError {
  return new DrawStoreError(error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : fallback, error.message);
}

function evidenceJson(evidence: DrawEvidence): Prisma.InputJsonValue {
  return structuredClone(evidence) as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class PrismaDrawStore implements DrawStore {
  readonly #configurationRepository: PrismaDrawConfigurationRepository;

  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {
    this.#configurationRepository = new PrismaDrawConfigurationRepository(client);
  }

  public workspace(competitionId: string): Promise<DrawWorkspace> {
    return this.client.$transaction((transaction) => this.#workspace(transaction, competitionId));
  }

  public async prepare(input: PrepareDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, PREPARE_SCOPE);
        if (replay !== null) return replay;
        const competition = await transaction.competition.findUnique({
          include: { participants: { orderBy: { id: 'asc' }, where: { status: 'ENABLED' } } },
          where: { id: input.competitionId },
        });
        if (competition === null) throw new DrawStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
        if (competition.revision !== input.expectedRevision) throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
        if ((competition.status !== 'DRAFT' && competition.status !== 'OPEN') || competition.formatCode === null) {
          throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'The competition must have an editable format before preparing the draw.');
        }
        const ruleSet = await this.#latestFrozenRuleSet(transaction, input.competitionId);
        if (ruleSet === null) throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'Freeze the scoring rules before preparing the draw.');
        const byeCounts = await transaction.drawPairing.groupBy({
          _count: { participantAId: true },
          by: ['participantAId'],
          where: { execution: { competitionId: input.competitionId, status: 'CONFIRMED' }, pairingType: 'BYE' },
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
            data: { revision: revision + 1, status: 'OPEN', updatedAt: occurredAt, updatedById: input.actorId },
            where: { id: input.competitionId, revision, status: 'DRAFT' },
          });
          if (opened.count !== 1) throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The competition revision is stale.');
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
        if (locked.count !== 1) throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The competition could not be locked.');
        await transaction.auditEntry.createMany({ data: [
          {
            actionCode: 'DRAW_CONFIGURATION_FROZEN', actorId: input.actorId, actorRole: input.actorRole,
            competitionId: input.competitionId, correlationId: input.correlationId, id: randomUUID(),
            metadata: { canonicalHash: snapshot.canonicalHash, participantCount: snapshot.participantCount },
            resourceId: snapshot.id, resourceType: 'DRAW_CONFIGURATION', revisionAfter: snapshot.revision,
          },
          {
            actionCode: 'COMPETITION_LOCKED', actorId: input.actorId, actorRole: input.actorRole,
            competitionId: input.competitionId, correlationId: input.correlationId, id: randomUUID(),
            metadata: { drawConfigurationId: snapshot.id, ruleSetId: snapshot.ruleSetId },
            resourceId: input.competitionId, resourceType: 'COMPETITION', revisionAfter: revision + 1, revisionBefore: input.expectedRevision,
          },
        ] });
        const response = await this.#workspace(transaction, input.competitionId);
        await this.#completeMutation(transaction, input, PREPARE_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#recoverMutation(error, input, PREPARE_SCOPE, 'DRAW_CONFIGURATION_INVALID');
    }
  }

  public async execute(input: ExecuteDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, EXECUTE_SCOPE);
        if (replay !== null) return replay;
        const configuration = await this.#configuration(transaction, input.configurationId);
        if (configuration === null) throw new DrawStoreError('DRAW_NOT_FOUND', 'The draw configuration does not exist.');
        const configurationSnapshot = configuration.toSnapshot();
        if (configurationSnapshot.revision !== input.expectedRevision || configurationSnapshot.status !== 'FROZEN') {
          throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The draw configuration revision is stale.');
        }
        const competition = await transaction.competition.findUnique({ select: { status: true }, where: { id: configurationSnapshot.competitionId } });
        if (competition === null) throw new DrawStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
        let draw: OfficialDraw;
        try {
          draw = OfficialDraw.execute({
            actorId: input.actorId,
            actorRole: authorityRole(input.actorRole),
            competitionStatus: competition.status as 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN',
            configuration: configurationSnapshot,
            id: randomUUID(),
            occurredAt: new Date(),
            seed: generateOfficialSeed(),
          });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_EXECUTION_INVALID');
          throw error;
        }
        const snapshot = draw.toSnapshot();
        await transaction.officialDraw.create({ data: {
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
        } });
        await transaction.auditEntry.create({ data: {
          actionCode: 'OFFICIAL_DRAW_EXECUTED', actorId: input.actorId, actorRole: input.actorRole,
          competitionId: snapshot.competitionId, correlationId: input.correlationId, id: randomUUID(),
          metadata: { configurationId: snapshot.configurationId, evidenceHash: snapshot.evidence.evidenceHash, seedCommitment: snapshot.evidence.seedCommitment },
          resourceId: snapshot.id, resourceType: 'OFFICIAL_DRAW', revisionAfter: snapshot.revision,
        } });
        const response = await this.#workspace(transaction, snapshot.competitionId);
        await this.#completeMutation(transaction, input, EXECUTE_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#recoverMutation(error, input, EXECUTE_SCOPE, 'DRAW_EXECUTION_INVALID');
    }
  }

  public async confirm(input: ConfirmDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, CONFIRM_SCOPE);
        if (replay !== null) return replay;
        const draw = await this.#officialDraw(transaction, input.executionId);
        if (draw === null) throw new DrawStoreError('DRAW_NOT_FOUND', 'The official draw does not exist.');
        try {
          draw.confirm({ actorId: input.actorId, actorRole: authorityRole(input.actorRole), expectedRevision: input.expectedRevision, occurredAt: new Date() });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIRMATION_INVALID');
          throw error;
        }
        const snapshot = draw.toSnapshot();
        const changed = await transaction.officialDraw.updateMany({
          data: { confirmedAt: snapshot.confirmedAt, confirmedById: snapshot.confirmedBy, revision: snapshot.revision, status: snapshot.status },
          where: { id: snapshot.id, revision: input.expectedRevision, status: 'PENDING_CONFIRMATION' },
        });
        if (changed.count !== 1) throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The official draw revision is stale.');
        await this.#materialize(snapshot, transaction);
        await transaction.auditEntry.create({ data: {
          actionCode: 'OFFICIAL_DRAW_CONFIRMED', actorId: input.actorId, actorRole: input.actorRole,
          competitionId: snapshot.competitionId, correlationId: input.correlationId, id: randomUUID(),
          metadata: { evidenceHash: snapshot.evidence.evidenceHash }, resourceId: snapshot.id,
          resourceType: 'OFFICIAL_DRAW', revisionAfter: snapshot.revision, revisionBefore: input.expectedRevision,
        } });
        const response = await this.#workspace(transaction, snapshot.competitionId);
        await this.#completeMutation(transaction, input, CONFIRM_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#recoverMutation(error, input, CONFIRM_SCOPE, 'DRAW_CONFIRMATION_INVALID');
    }
  }

  public async annul(input: AnnulDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, ANNUL_SCOPE);
        if (replay !== null) return replay;
        const draw = await this.#officialDraw(transaction, input.executionId);
        if (draw === null) throw new DrawStoreError('DRAW_NOT_FOUND', 'The official draw does not exist.');
        try {
          draw.annul({
            actorId: input.actorId,
            actorRole: authorityRole(input.actorRole),
            expectedRevision: input.expectedRevision,
            occurredAt: new Date(),
            reason: input.reason,
          });
        } catch (error: unknown) {
          if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_ANNULMENT_INVALID');
          throw error;
        }
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
        if (changed.count !== 1) throw new DrawStoreError('CONCURRENCY_CONFLICT', 'The official draw revision is stale.');
        await transaction.drawPublication.updateMany({
          data: {
            revocationReason: snapshot.annulmentReason,
            revokedAt: snapshot.annulledAt,
            revision: { increment: 1 },
            status: 'REVOKED',
          },
          where: { officialDrawId: snapshot.id, status: 'PUBLISHED' },
        });
        await transaction.auditEntry.create({ data: {
          actionCode: 'OFFICIAL_DRAW_ANNULLED', actorId: input.actorId, actorRole: input.actorRole,
          competitionId: snapshot.competitionId, correlationId: input.correlationId, id: randomUUID(),
          metadata: { evidenceHash: snapshot.evidence.evidenceHash, reason: snapshot.annulmentReason },
          resourceId: snapshot.id, resourceType: 'OFFICIAL_DRAW', revisionAfter: snapshot.revision,
          revisionBefore: input.expectedRevision,
        } });
        const response = await this.#workspace(transaction, snapshot.competitionId);
        await this.#completeMutation(transaction, input, ANNUL_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#recoverMutation(error, input, ANNUL_SCOPE, 'DRAW_ANNULMENT_INVALID');
    }
  }

  public async publish(input: PublishDrawInput): Promise<DrawWorkspace> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const replay = await this.#beginMutation(transaction, input, PUBLISH_SCOPE);
        if (replay !== null) return replay;
        const record = await transaction.officialDraw.findUnique({
          include: {
            competition: { include: { combination: { include: { event: true, modality: true, sport: true } }, edition: true } },
            configuration: { include: { participants: { orderBy: { canonicalOrder: 'asc' } }, ruleSet: true } },
          },
          where: { id: input.executionId },
        });
        if (record === null) throw new DrawStoreError('DRAW_NOT_FOUND', 'The official draw does not exist.');
        if (record.status !== 'CONFIRMED' || record.revision !== input.expectedRevision || record.confirmedAt === null) {
          throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Only the current confirmed draw can be published.');
        }
        const existing = await transaction.drawPublication.findUnique({ where: { officialDrawId: record.id } });
        if (existing !== null) {
          const response = await this.#workspace(transaction, record.competitionId);
          await this.#completeMutation(transaction, input, PUBLISH_SCOPE, response);
          return response;
        }
        if (record.configuration.canonicalHash === null || record.configuration.ruleSet.canonicalHash === null) {
          throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Frozen publication evidence is incomplete.');
        }
        const publicationId = randomUUID();
        const publishedAt = new Date();
        const participantNames = new Map(record.configuration.participants.map((item) => [item.competitionParticipantId, item.displayNameSnapshot]));
        const evidence = record.evidenceJson as unknown as DrawEvidence;
        const result = this.#publicResult(evidence, participantNames);
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
          result,
          schemaVersion: 'oes-public-draw-act-v1',
          seedHex: record.seedHex,
        };
        const verificationCode = publicDrawVerificationCode(act);
        await transaction.drawPublication.create({ data: {
          actJson: structuredClone(act) as unknown as Prisma.InputJsonValue,
          competitionId: record.competitionId,
          id: publicationId,
          officialDrawId: record.id,
          publishedAt,
          publishedById: input.actorId,
          verificationCode,
        } });
        await transaction.auditEntry.create({ data: {
          actionCode: 'OFFICIAL_DRAW_PUBLISHED', actorId: input.actorId, actorRole: input.actorRole,
          competitionId: record.competitionId, correlationId: input.correlationId, id: randomUUID(),
          metadata: { evidenceHash: record.evidenceHash, publicationId, verificationCode },
          resourceId: record.id, resourceType: 'OFFICIAL_DRAW', revisionAfter: record.revision,
        } });
        const response = await this.#workspace(transaction, record.competitionId);
        await this.#completeMutation(transaction, input, PUBLISH_SCOPE, response);
        return response;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      return this.#recoverMutation(error, input, PUBLISH_SCOPE, 'DRAW_EXECUTION_INVALID');
    }
  }

  public async publicDraw(publicationId: string): Promise<PublicDrawPublicationView> {
    const record = await this.client.drawPublication.findUnique({
      include: { officialDraw: { select: { evidenceHash: true, status: true } } },
      where: { id: publicationId },
    });
    if (record === null || record.status !== 'PUBLISHED' || record.officialDraw.status !== 'CONFIRMED') {
      throw new DrawStoreError('DRAW_NOT_FOUND', 'The published draw does not exist.');
    }
    const act = record.actJson as unknown as PublicDrawAct;
    const verified = record.officialDraw.evidenceHash === act.evidenceHash && verifyPublicDrawAct(act, record.verificationCode);
    return { act, id: record.id, publishedAt: record.publishedAt.toISOString(), verificationCode: record.verificationCode, verified };
  }

  public async verify(verificationCode: string): Promise<Readonly<{ publicationId: string | null; valid: boolean }>> {
    const record = await this.client.drawPublication.findUnique({ where: { verificationCode } });
    if (record === null || record.status !== 'PUBLISHED') return { publicationId: null, valid: false };
    try {
      const publication = await this.publicDraw(record.id);
      return { publicationId: record.id, valid: publication.verified };
    } catch {
      return { publicationId: record.id, valid: false };
    }
  }

  async #workspace(transaction: Prisma.TransactionClient, competitionId: string): Promise<DrawWorkspace> {
    const competition = await transaction.competition.findUnique({ select: { id: true, revision: true, status: true }, where: { id: competitionId } });
    if (competition === null) throw new DrawStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    const configurationRecord = await transaction.drawConfiguration.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { competitionId, status: 'FROZEN' },
    });
    if (configurationRecord === null) return {
      competitionId, competitionRevision: competition.revision,
      competitionStatus: competition.status as DrawWorkspace['competitionStatus'], configuration: null, execution: null, publication: null,
    };
    if (configurationRecord.canonicalHash === null) throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'Frozen draw evidence is missing.');
    const executionRecord = await transaction.officialDraw.findFirst({
      include: { confirmedBy: { select: { displayName: true, id: true } }, executedBy: { select: { displayName: true, id: true } }, _count: { select: { matches: true } } },
      orderBy: { executedAt: 'desc' },
      where: { configurationId: configurationRecord.id, status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
    });
    const configuration = {
      canonicalHash: configurationRecord.canonicalHash,
      formatCode: configurationRecord.formatCode as 'GROUP_STAGE' | 'KNOCKOUT',
      groupCount: configurationRecord.groupCount,
      id: configurationRecord.id,
      participantCount: configurationRecord.participantCount,
      revision: configurationRecord.revision,
      roundNumber: configurationRecord.roundNumber,
      status: 'FROZEN' as const,
    };
    if (executionRecord === null) return {
      competitionId, competitionRevision: competition.revision,
      competitionStatus: competition.status as DrawWorkspace['competitionStatus'], configuration, execution: null, publication: null,
    };
    const publicationRecord = await transaction.drawPublication.findUnique({ where: { officialDrawId: executionRecord.id } });
    const evidence = executionRecord.evidenceJson as unknown as DrawEvidence;
    return {
      competitionId,
      competitionRevision: competition.revision,
      competitionStatus: competition.status as DrawWorkspace['competitionStatus'],
      configuration,
      execution: {
        confirmedAt: executionRecord.confirmedAt?.toISOString() ?? null,
        confirmedBy: executionRecord.confirmedBy,
        evidenceHash: executionRecord.evidenceHash,
        executedAt: executionRecord.executedAt.toISOString(),
        executedBy: executionRecord.executedBy,
        id: executionRecord.id,
        matchCount: executionRecord._count.matches,
        result: await this.#resultView(transaction, competitionId, evidence),
        revision: executionRecord.revision,
        seedCommitment: executionRecord.seedCommitment,
        seedHex: executionRecord.status === 'CONFIRMED' ? executionRecord.seedHex : null,
        status: executionRecord.status as 'CONFIRMED' | 'PENDING_CONFIRMATION',
      },
      publication: publicationRecord === null || publicationRecord.status !== 'PUBLISHED' ? null : {
        id: publicationRecord.id,
        publishedAt: publicationRecord.publishedAt.toISOString(),
        verificationCode: publicationRecord.verificationCode,
      },
    };
  }

  #publicResult(evidence: DrawEvidence, names: ReadonlyMap<string, string>): PublicDrawResult {
    const participant = (id: string) => {
      const name = names.get(id);
      if (name === undefined) throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Public evidence references an unknown participant.');
      return { id, name };
    };
    if (evidence.result.formatCode === 'GROUP_STAGE') return {
      formatCode: 'GROUP_STAGE',
      groups: evidence.result.groups.map((group) => ({ ...group, members: group.members.map(participant) })),
    };
    return {
      bye: evidence.result.bye === null ? null : { participant: participant(evidence.result.bye.participantId), priorByeCount: evidence.result.bye.priorByeCount },
      formatCode: 'KNOCKOUT',
      pairings: evidence.result.pairings.map((pairing) => ({ ordinal: pairing.ordinal, participantA: participant(pairing.participantAId), participantB: participant(pairing.participantBId) })),
      roundNumber: evidence.result.roundNumber,
    };
  }

  async #resultView(transaction: Prisma.TransactionClient, competitionId: string, evidence: DrawEvidence): Promise<OfficialDrawResultView> {
    const ids = evidence.result.formatCode === 'GROUP_STAGE'
      ? evidence.result.groups.flatMap(({ members }) => members)
      : [...evidence.result.pairings.flatMap(({ participantAId, participantBId }) => [participantAId, participantBId]), ...(evidence.result.bye === null ? [] : [evidence.result.bye.participantId])];
    const participants = await transaction.competitionParticipant.findMany({ select: { displayName: true, id: true }, where: { competitionId, id: { in: ids } } });
    const byId = new Map(participants.map((participant) => [participant.id, participant]));
    const participant = (id: string) => {
      const found = byId.get(id);
      if (found === undefined) throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Draw evidence references an unknown participant.');
      return found;
    };
    if (evidence.result.formatCode === 'GROUP_STAGE') return {
      formatCode: 'GROUP_STAGE',
      groups: evidence.result.groups.map((group) => ({ ...group, members: group.members.map(participant) })),
    };
    return {
      bye: evidence.result.bye === null ? null : { participant: participant(evidence.result.bye.participantId), priorByeCount: evidence.result.bye.priorByeCount },
      formatCode: 'KNOCKOUT',
      pairings: evidence.result.pairings.map((pairing) => ({ ordinal: pairing.ordinal, participantA: participant(pairing.participantAId), participantB: participant(pairing.participantBId) })),
      roundNumber: evidence.result.roundNumber,
    };
  }

  async #configuration(transaction: Prisma.TransactionClient, id: string): Promise<DrawConfiguration | null> {
    try {
      return await this.#configurationRepository.findByIdInTransaction(transaction, id);
    } catch (error: unknown) {
      if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIGURATION_INVALID');
      throw error;
    }
  }

  async #latestFrozenRuleSet(transaction: Prisma.TransactionClient, competitionId: string): Promise<CompetitionRuleSet | null> {
    const record = await transaction.competitionRuleSet.findFirst({
      include: { metrics: { orderBy: { metricCode: 'asc' } }, outcomes: { orderBy: { outcomeCode: 'asc' } }, tiebreaks: { orderBy: { position: 'asc' } } },
      orderBy: { revisionNumber: 'desc' }, where: { competitionId, status: 'FROZEN' },
    });
    if (record === null || !isJsonObject(record.profileConfig)) return null;
    const config = record.profileConfig;
    const profile = config.profile === 'SCORE_BASED' && typeof config.allowDraws === 'boolean'
      ? { allowDraws: config.allowDraws, profile: 'SCORE_BASED' as const }
      : config.profile === 'SET_BASED' && typeof config.setsToWin === 'number'
        ? { profile: 'SET_BASED' as const, setsToWin: config.setsToWin }
        : null;
    if (profile === null) throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'The frozen scoring profile is invalid.');
    try {
      return CompetitionRuleSet.rehydrate({
        canonicalHash: record.canonicalHash, competitionId: record.competitionId, createdAt: record.createdAt, createdBy: record.createdById,
        frozenAt: record.frozenAt, frozenBy: record.frozenById, id: record.id,
        knockoutResolutionCode: record.knockoutResolutionCode as CompetitionRuleSetSnapshot['knockoutResolutionCode'],
        metrics: record.metrics.map(({ metricCode }) => metricCode as MetricCode), outcomes: record.outcomes.map(({ description, outcomeCode, tablePoints }) => ({ code: outcomeCode, description, tablePoints })),
        profileConfig: profile, resultProfile: record.resultProfile as CompetitionRuleSetSnapshot['resultProfile'], revision: record.revision,
        revisionNumber: record.revisionNumber, schemaVersion: record.schemaVersion, status: 'FROZEN',
        tieBreakCriteria: record.tiebreaks.map(({ criterionCode }) => criterionCode as TieBreakCriterion), updatedAt: record.updatedAt, updatedBy: record.updatedById,
      });
    } catch (error: unknown) {
      if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_CONFIGURATION_INVALID');
      throw error;
    }
  }

  async #officialDraw(transaction: Prisma.TransactionClient, id: string): Promise<OfficialDraw | null> {
    const record = await transaction.officialDraw.findUnique({ where: { id } });
    if (record === null) return null;
    const configuration = await this.#configuration(transaction, record.configurationId);
    if (configuration === null) throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'The persisted draw configuration is missing.');
    try {
      return OfficialDraw.rehydrate({
        annulledAt: record.annulledAt, annulledBy: record.annulledById, annulmentReason: record.annulmentReason,
        competitionId: record.competitionId, configurationId: record.configurationId, confirmedAt: record.confirmedAt,
        confirmedBy: record.confirmedById, evidence: record.evidenceJson as unknown as DrawEvidence,
        executedAt: record.executedAt, executedBy: record.executedById, id: record.id, revision: record.revision,
        seedHex: record.seedHex, status: record.status as OfficialDrawSnapshot['status'],
      }, configuration.toSnapshot());
    } catch (error: unknown) {
      if (error instanceof DomainError) throw mappedDomainError(error, 'DRAW_EXECUTION_INVALID');
      throw error;
    }
  }

  async #materialize(snapshot: OfficialDrawSnapshot, transaction: Prisma.TransactionClient): Promise<void> {
    const result = snapshot.evidence.result;
    let ordinal = 1;
    if (result.formatCode === 'GROUP_STAGE') {
      for (const group of result.groups) {
        const groupId = randomUUID();
        await transaction.drawGroup.create({ data: { competitionId: snapshot.competitionId, executionId: snapshot.id, id: groupId, label: group.label, ordinal: group.ordinal } });
        await transaction.drawGroupMember.createMany({ data: group.members.map((participantId, index) => ({ competitionId: snapshot.competitionId, groupId, memberOrdinal: index + 1, participantId })) });
        for (let first = 0; first < group.members.length; first += 1) for (let second = first + 1; second < group.members.length; second += 1) {
          const participantAId = group.members[first]; const participantBId = group.members[second];
          if (participantAId === undefined || participantBId === undefined) throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Confirmed group evidence is incomplete.');
          await transaction.logicalMatch.create({ data: { competitionId: snapshot.competitionId, executionId: snapshot.id, groupId, ordinal, participantAId, participantBId, roundNumber: 0 } });
          ordinal += 1;
        }
      }
      return;
    }
    for (const pairing of result.pairings) {
      const pairingId = randomUUID();
      await transaction.drawPairing.create({ data: { competitionId: snapshot.competitionId, executionId: snapshot.id, id: pairingId, ordinal: pairing.ordinal, pairingType: 'MATCH', participantAId: pairing.participantAId, participantBId: pairing.participantBId } });
      await transaction.logicalMatch.create({ data: { competitionId: snapshot.competitionId, executionId: snapshot.id, ordinal, pairingId, participantAId: pairing.participantAId, participantBId: pairing.participantBId, roundNumber: result.roundNumber } });
      ordinal += 1;
    }
    if (result.bye !== null) await transaction.drawPairing.create({ data: { competitionId: snapshot.competitionId, executionId: snapshot.id, ordinal: result.pairings.length + 1, pairingType: 'BYE', participantAId: result.bye.participantId, priorByeCount: result.bye.priorByeCount } });
  }

  async #beginMutation(transaction: Prisma.TransactionClient, input: MutationInput, scope: string): Promise<DrawWorkspace | null> {
    const keyHash = sha256(input.idempotencyKey); const requestHash = mutationDigest(input);
    const existing = await transaction.idempotencyRecord.findUnique({ where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: keyHash, scope } } });
    if (existing !== null) return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, requestHash);
    await transaction.idempotencyRecord.create({ data: { actorId: input.actorId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), id: randomUUID(), idempotencyKeyHash: keyHash, requestHash, scope, status: 'PROCESSING' } });
    return null;
  }

  async #completeMutation(transaction: Prisma.TransactionClient, input: MutationInput, scope: string, response: DrawWorkspace): Promise<void> {
    await transaction.idempotencyRecord.update({ data: { completedAt: new Date(), resourceId: response.competitionId, resourceType: 'COMPETITION', responseBody: response as unknown as Prisma.InputJsonValue, responseStatus: 200, status: 'COMPLETED' }, where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: sha256(input.idempotencyKey), scope } } });
  }

  async #recoverMutation(error: unknown, input: MutationInput, scope: string, fallback: 'DRAW_ANNULMENT_INVALID' | 'DRAW_CONFIGURATION_INVALID' | 'DRAW_CONFIRMATION_INVALID' | 'DRAW_EXECUTION_INVALID'): Promise<DrawWorkspace> {
    if (!isUniqueConstraint(error)) throw error;
    const existing = await this.client.idempotencyRecord.findUnique({ where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: sha256(input.idempotencyKey), scope } } });
    if (existing !== null) return this.#existingResponse(existing.requestHash, existing.status, existing.responseBody, mutationDigest(input));
    throw new DrawStoreError(fallback, 'Another incompatible draw operation already exists.');
  }

  #existingResponse(storedHash: string, status: string, body: unknown, requestHash: string): DrawWorkspace {
    if (storedHash !== requestHash) throw new DrawStoreError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for another request.');
    if (status !== 'COMPLETED') throw new DrawStoreError('IDEMPOTENCY_IN_PROGRESS', 'The original draw request is still being processed.');
    return parseReplay(body);
  }
}
