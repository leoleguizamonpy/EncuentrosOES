import { DomainError } from '@oes/domain';

import type { PrismaClient } from './generated/prisma/client.js';

export interface LockPersistedCompetitionInput {
  readonly actorId: string;
  readonly competitionId: string;
  readonly drawConfigurationId: string;
  readonly expectedRevision: number;
  readonly occurredAt: Date;
  readonly ruleSetId: string;
}

export class PrismaCompetitionLockService {
  readonly #client: PrismaClient;

  public constructor(client: PrismaClient) {
    this.#client = client;
  }

  public async lock(input: LockPersistedCompetitionInput): Promise<void> {
    const changed = await this.#client.$executeRaw`
      UPDATE "competitions" AS competition
      SET
        "format_code" = draw."format_code",
        "locked_at" = ${input.occurredAt},
        "locked_by" = ${input.actorId}::uuid,
        "revision" = competition."revision" + 1,
        "status" = 'LOCKED',
        "updated_at" = ${input.occurredAt},
        "updated_by" = ${input.actorId}::uuid
      FROM "competition_rule_sets" AS rules,
           "draw_configurations" AS draw
      WHERE competition."id" = ${input.competitionId}::uuid
        AND competition."revision" = ${input.expectedRevision}
        AND competition."status" = 'OPEN'
        AND rules."id" = ${input.ruleSetId}::uuid
        AND rules."competition_id" = competition."id"
        AND rules."status" = 'FROZEN'
        AND draw."id" = ${input.drawConfigurationId}::uuid
        AND draw."competition_id" = competition."id"
        AND draw."rule_set_id" = rules."id"
        AND draw."status" = 'FROZEN'
        AND draw."participant_count" = (
          SELECT count(*)::integer
          FROM "competition_participants" AS participant
          WHERE participant."competition_id" = competition."id"
            AND participant."status" = 'ENABLED'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "competition_participants" AS participant
          WHERE participant."competition_id" = competition."id"
            AND participant."status" = 'ENABLED'
            AND NOT EXISTS (
              SELECT 1
              FROM "draw_configuration_participants" AS snapshot
              WHERE snapshot."draw_configuration_id" = draw."id"
                AND snapshot."competition_participant_id" = participant."id"
            )
        )
    `;

    if (changed !== 1) {
      throw new DomainError(
        'LOCK_PRECONDITION_FAILED',
        'The persisted competition, participants, rules and draw are not lock-compatible.',
      );
    }
  }
}
