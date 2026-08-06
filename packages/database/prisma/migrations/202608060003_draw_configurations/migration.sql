-- CreateTable
CREATE TABLE "draw_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "rule_set_id" UUID NOT NULL,
    "round_number" INTEGER NOT NULL,
    "format_code" TEXT NOT NULL,
    "group_count" INTEGER,
    "participant_count" INTEGER NOT NULL,
    "algorithm_version" TEXT NOT NULL DEFAULT 'oes-draw-v1',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "canonical_hash" CHAR(64),
    "frozen_at" TIMESTAMPTZ(6),
    "frozen_by" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "draw_configurations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "draw_configurations_competition_id_round_number_status_idx"
  ON "draw_configurations"("competition_id", "round_number", "status");

CREATE UNIQUE INDEX "draw_configurations_one_frozen_per_round_key"
  ON "draw_configurations"("competition_id", "round_number") WHERE "status" = 'FROZEN';

ALTER TABLE "draw_configurations"
  ADD CONSTRAINT "draw_configurations_competition_id_fkey"
  FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configurations"
  ADD CONSTRAINT "draw_configurations_competition_id_rule_set_id_fkey"
  FOREIGN KEY ("competition_id", "rule_set_id")
  REFERENCES "competition_rule_sets"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configurations"
  ADD CONSTRAINT "draw_configurations_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configurations"
  ADD CONSTRAINT "draw_configurations_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configurations"
  ADD CONSTRAINT "draw_configurations_frozen_by_fkey"
  FOREIGN KEY ("frozen_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configurations"
  ADD CONSTRAINT "draw_configurations_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "draw_configurations_participant_count_check" CHECK ("participant_count" >= 2),
  ADD CONSTRAINT "draw_configurations_algorithm_check" CHECK ("algorithm_version" = 'oes-draw-v1'),
  ADD CONSTRAINT "draw_configurations_status_check" CHECK (
    "status" IN ('DRAFT', 'FROZEN', 'DISCARDED')
  ),
  ADD CONSTRAINT "draw_configurations_hash_check" CHECK (
    "canonical_hash" IS NULL OR "canonical_hash" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "draw_configurations_shape_check" CHECK (
    (
      "format_code" = 'GROUP_STAGE' AND
      "round_number" = 0 AND
      "group_count" > 0 AND
      "participant_count" BETWEEN (3 * "group_count") AND (4 * "group_count")
    )
    OR
    (
      "format_code" = 'KNOCKOUT' AND
      "round_number" > 0 AND
      "group_count" IS NULL
    )
  ),
  ADD CONSTRAINT "draw_configurations_freeze_evidence_check" CHECK (
    ("status" = 'DRAFT' AND "canonical_hash" IS NULL AND "frozen_at" IS NULL AND "frozen_by" IS NULL)
    OR
    ("status" IN ('FROZEN', 'DISCARDED') AND "canonical_hash" IS NOT NULL AND "frozen_at" IS NOT NULL AND "frozen_by" IS NOT NULL)
  );
