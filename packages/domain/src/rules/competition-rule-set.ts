import { createHash } from 'node:crypto';

import { DomainError } from '../errors/domain-error.js';

export type ResultProfile = 'SCORE_BASED' | 'SET_BASED';
export type RuleSetStatus = 'DRAFT' | 'FROZEN' | 'REPLACED';
export type KnockoutResolutionCode = 'HIGHER_SCORE' | 'MOST_SETS_WON';
export type TieBreakCriterion =
  | 'HEAD_TO_HEAD_TABLE_POINTS'
  | 'SCORE_DIFFERENCE'
  | 'SCORE_FOR'
  | 'SETS_WON'
  | 'SET_DIFFERENCE'
  | 'SPORT_POINTS_FOR'
  | 'SPORT_POINT_DIFFERENCE'
  | 'TABLE_POINTS'
  | 'WINS';
export type MetricCode =
  | 'DRAWS'
  | 'LOSSES'
  | 'PLAYED'
  | 'SCORE_AGAINST'
  | 'SCORE_DIFFERENCE'
  | 'SCORE_FOR'
  | 'SETS_LOST'
  | 'SETS_WON'
  | 'SET_DIFFERENCE'
  | 'SPORT_POINTS_AGAINST'
  | 'SPORT_POINTS_FOR'
  | 'SPORT_POINT_DIFFERENCE'
  | 'TABLE_POINTS'
  | 'WINS';

export type RuleSetProfileConfig =
  | Readonly<{ allowDraws: boolean; profile: 'SCORE_BASED' }>
  | Readonly<{ profile: 'SET_BASED'; setsToWin: number }>;

export interface OutcomePoint {
  readonly code: string;
  readonly description: string;
  readonly tablePoints: number;
}

export interface CompetitionRuleSetSnapshot {
  readonly canonicalHash: string | null;
  readonly competitionId: string;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly frozenAt: Date | null;
  readonly frozenBy: string | null;
  readonly id: string;
  readonly knockoutResolutionCode: KnockoutResolutionCode;
  readonly metrics: readonly MetricCode[];
  readonly outcomes: readonly OutcomePoint[];
  readonly profileConfig: RuleSetProfileConfig;
  readonly resultProfile: ResultProfile;
  readonly revision: number;
  readonly revisionNumber: number;
  readonly schemaVersion: number;
  readonly status: RuleSetStatus;
  readonly tieBreakCriteria: readonly TieBreakCriterion[];
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

interface RuleSetConfiguration {
  readonly knockoutResolutionCode: KnockoutResolutionCode;
  readonly metrics: readonly MetricCode[];
  readonly outcomes: readonly OutcomePoint[];
  readonly profileConfig: RuleSetProfileConfig;
  readonly resultProfile: ResultProfile;
  readonly tieBreakCriteria: readonly TieBreakCriterion[];
}

export interface CreateCompetitionRuleSetInput extends RuleSetConfiguration {
  readonly actorId: string;
  readonly competitionId: string;
  readonly id: string;
  readonly occurredAt: Date;
  readonly revisionNumber: number;
  readonly schemaVersion: number;
}

export interface UpdateCompetitionRuleSetInput extends RuleSetConfiguration {
  readonly actorId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

export interface FreezeCompetitionRuleSetInput {
  readonly actorId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
}

const scoreCriteria = new Set<TieBreakCriterion>([
  'TABLE_POINTS',
  'WINS',
  'HEAD_TO_HEAD_TABLE_POINTS',
  'SCORE_DIFFERENCE',
  'SCORE_FOR',
]);
const setCriteria = new Set<TieBreakCriterion>([
  'TABLE_POINTS',
  'WINS',
  'HEAD_TO_HEAD_TABLE_POINTS',
  'SET_DIFFERENCE',
  'SETS_WON',
  'SPORT_POINT_DIFFERENCE',
  'SPORT_POINTS_FOR',
]);
const criterionMetric = new Map<TieBreakCriterion, MetricCode>([
  ['TABLE_POINTS', 'TABLE_POINTS'],
  ['WINS', 'WINS'],
  ['HEAD_TO_HEAD_TABLE_POINTS', 'TABLE_POINTS'],
  ['SCORE_DIFFERENCE', 'SCORE_DIFFERENCE'],
  ['SCORE_FOR', 'SCORE_FOR'],
  ['SET_DIFFERENCE', 'SET_DIFFERENCE'],
  ['SETS_WON', 'SETS_WON'],
  ['SPORT_POINT_DIFFERENCE', 'SPORT_POINT_DIFFERENCE'],
  ['SPORT_POINTS_FOR', 'SPORT_POINTS_FOR'],
]);
const outcomePattern = /^(?:WIN|DRAW|LOSS|WIN_VARIANT_[A-Z0-9_]+|LOSS_VARIANT_[A-Z0-9_]+)$/;

function cloneConfiguration(configuration: RuleSetConfiguration): RuleSetConfiguration {
  return {
    knockoutResolutionCode: configuration.knockoutResolutionCode,
    metrics: Object.freeze([...configuration.metrics]),
    outcomes: Object.freeze(
      configuration.outcomes.map((outcome) => Object.freeze({ ...outcome })),
    ),
    profileConfig: Object.freeze({ ...configuration.profileConfig }),
    resultProfile: configuration.resultProfile,
    tieBreakCriteria: Object.freeze([...configuration.tieBreakCriteria]),
  };
}

function validatePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError('RULE_SET_INCOMPLETE', `${field} must be a positive integer.`);
  }
}

