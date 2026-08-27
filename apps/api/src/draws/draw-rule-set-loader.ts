import type { Prisma } from '@oes/database';
import {
  CompetitionRuleSet,
  DomainError,
  type CompetitionRuleSetSnapshot,
  type MetricCode,
  type TieBreakCriterion,
} from '@oes/domain';

import { DrawStoreError } from './draw-store.js';
import { mappedDomainError } from './draw-store-validation.js';

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class DrawRuleSetLoader {
  public async latestFrozen(
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
}
