import type { Prisma } from '@oes/database';
import {
  CompetitionRuleSet,
  DomainError,
  type CompetitionRuleSetSnapshot,
  type MetricCode,
  type TieBreakCriterion,
} from '@oes/domain';

import {
  CompetitionStoreError,
  type CompetitionDetail,
  type FreezeStoredRuleSetInput,
  type SaveStoredRuleSetInput,
  type ScoreTieBreakCriterion,
  type SetTieBreakCriterion,
} from './competition-store.js';

function ruleSetStoreError(error: DomainError): CompetitionStoreError {
  return new CompetitionStoreError(
    error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : 'RULE_SET_INVALID',
    error.message,
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configuredMetrics(input: SaveStoredRuleSetInput): readonly MetricCode[] {
  if (input.resultProfile === 'SCORE_BASED') {
    return [
      'PLAYED', 'WINS', ...(input.allowDraws ? ['DRAWS' as const] : []), 'LOSSES',
      'TABLE_POINTS', 'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE',
    ];
  }
  return [
    'PLAYED', 'WINS', 'LOSSES', 'TABLE_POINTS', 'SETS_WON', 'SETS_LOST',
    'SET_DIFFERENCE', 'SPORT_POINTS_FOR', 'SPORT_POINTS_AGAINST',
    'SPORT_POINT_DIFFERENCE',
  ];
}

function createRuleSet(input: SaveStoredRuleSetInput, id: string, occurredAt: Date): CompetitionRuleSet {
  const common = {
    actorId: input.actorId,
    competitionId: input.competitionId,
    id,
    metrics: configuredMetrics(input),
    occurredAt,
    revisionNumber: 1,
    schemaVersion: 1,
    tieBreakCriteria: input.tieBreakCriteria as readonly TieBreakCriterion[],
  };
  if (input.resultProfile === 'SCORE_BASED') {
    const outcomes = [
      { code: 'WIN', description: 'Victoria', tablePoints: input.winPoints },
      { code: 'LOSS', description: 'Derrota', tablePoints: input.lossPoints },
    ];
    if (input.allowDraws) {
      if (input.drawPoints === null) {
        throw new CompetitionStoreError('RULE_SET_INVALID', 'Draw points are required when draws are allowed.');
      }
      outcomes.splice(1, 0, { code: 'DRAW', description: 'Empate', tablePoints: input.drawPoints });
    }
    return CompetitionRuleSet.create({
      ...common,
      knockoutResolutionCode: 'HIGHER_SCORE',
      outcomes,
      profileConfig: { allowDraws: input.allowDraws, profile: 'SCORE_BASED' },
      resultProfile: 'SCORE_BASED',
    });
  }
  return CompetitionRuleSet.create({
    ...common,
    knockoutResolutionCode: 'MOST_SETS_WON',
    outcomes: [
      { code: 'WIN', description: 'Victoria', tablePoints: input.winPoints },
      { code: 'LOSS', description: 'Derrota', tablePoints: input.lossPoints },
    ],
    profileConfig: { profile: 'SET_BASED', setsToWin: input.setsToWin },
    resultProfile: 'SET_BASED',
  });
}

export class CompetitionRuleSetPersistence {
  public async save(
    transaction: Prisma.TransactionClient,
    input: SaveStoredRuleSetInput,
  ): Promise<CompetitionRuleSetSnapshot> {
    await this.assertEditableCompetition(transaction, input.competitionId);
    const existing = await this.latest(transaction, input.competitionId);
    const occurredAt = new Date();
    try {
      if (existing === null) {
        if (input.expectedRevision !== null) {
          throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule-set revision is stale.');
        }
        const snapshot = createRuleSet(input, crypto.randomUUID(), occurredAt).toSnapshot();
        await transaction.competitionRuleSet.create({
          data: {
            competitionId: snapshot.competitionId,
            createdAt: snapshot.createdAt,
            createdById: snapshot.createdBy,
            id: snapshot.id,
            knockoutResolutionCode: snapshot.knockoutResolutionCode,
            metrics: { create: snapshot.metrics.map((metricCode) => ({ metricCode })) },
            outcomes: { create: snapshot.outcomes.map(({ code, description, tablePoints }) => ({ description, outcomeCode: code, tablePoints })) },
            profileConfig: { ...snapshot.profileConfig },
            resultProfile: snapshot.resultProfile,
            revision: snapshot.revision,
            revisionNumber: snapshot.revisionNumber,
            schemaVersion: snapshot.schemaVersion,
            status: snapshot.status,
            tiebreaks: { create: snapshot.tieBreakCriteria.map((criterionCode, index) => ({ criterionCode, position: index + 1 })) },
            updatedAt: snapshot.updatedAt,
            updatedById: snapshot.updatedBy,
          },
        });
        return snapshot;
      }

      if (input.expectedRevision === null) {
        throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule set already exists.');
      }
      const configured = createRuleSet(input, existing.toSnapshot().id, occurredAt).toSnapshot();
      existing.update({
        actorId: input.actorId,
        expectedRevision: input.expectedRevision,
        knockoutResolutionCode: configured.knockoutResolutionCode,
        metrics: configured.metrics,
        occurredAt,
        outcomes: configured.outcomes,
        profileConfig: configured.profileConfig,
        resultProfile: configured.resultProfile,
        tieBreakCriteria: configured.tieBreakCriteria,
      });
      const snapshot = existing.toSnapshot();
      await transaction.ruleSetOutcome.deleteMany({ where: { ruleSetId: snapshot.id } });
      await transaction.ruleSetMetric.deleteMany({ where: { ruleSetId: snapshot.id } });
      await transaction.ruleSetTiebreak.deleteMany({ where: { ruleSetId: snapshot.id } });
      const updated = await transaction.competitionRuleSet.updateMany({
        data: {
          knockoutResolutionCode: snapshot.knockoutResolutionCode,
          profileConfig: { ...snapshot.profileConfig },
          resultProfile: snapshot.resultProfile,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
          updatedById: snapshot.updatedBy,
        },
        where: { id: snapshot.id, revision: input.expectedRevision, status: 'DRAFT' },
      });
      if (updated.count !== 1) {
        throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule-set revision is stale.');
      }
      await transaction.ruleSetOutcome.createMany({
        data: snapshot.outcomes.map(({ code, description, tablePoints }) => ({ description, outcomeCode: code, ruleSetId: snapshot.id, tablePoints })),
      });
      await transaction.ruleSetMetric.createMany({
        data: snapshot.metrics.map((metricCode) => ({ metricCode, ruleSetId: snapshot.id })),
      });
      await transaction.ruleSetTiebreak.createMany({
        data: snapshot.tieBreakCriteria.map((criterionCode, index) => ({ criterionCode, position: index + 1, ruleSetId: snapshot.id })),
      });
      return snapshot;
    } catch (error: unknown) {
      if (error instanceof DomainError) throw ruleSetStoreError(error);
      throw error;
    }
  }

  public async freeze(
    transaction: Prisma.TransactionClient,
    input: FreezeStoredRuleSetInput,
  ): Promise<CompetitionRuleSetSnapshot> {
    await this.assertEditableCompetition(transaction, input.competitionId);
    const ruleSet = await this.latest(transaction, input.competitionId);
    if (ruleSet === null) {
      throw new CompetitionStoreError('RULE_SET_NOT_FOUND', 'The competition has no rules to freeze.');
    }
    try {
      ruleSet.freeze({ actorId: input.actorId, expectedRevision: input.expectedRevision, occurredAt: new Date() });
    } catch (error: unknown) {
      if (error instanceof DomainError) throw ruleSetStoreError(error);
      throw error;
    }
    const snapshot = ruleSet.toSnapshot();
    const updated = await transaction.competitionRuleSet.updateMany({
      data: {
        canonicalHash: snapshot.canonicalHash,
        frozenAt: snapshot.frozenAt,
        frozenById: snapshot.frozenBy,
        revision: snapshot.revision,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
        updatedById: snapshot.updatedBy,
      },
      where: { id: snapshot.id, revision: input.expectedRevision, status: 'DRAFT' },
    });
    if (updated.count !== 1) {
      throw new CompetitionStoreError('CONCURRENCY_CONFLICT', 'The rule-set revision is stale.');
    }
    return snapshot;
  }

  public async latest(
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
      where: { competitionId },
    });
    if (record === null) return null;
    if (!isJsonObject(record.profileConfig)) {
      throw new CompetitionStoreError('RULE_SET_INVALID', 'Persisted rule profile is invalid.');
    }
    const profileConfig = record.profileConfig;
    const parsedProfile = profileConfig.profile === 'SCORE_BASED' && typeof profileConfig.allowDraws === 'boolean'
      ? { allowDraws: profileConfig.allowDraws, profile: 'SCORE_BASED' as const }
      : profileConfig.profile === 'SET_BASED' && typeof profileConfig.setsToWin === 'number'
        ? { profile: 'SET_BASED' as const, setsToWin: profileConfig.setsToWin }
        : null;
    if (parsedProfile === null) {
      throw new CompetitionStoreError('RULE_SET_INVALID', 'Persisted rule profile is invalid.');
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
        outcomes: record.outcomes.map(({ description, outcomeCode, tablePoints }) => ({ code: outcomeCode, description, tablePoints })),
        profileConfig: parsedProfile,
        resultProfile: record.resultProfile as CompetitionRuleSetSnapshot['resultProfile'],
        revision: record.revision,
        revisionNumber: record.revisionNumber,
        schemaVersion: record.schemaVersion,
        status: record.status as CompetitionRuleSetSnapshot['status'],
        tieBreakCriteria: record.tiebreaks.map(({ criterionCode }) => criterionCode as TieBreakCriterion),
        updatedAt: record.updatedAt,
        updatedBy: record.updatedById,
      });
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        throw new CompetitionStoreError('RULE_SET_INVALID', error.message);
      }
      throw error;
    }
  }

  public view(snapshot: CompetitionRuleSetSnapshot): NonNullable<CompetitionDetail['ruleSet']> {
    const winPoints = snapshot.outcomes.find(({ code }) => code === 'WIN')?.tablePoints;
    const lossPoints = snapshot.outcomes.find(({ code }) => code === 'LOSS')?.tablePoints;
    if (winPoints === undefined || lossPoints === undefined) {
      throw new CompetitionStoreError('RULE_SET_INVALID', 'Base rule outcomes are missing.');
    }
    const evidence = {
      canonicalHash: snapshot.canonicalHash,
      frozenAt: snapshot.frozenAt?.toISOString() ?? null,
      id: snapshot.id,
      revision: snapshot.revision,
      status: snapshot.status,
    };
    if (snapshot.profileConfig.profile === 'SCORE_BASED') {
      return {
        ...evidence,
        allowDraws: snapshot.profileConfig.allowDraws,
        drawPoints: snapshot.outcomes.find(({ code }) => code === 'DRAW')?.tablePoints ?? null,
        lossPoints,
        resultProfile: 'SCORE_BASED',
        tieBreakCriteria: snapshot.tieBreakCriteria as readonly ScoreTieBreakCriterion[],
        winPoints,
      };
    }
    return {
      ...evidence,
      lossPoints,
      resultProfile: 'SET_BASED',
      setsToWin: snapshot.profileConfig.setsToWin,
      tieBreakCriteria: snapshot.tieBreakCriteria as readonly SetTieBreakCriterion[],
      winPoints,
    };
  }

  private async assertEditableCompetition(transaction: Prisma.TransactionClient, id: string): Promise<void> {
    const competition = await transaction.competition.findUnique({ select: { status: true }, where: { id } });
    if (competition === null) {
      throw new CompetitionStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    }
    if (competition.status !== 'DRAFT' && competition.status !== 'OPEN') {
      throw new CompetitionStoreError('COMPETITION_NOT_EDITABLE', 'Rules can only change while the competition is draft or open.');
    }
  }
}