function validateConfiguration(configuration: RuleSetConfiguration): void {
  if (configuration.profileConfig.profile !== configuration.resultProfile) {
    throw new DomainError(
      'RULE_SET_INCOMPATIBLE',
      'The profile configuration does not match the result profile.',
    );
  }

  if (
    configuration.resultProfile === 'SCORE_BASED' &&
    configuration.knockoutResolutionCode !== 'HIGHER_SCORE'
  ) {
    throw new DomainError('RULE_SET_INCOMPATIBLE', 'Score results require HIGHER_SCORE.');
  }

  if (configuration.profileConfig.profile === 'SET_BASED') {
    if (configuration.knockoutResolutionCode !== 'MOST_SETS_WON') {
      throw new DomainError(
        'RULE_SET_INCOMPATIBLE',
        'Set results require MOST_SETS_WON.',
      );
    }
    validatePositiveInteger(configuration.profileConfig.setsToWin, 'setsToWin');
  }

  if (configuration.outcomes.length < 2) {
    throw new DomainError('RULE_SET_INCOMPLETE', 'At least win and loss outcomes are required.');
  }

  const outcomeCodes = new Set<string>();
  let hasWin = false;
  let hasLoss = false;
  for (const outcome of configuration.outcomes) {
    if (!outcomePattern.test(outcome.code) || outcomeCodes.has(outcome.code)) {
      throw new DomainError('RULE_SET_INCOMPATIBLE', 'Outcome codes must be valid and unique.');
    }
    if (!Number.isSafeInteger(outcome.tablePoints)) {
      throw new DomainError('RULE_SET_INCOMPATIBLE', 'Table points must be safe integers.');
    }
    if (outcome.description.trim().length === 0 || outcome.description.length > 160) {
      throw new DomainError('RULE_SET_INCOMPATIBLE', 'Outcome descriptions are required.');
    }
    outcomeCodes.add(outcome.code);
    hasWin ||= outcome.code === 'WIN' || outcome.code.startsWith('WIN_VARIANT_');
    hasLoss ||= outcome.code === 'LOSS' || outcome.code.startsWith('LOSS_VARIANT_');
  }

  if (!hasWin || !hasLoss) {
    throw new DomainError('RULE_SET_INCOMPLETE', 'Win and loss outcomes are required.');
  }

  const allowsDraw =
    configuration.profileConfig.profile === 'SCORE_BASED' &&
    configuration.profileConfig.allowDraws;
  if (allowsDraw !== outcomeCodes.has('DRAW')) {
    throw new DomainError(
      'RULE_SET_INCOMPATIBLE',
      'DRAW must exist exactly when score draws are enabled.',
    );
  }

  if (configuration.tieBreakCriteria[0] !== 'TABLE_POINTS') {
    throw new DomainError('RULE_SET_INCOMPLETE', 'TABLE_POINTS must be the first tiebreak.');
  }

  const allowedCriteria =
    configuration.resultProfile === 'SCORE_BASED' ? scoreCriteria : setCriteria;
  const criteria = new Set<TieBreakCriterion>();
  const metrics = new Set(configuration.metrics);

  if (metrics.size !== configuration.metrics.length) {
    throw new DomainError('RULE_SET_INCOMPATIBLE', 'Metrics must be unique.');
  }

  for (const criterion of configuration.tieBreakCriteria) {
    if (!allowedCriteria.has(criterion)) {
      throw new DomainError(
        'TIE_BREAK_CRITERION_UNSUPPORTED',
        `${criterion} is incompatible with ${configuration.resultProfile}.`,
      );
    }
    if (criteria.has(criterion)) {
      throw new DomainError('RULE_SET_INCOMPATIBLE', 'Tiebreak criteria must be unique.');
    }
    const requiredMetric = criterionMetric.get(criterion);
    if (requiredMetric !== undefined && !metrics.has(requiredMetric)) {
      throw new DomainError(
        'RULE_SET_INCOMPLETE',
        `${requiredMetric} must be enabled for ${criterion}.`,
      );
    }
    criteria.add(criterion);
  }
}

