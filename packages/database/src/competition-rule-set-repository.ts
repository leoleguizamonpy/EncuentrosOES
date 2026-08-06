import {
  CompetitionRuleSet,
  DomainError,
  type CompetitionRuleSetSnapshot,
  type KnockoutResolutionCode,
  type MetricCode,
  type ResultProfile,
  type RuleSetProfileConfig,
  type RuleSetStatus,
  type TieBreakCriterion,
} from '@oes/domain';

import type { Prisma, PrismaClient } from './generated/prisma/client.js';

const resultProfiles = new Set<ResultProfile>(['SCORE_BASED', 'SET_BASED']);
const statuses = new Set<RuleSetStatus>(['DRAFT', 'FROZEN', 'REPLACED']);
const knockoutCodes = new Set<KnockoutResolutionCode>(['HIGHER_SCORE', 'MOST_SETS_WON']);
const metricCodes = new Set<MetricCode>([
  'PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'TABLE_POINTS',
  'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE',
  'SETS_WON', 'SETS_LOST', 'SET_DIFFERENCE',
  'SPORT_POINTS_FOR', 'SPORT_POINTS_AGAINST', 'SPORT_POINT_DIFFERENCE',
]);
const tieBreakCodes = new Set<TieBreakCriterion>([
  'TABLE_POINTS', 'WINS', 'HEAD_TO_HEAD_TABLE_POINTS', 'SCORE_DIFFERENCE',
  'SCORE_FOR', 'SET_DIFFERENCE', 'SETS_WON', 'SPORT_POINT_DIFFERENCE',
  'SPORT_POINTS_FOR',
]);

function parseCode<T extends string>(value: string, allowed: ReadonlySet<T>, field: string): T {
  if (allowed.has(value as T)) return value as T;
  throw new DomainError('RULE_SET_INTEGRITY_FAILURE', `Unknown persisted ${field}: ${value}.`);
}

function parseProfileConfig(value: Prisma.JsonValue): RuleSetProfileConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('RULE_SET_INTEGRITY_FAILURE', 'Profile config must be an object.');
  }
  if (value.profile === 'SCORE_BASED' && typeof value.allowDraws === 'boolean') {
    return { allowDraws: value.allowDraws, profile: 'SCORE_BASED' };
  }
  if (value.profile === 'SET_BASED' && typeof value.setsToWin === 'number') {
    return { profile: 'SET_BASED', setsToWin: value.setsToWin };
  }
  throw new DomainError('RULE_SET_INTEGRITY_FAILURE', 'Profile config is invalid.');
}

function jsonProfileConfig(config: RuleSetProfileConfig): Prisma.InputJsonValue {
  return { ...config };
}

export class PrismaCompetitionRuleSetRepository {
  readonly #client: PrismaClient;

  public constructor(client: PrismaClient) {
    this.#client = client;
  }

