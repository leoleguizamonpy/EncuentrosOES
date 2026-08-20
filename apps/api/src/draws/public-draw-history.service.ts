import { Inject, Injectable } from '@nestjs/common';
import { type PrismaClient } from '@oes/database';
import { verifyPublicDrawAct, type PublicDrawAct } from '@oes/domain';

import { PRISMA_CLIENT } from '../persistence/database.module.js';

export interface PublicDrawHistoryItem {
  readonly formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
  readonly integrityValid: boolean;
  readonly officialDrawId: string;
  readonly publicationId: string;
  readonly publishedAt: string;
  readonly revocationReason: string | null;
  readonly revokedAt: string | null;
  readonly roundNumber: number;
  readonly status: 'PUBLISHED' | 'REVOKED';
  readonly verificationCode: string;
}

@Injectable()
export class PublicDrawHistoryService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async history(competitionId: string): Promise<readonly PublicDrawHistoryItem[]> {
    const records = await this.client.drawPublication.findMany({
      include: {
        officialDraw: {
          select: {
            configuration: { select: { formatCode: true, roundNumber: true } },
            evidenceHash: true,
          },
        },
      },
      orderBy: { publishedAt: 'asc' },
      where: { competitionId },
    });

    return records.map((record) => {
      const act = record.actJson as unknown as PublicDrawAct;
      const integrityValid = record.officialDraw.evidenceHash === act.evidenceHash
        && verifyPublicDrawAct(act, record.verificationCode);
      return {
        formatCode: record.officialDraw.configuration.formatCode as 'GROUP_STAGE' | 'KNOCKOUT',
        integrityValid,
        officialDrawId: record.officialDrawId,
        publicationId: record.id,
        publishedAt: record.publishedAt.toISOString(),
        revocationReason: record.revocationReason,
        revokedAt: record.revokedAt?.toISOString() ?? null,
        roundNumber: record.officialDraw.configuration.roundNumber,
        status: record.status as 'PUBLISHED' | 'REVOKED',
        verificationCode: record.verificationCode,
      };
    });
  }
}