function canonicalHash(snapshot: CompetitionRuleSetSnapshot): string {
  const canonical = JSON.stringify({
    competitionId: snapshot.competitionId,
    knockoutResolutionCode: snapshot.knockoutResolutionCode,
    metrics: [...snapshot.metrics].sort(),
    outcomes: [...snapshot.outcomes]
      .map(({ code, description, tablePoints }) => ({ code, description, tablePoints }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    profileConfig: snapshot.profileConfig,
    resultProfile: snapshot.resultProfile,
    revisionNumber: snapshot.revisionNumber,
    schemaVersion: snapshot.schemaVersion,
    tieBreakCriteria: snapshot.tieBreakCriteria,
  });

  return createHash('sha256').update(canonical).digest('hex');
}

export class CompetitionRuleSet {
  #snapshot: CompetitionRuleSetSnapshot;

  private constructor(snapshot: CompetitionRuleSetSnapshot) {
    const configuration = cloneConfiguration(snapshot);
    this.#snapshot = {
      ...snapshot,
      ...configuration,
      createdAt: new Date(snapshot.createdAt),
      frozenAt: snapshot.frozenAt === null ? null : new Date(snapshot.frozenAt),
      updatedAt: new Date(snapshot.updatedAt),
    };
  }

  public static create(input: CreateCompetitionRuleSetInput): CompetitionRuleSet {
    validatePositiveInteger(input.schemaVersion, 'schemaVersion');
    validatePositiveInteger(input.revisionNumber, 'revisionNumber');
    validateConfiguration(input);
    return new CompetitionRuleSet({
      ...cloneConfiguration(input),
      canonicalHash: null,
      competitionId: input.competitionId,
      createdAt: input.occurredAt,
      createdBy: input.actorId,
      frozenAt: null,
      frozenBy: null,
      id: input.id,
      revision: 1,
      revisionNumber: input.revisionNumber,
      schemaVersion: input.schemaVersion,
      status: 'DRAFT',
      updatedAt: input.occurredAt,
      updatedBy: input.actorId,
    });
  }

  public static rehydrate(snapshot: CompetitionRuleSetSnapshot): CompetitionRuleSet {
    validatePositiveInteger(snapshot.schemaVersion, 'schemaVersion');
    validatePositiveInteger(snapshot.revisionNumber, 'revisionNumber');
    validatePositiveInteger(snapshot.revision, 'revision');
    validateConfiguration(snapshot);
    const frozen = snapshot.status !== 'DRAFT';
    const hasAnyFreezeEvidence =
      snapshot.canonicalHash !== null || snapshot.frozenAt !== null || snapshot.frozenBy !== null;
    const hasAllFreezeEvidence =
      snapshot.canonicalHash !== null && snapshot.frozenAt !== null && snapshot.frozenBy !== null;
    if ((!frozen && hasAnyFreezeEvidence) || (frozen && !hasAllFreezeEvidence)) {
      throw new DomainError('RULE_SET_INTEGRITY_FAILURE', 'Freeze evidence is inconsistent.');
    }
    if (frozen && canonicalHash(snapshot) !== snapshot.canonicalHash) {
      throw new DomainError('RULE_SET_INTEGRITY_FAILURE', 'The canonical hash is invalid.');
    }
    return new CompetitionRuleSet(snapshot);
  }

  public update(input: UpdateCompetitionRuleSetInput): void {
    this.#assertRevision(input.expectedRevision);
    if (this.#snapshot.status !== 'DRAFT') {
      throw new DomainError('RULE_SET_FROZEN', 'A frozen rule set cannot be edited.');
    }
    validateConfiguration(input);
    this.#snapshot = {
      ...this.#snapshot,
      ...cloneConfiguration(input),
      revision: this.#snapshot.revision + 1,
      updatedAt: new Date(input.occurredAt),
      updatedBy: input.actorId,
    };
  }

  public freeze(input: FreezeCompetitionRuleSetInput): void {
    this.#assertRevision(input.expectedRevision);
    if (this.#snapshot.status !== 'DRAFT') {
      throw new DomainError('RULE_SET_FROZEN', 'Only a draft rule set can be frozen.');
    }
    const frozen = {
      ...this.#snapshot,
      frozenAt: new Date(input.occurredAt),
      frozenBy: input.actorId,
      revision: this.#snapshot.revision + 1,
      status: 'FROZEN' as const,
      updatedAt: new Date(input.occurredAt),
      updatedBy: input.actorId,
    };
    this.#snapshot = { ...frozen, canonicalHash: canonicalHash(frozen) };
  }

  public toSnapshot(): CompetitionRuleSetSnapshot {
    return Object.freeze({
      ...this.#snapshot,
      metrics: Object.freeze([...this.#snapshot.metrics]),
      outcomes: Object.freeze(
        this.#snapshot.outcomes.map((outcome) => Object.freeze({ ...outcome })),
      ),
      profileConfig: Object.freeze({ ...this.#snapshot.profileConfig }),
      tieBreakCriteria: Object.freeze([...this.#snapshot.tieBreakCriteria]),
      createdAt: new Date(this.#snapshot.createdAt),
      frozenAt:
        this.#snapshot.frozenAt === null ? null : new Date(this.#snapshot.frozenAt),
      updatedAt: new Date(this.#snapshot.updatedAt),
    });
  }

  #assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.#snapshot.revision) {
      throw new DomainError(
        'CONCURRENCY_CONFLICT',
        'The rule set was modified by another operation.',
      );
    }
  }
}
