import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@oes/database';
import {
  deriveGeneralChampion,
  deriveGeneralStandings,
  pointsForGeneralPlacement,
  validateGeneralScoringRules,
  type GeneralScoringRule,
  type GeneralStandingContribution,
} from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import type { ActorRole } from '../security/request.js';
import { GeneralChampionshipError } from './general-championship.error.js';
import { projectGeneralChampionship } from './general-championship-projection.js';

export { GeneralChampionshipError } from './general-championship.error.js';

const DEFAULT_RULES: readonly GeneralScoringRule[] = [
  { label: 'Campeón', placement: 1, points: 100 },
  { label: 'Subcampeón', placement: 2, points: 70 },
  { label: 'Tercer lugar', placement: 3, points: 50 },
  { label: 'Cuarto lugar', placement: 4, points: 25 },
];

interface MutationContext {
  readonly actorId: string;
  readonly actorRole: ActorRole;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

interface ChampionshipMutation extends MutationContext {
  readonly championshipId: string;
  readonly expectedRevision: number;
}

export interface GeneralChampionshipView {
  readonly champion: Readonly<{ institutionId: string; institutionName: string; points: number }> | null;
  readonly contributions: readonly Readonly<{
    automatic: boolean;
    confirmedAt: string | null;
    confirmedBy: Readonly<{ id: string; name: string }> | null;
    description: string;
    id: string;
    institution: Readonly<{ id: string; name: string }>;
    points: number;
    recordedAt: string;
    recordedBy: Readonly<{ id: string; name: string }> | null;
    revision: number;
    source: Readonly<{ competitionId: string; label: string; placement: number }> | null;
    sourceType: 'COMPETITION_PLACEMENT' | 'SPECIAL';
    status: 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
    title: string;
  }>[];
  readonly edition: Readonly<{ id: string; name: string; year: number }>;
  readonly event: Readonly<{ id: string; name: string }>;
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly rules: readonly GeneralScoringRule[];
  readonly standings: readonly Readonly<{
    contributionCount: number;
    institution: Readonly<{ id: string; name: string }>;
    placementContributionCount: number;
    position: number;
    specialContributionCount: number;
    tied: boolean;
    totalPoints: number;
  }>[];
  readonly status: 'ACTIVE' | 'DRAFT' | 'FINALIZED';
}

export interface GeneralChampionshipCatalog {
  readonly editions: readonly Readonly<{ id: string; name: string; year: number }>[];
  readonly events: readonly Readonly<{ id: string; name: string }>[];
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertAdmin(role: ActorRole): asserts role is 'ADMIN' | 'SUPERADMIN' {
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') throw new GeneralChampionshipError('INVALID', 'An administrator authority is required.');
}

function jsonReplay(value: unknown): GeneralChampionshipView {
  if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string') {
    throw new GeneralChampionshipError('IDEMPOTENCY_CONFLICT', 'Stored general championship response is invalid.');
  }
  return value as GeneralChampionshipView;
}

@Injectable()
export class GeneralChampionshipService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  public async catalog(): Promise<GeneralChampionshipCatalog> {
    const editions = await this.prisma.edition.findMany({ orderBy: { year: 'desc' }, select: { id: true, name: true, year: true } });
    const events = await this.prisma.event.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true }, where: { active: true } });
    return { editions, events };
  }

  public async findByScope(editionId: string, eventId: string): Promise<GeneralChampionshipView | null> {
    const championship = await this.prisma.generalChampionship.findUnique({ where: { editionId_eventId: { editionId, eventId } } });
    return championship === null ? null : projectGeneralChampionship(this.prisma, championship.id);
  }

  public find(championshipId: string): Promise<GeneralChampionshipView> {
    return projectGeneralChampionship(this.prisma, championshipId);
  }

  public create(input: MutationContext & Readonly<{ editionId: string; eventId: string; name: string; rules?: readonly GeneralScoringRule[] }>): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    const rules = validateGeneralScoringRules(input.rules ?? DEFAULT_RULES);
    const name = input.name.trim();
    if (name.length < 3 || name.length > 160) throw new GeneralChampionshipError('INVALID', 'General championship name must contain between 3 and 160 characters.');
    return this.mutate(input, 'general-championship:create', { editionId: input.editionId, eventId: input.eventId, name, rules }, async (tx) => {
      const edition = await tx.edition.findUnique({ where: { id: input.editionId } });
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      if (edition === null || !event?.active) throw new GeneralChampionshipError('INVALID', 'Edition or event is invalid.');
      const id = randomUUID();
      await tx.generalChampionship.create({ data: {
        createdById: input.actorId,
        editionId: input.editionId,
        eventId: input.eventId,
        id,
        name,
        status: 'DRAFT',
        updatedById: input.actorId,
      } });
      await tx.generalChampionshipScoringRule.createMany({ data: rules.map((rule) => ({ championshipId: id, ...rule })) });
      await this.audit(tx, input, 'GENERAL_CHAMPIONSHIP_CREATED', 'GENERAL_CHAMPIONSHIP', id, null, 1, { editionId: input.editionId, eventId: input.eventId });
      return id;
    });
  }

  public saveScoring(input: ChampionshipMutation & Readonly<{ rules: readonly GeneralScoringRule[] }>): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    const rules = validateGeneralScoringRules(input.rules);
    return this.mutate(input, 'general-championship:scoring', { championshipId: input.championshipId, expectedRevision: input.expectedRevision, rules }, async (tx) => {
      const championship = await this.mutableChampionship(tx, input.championshipId, input.expectedRevision, 'DRAFT');
      await tx.generalChampionshipScoringRule.deleteMany({ where: { championshipId: input.championshipId } });
      await tx.generalChampionshipScoringRule.createMany({ data: rules.map((rule) => ({ championshipId: input.championshipId, ...rule })) });
      await this.bump(tx, input.championshipId, input.actorId, input.expectedRevision);
      await this.audit(tx, input, 'GENERAL_SCORING_UPDATED', 'GENERAL_CHAMPIONSHIP', input.championshipId, championship.revision, championship.revision + 1, { rules });
      return input.championshipId;
    });
  }

  public activate(input: ChampionshipMutation): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    return this.mutate(input, 'general-championship:activate', { championshipId: input.championshipId, expectedRevision: input.expectedRevision }, async (tx) => {
      const championship = await this.mutableChampionship(tx, input.championshipId, input.expectedRevision, 'DRAFT');
      const rules = await tx.generalChampionshipScoringRule.findMany({ orderBy: { placement: 'asc' }, where: { championshipId: input.championshipId } });
      validateGeneralScoringRules(rules);
      const updated = await tx.generalChampionship.updateMany({
        data: { revision: { increment: 1 }, status: 'ACTIVE', updatedById: input.actorId },
        where: { id: input.championshipId, revision: input.expectedRevision, status: 'DRAFT' },
      });
      if (updated.count !== 1) throw new GeneralChampionshipError('CONCURRENCY_CONFLICT', 'General championship changed before activation.');
      await this.audit(tx, input, 'GENERAL_SCORING_FROZEN', 'GENERAL_CHAMPIONSHIP', input.championshipId, championship.revision, championship.revision + 1, { ruleCount: rules.length });
      return input.championshipId;
    });
  }

  public addSpecial(input: ChampionshipMutation & Readonly<{ description: string; institutionId: string; points: number; title: string }>): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 2 || title.length > 120 || description.length < 5 || description.length > 500) throw new GeneralChampionshipError('INVALID', 'Special contribution title or description is invalid.');
    if (!Number.isInteger(input.points) || input.points <= 0) throw new GeneralChampionshipError('INVALID', 'Special contribution points must be a positive integer.');
    return this.mutate(input, 'general-championship:special', { championshipId: input.championshipId, description, expectedRevision: input.expectedRevision, institutionId: input.institutionId, points: input.points, title }, async (tx) => {
      const championship = await this.mutableChampionship(tx, input.championshipId, input.expectedRevision, 'ACTIVE');
      await this.assertInstitutionScope(tx, input.institutionId, championship.eventId);
      const contributionId = randomUUID();
      await tx.generalChampionshipContribution.create({ data: {
        championshipId: input.championshipId,
        description,
        id: contributionId,
        institutionId: input.institutionId,
        points: input.points,
        recordedById: input.actorId,
        sourceType: 'SPECIAL',
        status: 'PENDING_CONFIRMATION',
        title,
      } });
      await this.bump(tx, input.championshipId, input.actorId, input.expectedRevision);
      await this.audit(tx, input, 'GENERAL_SPECIAL_RECORDED', 'GENERAL_CHAMPIONSHIP_CONTRIBUTION', contributionId, null, 1, { championshipId: input.championshipId, institutionId: input.institutionId, points: input.points, title });
      return input.championshipId;
    });
  }

  public addPlacement(input: ChampionshipMutation & Readonly<{ competitionId: string; description: string; institutionId: string; placement: number }>): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    const description = input.description.trim();
    if (description.length < 5 || description.length > 500) throw new GeneralChampionshipError('INVALID', 'Placement description must contain between 5 and 500 characters.');
    return this.mutate(input, 'general-championship:placement', { championshipId: input.championshipId, competitionId: input.competitionId, description, expectedRevision: input.expectedRevision, institutionId: input.institutionId, placement: input.placement }, async (tx) => {
      const championship = await this.mutableChampionship(tx, input.championshipId, input.expectedRevision, 'ACTIVE');
      const competition = await this.assertCompetitionScope(tx, input.competitionId, championship.editionId, championship.eventId);
      const participant = await tx.competitionParticipant.findUnique({ where: { competitionId_institutionId: { competitionId: input.competitionId, institutionId: input.institutionId } } });
      if (participant === null) throw new GeneralChampionshipError('INVALID', 'Institution did not participate in the selected competition.');
      const rules = await tx.generalChampionshipScoringRule.findMany({ where: { championshipId: input.championshipId } });
      const points = pointsForGeneralPlacement(rules, input.placement);
      const sport = await tx.sport.findUnique({ where: { id: competition.sportId } });
      const modality = await tx.modality.findUnique({ where: { id: competition.modalityId } });
      if (sport === null || modality === null) throw new GeneralChampionshipError('INVALID', 'Competition catalog context is invalid.');
      const rule = rules.find((candidate) => candidate.placement === input.placement);
      const contributionId = randomUUID();
      await tx.generalChampionshipContribution.create({ data: {
        championshipId: input.championshipId,
        description,
        id: contributionId,
        institutionId: input.institutionId,
        points,
        recordedById: input.actorId,
        sourceCompetitionId: input.competitionId,
        sourcePlacement: input.placement,
        sourceType: 'COMPETITION_PLACEMENT',
        status: 'PENDING_CONFIRMATION',
        title: `${sport.name} · ${modality.name} — ${rule?.label ?? `Puesto ${String(input.placement)}`}`,
      } });
      await this.bump(tx, input.championshipId, input.actorId, input.expectedRevision);
      await this.audit(tx, input, 'GENERAL_PLACEMENT_RECORDED', 'GENERAL_CHAMPIONSHIP_CONTRIBUTION', contributionId, null, 1, { competitionId: input.competitionId, institutionId: input.institutionId, placement: input.placement, points });
      return input.championshipId;
    });
  }

  public confirmContribution(input: MutationContext & Readonly<{ contributionId: string; expectedRevision: number }>): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    return this.mutate(input, 'general-championship:confirm-contribution', { contributionId: input.contributionId, expectedRevision: input.expectedRevision }, async (tx) => {
      const contribution = await tx.generalChampionshipContribution.findUnique({ where: { id: input.contributionId } });
      if (contribution === null || contribution.status !== 'PENDING_CONFIRMATION') throw new GeneralChampionshipError('INVALID', 'Contribution is not pending confirmation.');
      const championship = await tx.generalChampionship.findUnique({ where: { id: contribution.championshipId } });
      if (championship === null || championship.status !== 'ACTIVE') throw new GeneralChampionshipError('INVALID', 'General championship is not active.');
      if (contribution.revision !== input.expectedRevision) throw new GeneralChampionshipError('CONCURRENCY_CONFLICT', 'Contribution changed before confirmation.');
      if (input.actorRole === 'ADMIN' && contribution.recordedById === input.actorId) throw new GeneralChampionshipError('INVALID', 'Another authority must confirm this contribution.');
      const changed = await tx.generalChampionshipContribution.updateMany({ data: { confirmedAt: new Date(), confirmedById: input.actorId, revision: { increment: 1 }, status: 'CONFIRMED' }, where: { id: contribution.id, revision: input.expectedRevision, status: 'PENDING_CONFIRMATION' } });
      if (changed.count !== 1) throw new GeneralChampionshipError('CONCURRENCY_CONFLICT', 'Contribution changed before confirmation.');
      await tx.generalChampionship.update({ data: { revision: { increment: 1 }, updatedById: input.actorId }, where: { id: contribution.championshipId } });
      await this.audit(tx, input, 'GENERAL_CONTRIBUTION_CONFIRMED', 'GENERAL_CHAMPIONSHIP_CONTRIBUTION', contribution.id, contribution.revision, contribution.revision + 1, { championshipId: contribution.championshipId });
      return contribution.championshipId;
    });
  }

  public annulContribution(input: MutationContext & Readonly<{ contributionId: string; expectedRevision: number; reason: string }>): Promise<GeneralChampionshipView> {
    if (input.actorRole !== 'SUPERADMIN') throw new GeneralChampionshipError('INVALID', 'Only SUPERADMIN can annul a general championship contribution.');
    const reason = input.reason.trim();
    if (reason.length < 10 || reason.length > 500) throw new GeneralChampionshipError('INVALID', 'Annulment reason must contain between 10 and 500 characters.');
    return this.mutate(input, 'general-championship:annul-contribution', { contributionId: input.contributionId, expectedRevision: input.expectedRevision, reason }, async (tx) => {
      const contribution = await tx.generalChampionshipContribution.findUnique({ where: { id: input.contributionId } });
      if (contribution === null || contribution.status !== 'CONFIRMED' || contribution.revision !== input.expectedRevision) throw new GeneralChampionshipError('INVALID', 'Only a current confirmed contribution can be annulled.');
      const championship = await tx.generalChampionship.findUnique({ where: { id: contribution.championshipId } });
      if (championship === null || championship.status !== 'ACTIVE') throw new GeneralChampionshipError('INVALID', 'Finalized championships are immutable.');
      await tx.generalChampionshipContribution.update({ data: { annulledAt: new Date(), annulledById: input.actorId, annulmentReason: reason, revision: { increment: 1 }, status: 'ANNULLED' }, where: { id: contribution.id } });
      await tx.generalChampionship.update({ data: { revision: { increment: 1 }, updatedById: input.actorId }, where: { id: contribution.championshipId } });
      await this.audit(tx, input, 'GENERAL_CONTRIBUTION_ANNULLED', 'GENERAL_CHAMPIONSHIP_CONTRIBUTION', contribution.id, contribution.revision, contribution.revision + 1, { championshipId: contribution.championshipId }, reason);
      return contribution.championshipId;
    });
  }

  public syncFinalizedCompetitions(input: ChampionshipMutation): Promise<GeneralChampionshipView> {
    assertAdmin(input.actorRole);
    return this.mutate(input, 'general-championship:sync', { championshipId: input.championshipId, expectedRevision: input.expectedRevision }, async (tx) => {
      const championship = await this.mutableChampionship(tx, input.championshipId, input.expectedRevision, 'ACTIVE');
      const rules = await tx.generalChampionshipScoringRule.findMany({ where: { championshipId: championship.id } });
      const competitions = await tx.competition.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, modalityId: true, sportId: true },
        where: { editionId: championship.editionId, eventId: championship.eventId, status: 'FINALIZED' },
      });
      let created = 0;
      for (const competition of competitions) {
        const existing = await tx.generalChampionshipContribution.findMany({ select: { sourcePlacement: true }, where: { championshipId: championship.id, sourceCompetitionId: competition.id } });
        const occupied = new Set(existing.map((entry) => entry.sourcePlacement));
        const matches = await tx.logicalMatch.findMany({
          orderBy: [{ roundNumber: 'desc' }, { ordinal: 'asc' }],
          select: { participantAId: true, participantBId: true, roundNumber: true, winnerParticipantId: true },
          where: { competitionId: competition.id, groupId: null, status: 'RESULT_CONFIRMED', winnerParticipantId: { not: null } },
        });
        const topRound = matches[0]?.roundNumber;
        if (topRound === undefined) continue;
        const finalMatches = matches.filter((match) => match.roundNumber === topRound);
        if (finalMatches.length !== 1) continue;
        const final = finalMatches[0];
        if (final?.winnerParticipantId == null) continue;
        const loserParticipantId = final.participantAId === final.winnerParticipantId ? final.participantBId : final.participantAId;
        const participants = await tx.competitionParticipant.findMany({ select: { id: true, institutionId: true }, where: { id: { in: [final.winnerParticipantId, loserParticipantId] } } });
        const institutionByParticipant = new Map(participants.map((participant) => [participant.id, participant.institutionId]));
        const sport = await tx.sport.findUnique({ where: { id: competition.sportId } });
        const modality = await tx.modality.findUnique({ where: { id: competition.modalityId } });
        if (sport === null || modality === null) continue;
        for (const [placement, participantId] of [[1, final.winnerParticipantId], [2, loserParticipantId]] as const) {
          if (occupied.has(placement)) continue;
          const institutionId = institutionByParticipant.get(participantId);
          const rule = rules.find((candidate) => candidate.placement === placement);
          if (institutionId === undefined || rule === undefined) continue;
          await tx.generalChampionshipContribution.create({ data: {
            automatic: true,
            championshipId: championship.id,
            confirmedAt: new Date(),
            confirmedById: input.actorId,
            description: `Aporte automático derivado de la posición ${String(placement)} confirmada en una competencia finalizada.`,
            id: randomUUID(),
            institutionId,
            points: rule.points,
            recordedById: input.actorId,
            sourceCompetitionId: competition.id,
            sourcePlacement: placement,
            sourceType: 'COMPETITION_PLACEMENT',
            status: 'CONFIRMED',
            title: `${sport.name} · ${modality.name} — ${rule.label}`,
          } });
          created += 1;
        }
      }
      if (created > 0) await this.bump(tx, championship.id, input.actorId, input.expectedRevision);
      await this.audit(tx, input, 'GENERAL_COMPETITIONS_SYNCED', 'GENERAL_CHAMPIONSHIP', championship.id, championship.revision, championship.revision + (created > 0 ? 1 : 0), { contributionCount: created, competitionCount: competitions.length });
      return championship.id;
    });
  }

  public finalize(input: ChampionshipMutation): Promise<GeneralChampionshipView> {
    if (input.actorRole !== 'SUPERADMIN') throw new GeneralChampionshipError('INVALID', 'Only SUPERADMIN can finalize the General Championship.');
    return this.mutate(input, 'general-championship:finalize', { championshipId: input.championshipId, expectedRevision: input.expectedRevision }, async (tx) => {
      const championship = await this.mutableChampionship(tx, input.championshipId, input.expectedRevision, 'ACTIVE');
      const pending = await tx.generalChampionshipContribution.count({ where: { championshipId: championship.id, status: 'PENDING_CONFIRMATION' } });
      if (pending > 0) throw new GeneralChampionshipError('INVALID', 'Pending contributions must be resolved before finalizing the General Championship.');
      const contributions = await tx.generalChampionshipContribution.findMany({ select: { id: true, institutionId: true, points: true, sourceType: true, status: true }, where: { championshipId: championship.id } });
      const standings = deriveGeneralStandings(contributions as GeneralStandingContribution[]);
      const champion = deriveGeneralChampion(standings);
      const updated = await tx.generalChampionship.updateMany({ data: {
        championInstitutionId: champion.institutionId,
        championPoints: champion.totalPoints,
        finalizedAt: new Date(),
        finalizedById: input.actorId,
        revision: { increment: 1 },
        status: 'FINALIZED',
        updatedById: input.actorId,
      }, where: { id: championship.id, revision: input.expectedRevision, status: 'ACTIVE' } });
      if (updated.count !== 1) throw new GeneralChampionshipError('CONCURRENCY_CONFLICT', 'General championship changed before finalization.');
      await this.audit(tx, input, 'GENERAL_CHAMPIONSHIP_FINALIZED', 'GENERAL_CHAMPIONSHIP', championship.id, championship.revision, championship.revision + 1, { championInstitutionId: champion.institutionId, championPoints: champion.totalPoints });
      return championship.id;
    });
  }

  private async mutableChampionship(tx: Prisma.TransactionClient, id: string, expectedRevision: number, expectedStatus: 'ACTIVE' | 'DRAFT') {
    const championship = await tx.generalChampionship.findUnique({ where: { id } });
    if (championship === null) throw new GeneralChampionshipError('INVALID', 'General championship does not exist.');
    if (championship.revision !== expectedRevision) throw new GeneralChampionshipError('CONCURRENCY_CONFLICT', 'General championship changed before this operation.');
    if (championship.status !== expectedStatus) throw new GeneralChampionshipError('INVALID', `General championship must be ${expectedStatus}.`);
    return championship;
  }

  private async assertInstitutionScope(tx: Prisma.TransactionClient, institutionId: string, eventId: string): Promise<void> {
    const institution = await tx.institution.findUnique({ where: { id: institutionId } });
    if (institution === null || institution.eventId !== eventId || !institution.active) throw new GeneralChampionshipError('INVALID', 'Institution does not belong to this General Championship event.');
  }

  private async assertCompetitionScope(tx: Prisma.TransactionClient, competitionId: string, editionId: string, eventId: string) {
    const competition = await tx.competition.findUnique({ where: { id: competitionId } });
    if (competition === null || competition.editionId !== editionId || competition.eventId !== eventId || competition.status !== 'FINALIZED') {
      throw new GeneralChampionshipError('INVALID', 'Only a finalized competition from the same edition and event can contribute placement points.');
    }
    return competition;
  }

  private async bump(tx: Prisma.TransactionClient, championshipId: string, actorId: string, expectedRevision: number): Promise<void> {
    const updated = await tx.generalChampionship.updateMany({ data: { revision: { increment: 1 }, updatedById: actorId }, where: { id: championshipId, revision: expectedRevision, status: { not: 'FINALIZED' } } });
    if (updated.count !== 1) throw new GeneralChampionshipError('CONCURRENCY_CONFLICT', 'General championship changed before this operation.');
  }

  private async audit(tx: Prisma.TransactionClient, input: Pick<MutationContext, 'actorId' | 'actorRole' | 'correlationId'>, actionCode: string, resourceType: string, resourceId: string, revisionBefore: number | null, revisionAfter: number | null, metadata: Record<string, unknown>, reason?: string): Promise<void> {
    await tx.auditEntry.create({ data: {
      actionCode,
      actorId: input.actorId,
      actorRole: input.actorRole,
      competitionId: null,
      correlationId: input.correlationId,
      id: randomUUID(),
      metadata: metadata as Prisma.InputJsonValue,
      reason: reason ?? null,
      resourceId,
      resourceType,
      revisionAfter,
      revisionBefore,
    } });
  }

  private async mutate(input: MutationContext, scope: string, payload: unknown, operation: (tx: Prisma.TransactionClient) => Promise<string>): Promise<GeneralChampionshipView> {
    const requestHash = sha256(JSON.stringify(payload));
    const keyHash = sha256(input.idempotencyKey);
    let championshipId: string;
    try {
      championshipId = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.idempotencyRecord.findUnique({ where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: keyHash, scope } } });
        if (existing !== null) {
          if (existing.requestHash !== requestHash) throw new GeneralChampionshipError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different request.');
          if (existing.status !== 'COMPLETED') throw new GeneralChampionshipError('IDEMPOTENCY_IN_PROGRESS', 'The original General Championship request is still being processed.');
          const replay = jsonReplay(existing.responseBody);
          return replay.id;
        }
        await tx.idempotencyRecord.create({ data: {
          actorId: input.actorId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          id: randomUUID(),
          idempotencyKeyHash: keyHash,
          requestHash,
          scope,
          status: 'PROCESSING',
        } });
        const id = await operation(tx);
        await tx.idempotencyRecord.update({ data: {
          completedAt: new Date(),
          resourceId: id,
          resourceType: 'GENERAL_CHAMPIONSHIP',
          responseBody: { id },
          responseStatus: 200,
          status: 'COMPLETED',
        }, where: { actorId_scope_idempotencyKeyHash: { actorId: input.actorId, idempotencyKeyHash: keyHash, scope } } });
        return id;
      }, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (error instanceof GeneralChampionshipError) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new GeneralChampionshipError('INVALID', 'An equivalent General Championship record already exists.');
      throw error;
    }
    return projectGeneralChampionship(this.prisma, championshipId);
  }
}
