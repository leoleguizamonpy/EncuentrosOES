import type { Prisma, PrismaClient } from '@oes/database';
import {
  publicDrawVerificationCode,
  verifyPublicDrawAct,
  type DrawEvidence,
  type PublicDrawAct,
  type PublicDrawResult,
} from '@oes/domain';

import {
  DrawStoreError,
  type DrawWorkspace,
  type OfficialDrawResultView,
  type PublicDrawPublicationView,
} from './draw-store.js';

export class DrawReadModel {
  public constructor(private readonly client: PrismaClient) {}

  public workspace(competitionId: string): Promise<DrawWorkspace> {
    return this.client.$transaction((transaction) => this.workspaceInTransaction(transaction, competitionId));
  }

  public async workspaceInTransaction(
    transaction: Prisma.TransactionClient,
    competitionId: string,
  ): Promise<DrawWorkspace> {
    const competition = await transaction.competition.findUnique({
      select: { id: true, revision: true, status: true },
      where: { id: competitionId },
    });
    if (competition === null) {
      throw new DrawStoreError('COMPETITION_NOT_FOUND', 'The competition does not exist.');
    }
    const configurationRecord = await transaction.drawConfiguration.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { competitionId, status: 'FROZEN' },
    });
    if (configurationRecord === null) {
      return {
        competitionId,
        competitionRevision: competition.revision,
        competitionStatus: competition.status as DrawWorkspace['competitionStatus'],
        configuration: null,
        execution: null,
        publication: null,
      };
    }
    if (configurationRecord.canonicalHash === null) {
      throw new DrawStoreError('DRAW_CONFIGURATION_INVALID', 'Frozen draw evidence is missing.');
    }
    const executionRecord = await transaction.officialDraw.findFirst({
      include: {
        confirmedBy: { select: { displayName: true, id: true } },
        executedBy: { select: { displayName: true, id: true } },
        _count: { select: { matches: true } },
      },
      orderBy: { executedAt: 'desc' },
      where: {
        configurationId: configurationRecord.id,
        status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] },
      },
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
    if (executionRecord === null) {
      return {
        competitionId,
        competitionRevision: competition.revision,
        competitionStatus: competition.status as DrawWorkspace['competitionStatus'],
        configuration,
        execution: null,
        publication: null,
      };
    }
    const publicationRecord = await transaction.drawPublication.findUnique({
      where: { officialDrawId: executionRecord.id },
    });
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
        result: await this.resultView(transaction, competitionId, evidence),
        revision: executionRecord.revision,
        seedCommitment: executionRecord.seedCommitment,
        seedHex: executionRecord.status === 'CONFIRMED' ? executionRecord.seedHex : null,
        status: executionRecord.status as 'CONFIRMED' | 'PENDING_CONFIRMATION',
      },
      publication:
        publicationRecord === null || publicationRecord.status !== 'PUBLISHED'
          ? null
          : {
              id: publicationRecord.id,
              publishedAt: publicationRecord.publishedAt.toISOString(),
              verificationCode: publicationRecord.verificationCode,
            },
    };
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
    const verified = record.officialDraw.evidenceHash === act.evidenceHash
      && verifyPublicDrawAct(act, record.verificationCode);
    return {
      act,
      id: record.id,
      publishedAt: record.publishedAt.toISOString(),
      verificationCode: record.verificationCode,
      verified,
    };
  }

  public async verify(
    verificationCode: string,
  ): Promise<Readonly<{ publicationId: string | null; valid: boolean }>> {
    const record = await this.client.drawPublication.findUnique({ where: { verificationCode } });
    if (record === null || record.status !== 'PUBLISHED') {
      return { publicationId: null, valid: false };
    }
    try {
      const publication = await this.publicDraw(record.id);
      return { publicationId: record.id, valid: publication.verified };
    } catch {
      return { publicationId: record.id, valid: false };
    }
  }

  public buildPublicActResult(evidence: DrawEvidence, names: ReadonlyMap<string, string>): PublicDrawResult {
    const participant = (id: string) => {
      const name = names.get(id);
      if (name === undefined) {
        throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Public evidence references an unknown participant.');
      }
      return { id, name };
    };
    if (evidence.result.formatCode === 'GROUP_STAGE') {
      return {
        formatCode: 'GROUP_STAGE',
        groups: evidence.result.groups.map((group) => ({
          ...group,
          members: group.members.map(participant),
        })),
      };
    }
    return {
      bye: evidence.result.bye === null
        ? null
        : {
            participant: participant(evidence.result.bye.participantId),
            priorByeCount: evidence.result.bye.priorByeCount,
          },
      formatCode: 'KNOCKOUT',
      pairings: evidence.result.pairings.map((pairing) => ({
        ordinal: pairing.ordinal,
        participantA: participant(pairing.participantAId),
        participantB: participant(pairing.participantBId),
      })),
      roundNumber: evidence.result.roundNumber,
    };
  }

  public verificationCode(act: PublicDrawAct): string {
    return publicDrawVerificationCode(act);
  }

  private async resultView(
    transaction: Prisma.TransactionClient,
    competitionId: string,
    evidence: DrawEvidence,
  ): Promise<OfficialDrawResultView> {
    const ids = evidence.result.formatCode === 'GROUP_STAGE'
      ? evidence.result.groups.flatMap(({ members }) => members)
      : [
          ...evidence.result.pairings.flatMap(({ participantAId, participantBId }) => [participantAId, participantBId]),
          ...(evidence.result.bye === null ? [] : [evidence.result.bye.participantId]),
        ];
    const participants = await transaction.competitionParticipant.findMany({
      select: { displayName: true, id: true },
      where: { competitionId, id: { in: ids } },
    });
    const byId = new Map(participants.map((participant) => [participant.id, participant]));
    const participant = (id: string) => {
      const found = byId.get(id);
      if (found === undefined) {
        throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'Draw evidence references an unknown participant.');
      }
      return found;
    };
    if (evidence.result.formatCode === 'GROUP_STAGE') {
      return {
        formatCode: 'GROUP_STAGE',
        groups: evidence.result.groups.map((group) => ({ ...group, members: group.members.map(participant) })),
      };
    }
    return {
      bye: evidence.result.bye === null
        ? null
        : {
            participant: participant(evidence.result.bye.participantId),
            priorByeCount: evidence.result.bye.priorByeCount,
          },
      formatCode: 'KNOCKOUT',
      pairings: evidence.result.pairings.map((pairing) => ({
        ordinal: pairing.ordinal,
        participantA: participant(pairing.participantAId),
        participantB: participant(pairing.participantBId),
      })),
      roundNumber: evidence.result.roundNumber,
    };
  }
}
