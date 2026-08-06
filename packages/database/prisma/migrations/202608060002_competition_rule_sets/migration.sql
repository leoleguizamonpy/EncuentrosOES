-- CreateTable
CREATE TABLE "competition_rule_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "result_profile" TEXT NOT NULL,
    "profile_config" JSONB NOT NULL,
    "knockout_resolution_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "canonical_hash" CHAR(64),
    "frozen_at" TIMESTAMPTZ(6),
    "frozen_by" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "competition_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_set_outcomes" (
    "rule_set_id" UUID NOT NULL,
    "outcome_code" TEXT NOT NULL,
    "table_points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "rule_set_outcomes_pkey" PRIMARY KEY ("rule_set_id", "outcome_code")
);

-- CreateTable
CREATE TABLE "rule_set_metrics" (
    "rule_set_id" UUID NOT NULL,
    "metric_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rule_set_metrics_pkey" PRIMARY KEY ("rule_set_id", "metric_code")
);

-- CreateTable
CREATE TABLE "rule_set_tiebreaks" (
    "rule_set_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "criterion_code" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "rule_set_tiebreaks_pkey" PRIMARY KEY ("rule_set_id", "position")
);

-- CreateIndex
CREATE UNIQUE INDEX "competition_rule_sets_competition_id_revision_number_key"
  ON "competition_rule_sets"("competition_id", "revision_number");

CREATE UNIQUE INDEX "competition_rule_sets_competition_id_id_key"
  ON "competition_rule_sets"("competition_id", "id");

CREATE INDEX "competition_rule_sets_competition_id_status_idx"
  ON "competition_rule_sets"("competition_id", "status");

CREATE UNIQUE INDEX "competition_rule_sets_one_frozen_per_competition_key"
  ON "competition_rule_sets"("competition_id") WHERE "status" = 'FROZEN';

CREATE UNIQUE INDEX "rule_set_tiebreaks_rule_set_id_criterion_code_key"
  ON "rule_set_tiebreaks"("rule_set_id", "criterion_code");

-- AddForeignKey
ALTER TABLE "competition_rule_sets"
  ADD CONSTRAINT "competition_rule_sets_competition_id_fkey"
  FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_rule_sets"
  ADD CONSTRAINT "competition_rule_sets_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_rule_sets"
  ADD CONSTRAINT "competition_rule_sets_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_rule_sets"
  ADD CONSTRAINT "competition_rule_sets_frozen_by_fkey"
  FOREIGN KEY ("frozen_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rule_set_outcomes"
  ADD CONSTRAINT "rule_set_outcomes_rule_set_id_fkey"
  FOREIGN KEY ("rule_set_id") REFERENCES "competition_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rule_set_metrics"
  ADD CONSTRAINT "rule_set_metrics_rule_set_id_fkey"
  FOREIGN KEY ("rule_set_id") REFERENCES "competition_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rule_set_tiebreaks"
  ADD CONSTRAINT "rule_set_tiebreaks_rule_set_id_fkey"
  FOREIGN KEY ("rule_set_id") REFERENCES "competition_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks not expressible in Prisma Schema Language
ALTER TABLE "competition_rule_sets"
  ADD CONSTRAINT "competition_rule_sets_schema_version_check" CHECK ("schema_version" > 0),
  ADD CONSTRAINT "competition_rule_sets_revision_number_check" CHECK ("revision_number" > 0),
  ADD CONSTRAINT "competition_rule_sets_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "competition_rule_sets_result_profile_check" CHECK (
    "result_profile" IN ('SCORE_BASED', 'SET_BASED')
  ),
  ADD CONSTRAINT "competition_rule_sets_knockout_resolution_check" CHECK (
    "knockout_resolution_code" IN ('HIGHER_SCORE', 'MOST_SETS_WON')
  ),
  ADD CONSTRAINT "competition_rule_sets_status_check" CHECK (
    "status" IN ('DRAFT', 'FROZEN', 'REPLACED')
  ),
  ADD CONSTRAINT "competition_rule_sets_hash_check" CHECK (
    "canonical_hash" IS NULL OR "canonical_hash" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "competition_rule_sets_freeze_evidence_check" CHECK (
    ("status" = 'DRAFT' AND "canonical_hash" IS NULL AND "frozen_at" IS NULL AND "frozen_by" IS NULL)
    OR
    ("status" IN ('FROZEN', 'REPLACED') AND "canonical_hash" IS NOT NULL AND "frozen_at" IS NOT NULL AND "frozen_by" IS NOT NULL)
  );

ALTER TABLE "rule_set_outcomes"
  ADD CONSTRAINT "rule_set_outcomes_code_check" CHECK (
    "outcome_code" ~ '^(WIN|DRAW|LOSS|WIN_VARIANT_[A-Z0-9_]+|LOSS_VARIANT_[A-Z0-9_]+)$'
  ),
  ADD CONSTRAINT "rule_set_outcomes_description_check" CHECK (
    char_length(btrim("description")) BETWEEN 1 AND 160
  );

ALTER TABLE "rule_set_metrics"
  ADD CONSTRAINT "rule_set_metrics_code_check" CHECK (
    "metric_code" IN (
      'PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'TABLE_POINTS',
      'SCORE_FOR', 'SCORE_AGAINST', 'SCORE_DIFFERENCE',
      'SETS_WON', 'SETS_LOST', 'SET_DIFFERENCE',
      'SPORT_POINTS_FOR', 'SPORT_POINTS_AGAINST', 'SPORT_POINT_DIFFERENCE'
    )
  ),
  ADD CONSTRAINT "rule_set_metrics_enabled_check" CHECK ("enabled" = true);

ALTER TABLE "rule_set_tiebreaks"
  ADD CONSTRAINT "rule_set_tiebreaks_position_check" CHECK ("position" > 0),
  ADD CONSTRAINT "rule_set_tiebreaks_code_check" CHECK (
    "criterion_code" IN (
      'TABLE_POINTS', 'WINS', 'HEAD_TO_HEAD_TABLE_POINTS',
      'SCORE_DIFFERENCE', 'SCORE_FOR', 'SET_DIFFERENCE', 'SETS_WON',
      'SPORT_POINT_DIFFERENCE', 'SPORT_POINTS_FOR'
    )
  );

CREATE FUNCTION prevent_frozen_rule_set_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT "status" INTO parent_status
  FROM "competition_rule_sets"
  WHERE "id" = OLD."rule_set_id";

  IF parent_status IN ('FROZEN', 'REPLACED') THEN
    RAISE EXCEPTION 'Frozen rule set children are immutable';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER "rule_set_outcomes_immutable_when_frozen"
BEFORE UPDATE OR DELETE ON "rule_set_outcomes"
FOR EACH ROW EXECUTE FUNCTION prevent_frozen_rule_set_child_mutation();

CREATE TRIGGER "rule_set_metrics_immutable_when_frozen"
BEFORE UPDATE OR DELETE ON "rule_set_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_frozen_rule_set_child_mutation();

CREATE TRIGGER "rule_set_tiebreaks_immutable_when_frozen"
BEFORE UPDATE OR DELETE ON "rule_set_tiebreaks"
FOR EACH ROW EXECUTE FUNCTION prevent_frozen_rule_set_child_mutation();
