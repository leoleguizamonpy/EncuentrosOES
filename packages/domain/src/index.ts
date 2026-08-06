export {
  MAX_GROUP_SIZE,
  MIN_GROUP_SIZE,
  groupLabel,
  planGroupDistribution,
  type GroupPlan,
  type GroupPlanEntry,
  type GroupSize,
} from './competition/group-distribution.js';
export {
  Competition,
  type AddParticipantInput,
  type CompetitionKey,
  type CompetitionSnapshot,
  type CompetitionStatus,
  type CreateCompetitionInput,
  type OpenCompetitionInput,
  type ParticipantSnapshot,
  type ParticipantStatus,
} from './competition/competition.js';
export {
  DomainError,
  type DomainErrorCode,
} from './errors/domain-error.js';
