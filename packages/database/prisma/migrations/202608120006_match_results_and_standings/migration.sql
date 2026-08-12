ALTER TABLE "matches"
  ADD COLUMN "winner_participant_id" UUID,
  DROP CONSTRAINT "matches_status_check",
  ADD CONSTRAINT "matches_status_check" CHECK (
    "status" IN ('PENDING_RESULT', 'RESULT_PENDING_CONFIRMATION', 'RESULT_CONFIRMED')
  ),
  ADD CONSTRAINT "matches_winner_check" CHECK (
    ("status" <> 'RESULT_CONFIRMED' AND "winner_participant_id" IS NULL)
    OR
    ("status" = 'RESULT_CONFIRMED')
  ),
  ADD CONSTRAINT "matches_winner_fkey" FOREIGN KEY ("competition_id", "winner_participant_id")
    REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_id_key" UNIQUE ("competition_id", "id");

CREATE TABLE "match_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "competition_id" UUID NOT NULL,
  "rule_set_id" UUID NOT NULL,
  "participant_a_id" UUID NOT NULL,
  "participant_b_id" UUID NOT NULL,
  "detail_json" JSONB NOT NULL,
  "resolved_json" JSONB NOT NULL,
  "winner_participant_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "recorded_at" TIMESTAMPTZ(6) NOT NULL,
  "recorded_by" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6),
  "confirmed_by" UUID,
  "annulled_at" TIMESTAMPTZ(6),
  "annulled_by" UUID,
  "annulment_reason" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "match_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_results_status_check" CHECK (
    "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ANNULLED')
  ),
  CONSTRAINT "match_results_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "match_results_distinct_check" CHECK ("participant_a_id" <> "participant_b_id"),
  CONSTRAINT "match_results_confirmation_check" CHECK (
    ("status" = 'PENDING_CONFIRMATION' AND "confirmed_at" IS NULL AND "confirmed_by" IS NULL)
    OR
    ("status" IN ('CONFIRMED', 'ANNULLED') AND "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL)
  ),
  CONSTRAINT "match_results_separation_check" CHECK (
    "confirmed_by" IS NULL OR "confirmed_by" <> "recorded_by"
  ),
  CONSTRAINT "match_results_annulment_check" CHECK (
    ("status" <> 'ANNULLED' AND "annulled_at" IS NULL AND "annulled_by" IS NULL AND "annulment_reason" IS NULL)
    OR
    ("status" = 'ANNULLED' AND "annulled_at" IS NOT NULL AND "annulled_by" IS NOT NULL AND "annulment_reason" IS NOT NULL AND length(btrim("annulment_reason")) > 0)
  )
);

CREATE UNIQUE INDEX "match_results_one_active_per_match_key"
  ON "match_results"("match_id") WHERE "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED');
CREATE INDEX "match_results_match_id_status_idx" ON "match_results"("match_id", "status");

ALTER TABLE "match_results"
  ADD CONSTRAINT "match_results_match_fkey" FOREIGN KEY ("competition_id", "match_id") REFERENCES "matches"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_rule_set_fkey" FOREIGN KEY ("competition_id", "rule_set_id") REFERENCES "competition_rule_sets"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_participant_a_fkey" FOREIGN KEY ("competition_id", "participant_a_id") REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_participant_b_fkey" FOREIGN KEY ("competition_id", "participant_b_id") REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_winner_fkey" FOREIGN KEY ("competition_id", "winner_participant_id") REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_annulled_by_fkey" FOREIGN KEY ("annulled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "group_standings" (
  "group_id" UUID NOT NULL,
  "competition_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "played" INTEGER NOT NULL,
  "wins" INTEGER NOT NULL,
  "draws" INTEGER NOT NULL,
  "losses" INTEGER NOT NULL,
  "table_points" INTEGER NOT NULL,
  "score_for" INTEGER NOT NULL,
  "score_against" INTEGER NOT NULL,
  "score_difference" INTEGER NOT NULL,
  "sets_won" INTEGER NOT NULL,
  "sets_lost" INTEGER NOT NULL,
  "set_difference" INTEGER NOT NULL,
  "sport_points_for" INTEGER NOT NULL,
  "sport_points_against" INTEGER NOT NULL,
  "sport_point_difference" INTEGER NOT NULL,
  "recalculated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "group_standings_pkey" PRIMARY KEY ("group_id", "participant_id"),
  CONSTRAINT "group_standings_group_id_position_key" UNIQUE ("group_id", "position"),
  CONSTRAINT "group_standings_position_check" CHECK ("position" > 0),
  CONSTRAINT "group_standings_counts_check" CHECK (
    "played" >= 0 AND "wins" >= 0 AND "draws" >= 0 AND "losses" >= 0 AND
    "score_for" >= 0 AND "score_against" >= 0 AND "sets_won" >= 0 AND "sets_lost" >= 0 AND
    "sport_points_for" >= 0 AND "sport_points_against" >= 0
  ),
  CONSTRAINT "group_standings_group_fkey" FOREIGN KEY ("competition_id", "group_id") REFERENCES "draw_groups"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "group_standings_participant_fkey" FOREIGN KEY ("competition_id", "participant_id") REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION protect_confirmed_result_payload() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('CONFIRMED', 'ANNULLED') AND (
    NEW."match_id" <> OLD."match_id" OR NEW."competition_id" <> OLD."competition_id" OR
    NEW."rule_set_id" <> OLD."rule_set_id" OR NEW."participant_a_id" <> OLD."participant_a_id" OR
    NEW."participant_b_id" <> OLD."participant_b_id" OR NEW."detail_json" <> OLD."detail_json" OR
    NEW."resolved_json" <> OLD."resolved_json" OR NEW."winner_participant_id" IS DISTINCT FROM OLD."winner_participant_id" OR
    NEW."recorded_at" <> OLD."recorded_at" OR NEW."recorded_by" <> OLD."recorded_by"
  ) THEN RAISE EXCEPTION 'confirmed result payload is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "match_results_confirmed_payload_immutable"
  BEFORE UPDATE ON "match_results" FOR EACH ROW EXECUTE FUNCTION protect_confirmed_result_payload();