  public async insert(ruleSet: CompetitionRuleSet): Promise<void> {
    const snapshot = ruleSet.toSnapshot();
    await this.#client.competitionRuleSet.create({
      data: {
        canonicalHash: snapshot.canonicalHash,
        competitionId: snapshot.competitionId,
        createdAt: snapshot.createdAt,
        createdById: snapshot.createdBy,
        frozenAt: snapshot.frozenAt,
        frozenById: snapshot.frozenBy,
        id: snapshot.id,
        knockoutResolutionCode: snapshot.knockoutResolutionCode,
        metrics: { create: snapshot.metrics.map((metricCode) => ({ metricCode })) },
        outcomes: {
          create: snapshot.outcomes.map((outcome) => ({
            description: outcome.description,
            outcomeCode: outcome.code,
            tablePoints: outcome.tablePoints,
          })),
        },
        profileConfig: jsonProfileConfig(snapshot.profileConfig),
        resultProfile: snapshot.resultProfile,
        revision: snapshot.revision,
        revisionNumber: snapshot.revisionNumber,
        schemaVersion: snapshot.schemaVersion,
        status: snapshot.status,
        tiebreaks: {
          create: snapshot.tieBreakCriteria.map((criterionCode, index) => ({
            criterionCode,
            position: index + 1,
          })),
        },
        updatedAt: snapshot.updatedAt,
        updatedById: snapshot.updatedBy,
      },
    });
  }

  public async findById(id: string): Promise<CompetitionRuleSet | null> {
    const record = await this.#client.competitionRuleSet.findUnique({
      include: {
        metrics: { orderBy: { metricCode: 'asc' } },
        outcomes: { orderBy: { outcomeCode: 'asc' } },
        tiebreaks: { orderBy: { position: 'asc' } },
      },
      where: { id },
    });
    if (record === null) return null;

    const snapshot: CompetitionRuleSetSnapshot = {
      canonicalHash: record.canonicalHash,
      competitionId: record.competitionId,
      createdAt: record.createdAt,
      createdBy: record.createdById,
      frozenAt: record.frozenAt,
      frozenBy: record.frozenById,
      id: record.id,
      knockoutResolutionCode: parseCode(record.knockoutResolutionCode, knockoutCodes, 'knockout resolution code'),
      metrics: record.metrics.map(({ metricCode }) => parseCode(metricCode, metricCodes, 'metric code')),
      outcomes: record.outcomes.map(({ description, outcomeCode, tablePoints }) => ({
        code: outcomeCode,
        description,
        tablePoints,
      })),
      profileConfig: parseProfileConfig(record.profileConfig),
      resultProfile: parseCode(record.resultProfile, resultProfiles, 'result profile'),
      revision: record.revision,
      revisionNumber: record.revisionNumber,
      schemaVersion: record.schemaVersion,
      status: parseCode(record.status, statuses, 'rule set status'),
      tieBreakCriteria: record.tiebreaks.map(({ criterionCode }) => parseCode(criterionCode, tieBreakCodes, 'tiebreak criterion')),
      updatedAt: record.updatedAt,
      updatedBy: record.updatedById,
    };
    return CompetitionRuleSet.rehydrate(snapshot);
  }

  public async save(ruleSet: CompetitionRuleSet, expectedRevision: number): Promise<void> {
    const snapshot = ruleSet.toSnapshot();
    await this.#client.$transaction(async (transaction) => {
      const current = await transaction.competitionRuleSet.findFirst({
        select: { id: true },
        where: { id: snapshot.id, revision: expectedRevision },
      });
      if (current === null) {
        throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted rule set revision no longer matches.');
      }

      await transaction.ruleSetOutcome.deleteMany({ where: { ruleSetId: snapshot.id } });
      await transaction.ruleSetMetric.deleteMany({ where: { ruleSetId: snapshot.id } });
      await transaction.ruleSetTiebreak.deleteMany({ where: { ruleSetId: snapshot.id } });
      await transaction.ruleSetOutcome.createMany({
        data: snapshot.outcomes.map((outcome) => ({
          description: outcome.description,
          outcomeCode: outcome.code,
          ruleSetId: snapshot.id,
          tablePoints: outcome.tablePoints,
        })),
      });
      await transaction.ruleSetMetric.createMany({
        data: snapshot.metrics.map((metricCode) => ({ metricCode, ruleSetId: snapshot.id })),
      });
      await transaction.ruleSetTiebreak.createMany({
        data: snapshot.tieBreakCriteria.map((criterionCode, index) => ({
          criterionCode,
          position: index + 1,
          ruleSetId: snapshot.id,
        })),
      });

      const update = await transaction.competitionRuleSet.updateMany({
        data: {
          canonicalHash: snapshot.canonicalHash,
          frozenAt: snapshot.frozenAt,
          frozenById: snapshot.frozenBy,
          knockoutResolutionCode: snapshot.knockoutResolutionCode,
          profileConfig: jsonProfileConfig(snapshot.profileConfig),
          resultProfile: snapshot.resultProfile,
          revision: snapshot.revision,
          status: snapshot.status,
          updatedAt: snapshot.updatedAt,
          updatedById: snapshot.updatedBy,
        },
        where: { id: snapshot.id, revision: expectedRevision },
      });
      if (update.count !== 1) {
        throw new DomainError('CONCURRENCY_CONFLICT', 'The persisted rule set revision no longer matches.');
      }
    });
  }
}
