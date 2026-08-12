ALTER TABLE "group_standings"
  DROP CONSTRAINT "group_standings_group_id_position_key",
  ADD COLUMN "tied" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "match_results"
  ADD CONSTRAINT "match_results_competition_id_id_key" UNIQUE ("competition_id", "id");

CREATE TABLE "group_qualifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "competition_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "source_rule_set_id" UUID NOT NULL,
  "first_participant_id" UUID NOT NULL,
  "second_participant_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "proposed_at" TIMESTAMPTZ(6) NOT NULL,
  "proposed_by" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6),
  "confirmed_by" UUID,
  "invalidated_at" TIMESTAMPTZ(6),
  "invalidated_by" UUID,
  "invalidation_reason" TEXT,
  "annulled_at" TIMESTAMPTZ(6),
  "annulled_by" UUID,
  "annulment_reason" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "group_qualifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_qualifications_competition_id_id_key" UNIQUE ("competition_id", "id"),
  CONSTRAINT "group_qualifications_status_check" CHECK (
    "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'INVALIDATED', 'ANNULLED')
  ),
  CONSTRAINT "group_qualifications_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "group_qualifications_distinct_check" CHECK ("first_participant_id" <> "second_participant_id"),
  CONSTRAINT "group_qualifications_separation_check" CHECK (
    "confirmed_by" IS NULL OR "confirmed_by" <> "proposed_by"
  ),
  CONSTRAINT "group_qualifications_evidence_check" CHECK (
    (
      "status" = 'PENDING_CONFIRMATION' AND
      "confirmed_at" IS NULL AND "confirmed_by" IS NULL AND
      "invalidated_at" IS NULL AND "invalidated_by" IS NULL AND "invalidation_reason" IS NULL AND
      "annulled_at" IS NULL AND "annulled_by" IS NULL AND "annulment_reason" IS NULL
    ) OR (
      "status" = 'CONFIRMED' AND
      "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL AND
      "invalidated_at" IS NULL AND "invalidated_by" IS NULL AND "invalidation_reason" IS NULL AND
      "annulled_at" IS NULL AND "annulled_by" IS NULL AND "annulment_reason" IS NULL
    ) OR (
      "status" = 'INVALIDATED' AND
      (("confirmed_at" IS NULL AND "confirmed_by" IS NULL) OR ("confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL)) AND
      "invalidated_at" IS NOT NULL AND "invalidated_by" IS NOT NULL AND length(btrim("invalidation_reason")) > 0 AND
      "annulled_at" IS NULL AND "annulled_by" IS NULL AND "annulment_reason" IS NULL
    ) OR (
      "status" = 'ANNULLED' AND
      "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL AND
      "invalidated_at" IS NULL AND "invalidated_by" IS NULL AND "invalidation_reason" IS NULL AND
      "annulled_at" IS NOT NULL AND "annulled_by" IS NOT NULL AND length(btrim("annulment_reason")) > 0
    )
  )
);

CREATE UNIQUE INDEX "group_qualifications_one_active_per_group_key"
  ON "group_qualifications"("group_id") WHERE "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED');
CREATE INDEX "group_qualifications_group_id_status_idx" ON "group_qualifications"("group_id", "status");

ALTER TABLE "group_qualifications"
  ADD CONSTRAINT "group_qualifications_competition_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_group_fkey" FOREIGN KEY ("competition_id", "group_id") REFERENCES "draw_groups"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_rule_set_fkey" FOREIGN KEY ("competition_id", "source_rule_set_id") REFERENCES "competition_rule_sets"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_first_participant_fkey" FOREIGN KEY ("competition_id", "first_participant_id") REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_second_participant_fkey" FOREIGN KEY ("competition_id", "second_participant_id") REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_invalidated_by_fkey" FOREIGN KEY ("invalidated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "group_qualifications_annulled_by_fkey" FOREIGN KEY ("annulled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "group_qualification_sources" (
  "qualification_id" UUID NOT NULL,
  "competition_id" UUID NOT NULL,
  "result_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "group_qualification_sources_pkey" PRIMARY KEY ("qualification_id", "result_id"),
  CONSTRAINT "group_qualification_sources_qualification_id_ordinal_key" UNIQUE ("qualification_id", "ordinal"),
  CONSTRAINT "group_qualification_sources_ordinal_check" CHECK ("ordinal" > 0),
  CONSTRAINT "group_qualification_sources_qualification_fkey" FOREIGN KEY ("competition_id", "qualification_id") REFERENCES "group_qualifications"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "group_qualification_sources_result_fkey" FOREIGN KEY ("competition_id", "result_id") REFERENCES "match_results"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION protect_group_qualification_payload() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'PENDING_CONFIRMATION' AND (
    NEW."competition_id" <> OLD."competition_id" OR NEW."group_id" <> OLD."group_id" OR
    NEW."source_rule_set_id" <> OLD."source_rule_set_id" OR
    NEW."first_participant_id" <> OLD."first_participant_id" OR
    NEW."second_participant_id" <> OLD."second_participant_id" OR
    NEW."proposed_at" <> OLD."proposed_at" OR NEW."proposed_by" <> OLD."proposed_by"
  ) THEN RAISE EXCEPTION 'official qualification payload is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "group_qualifications_payload_immutable"
  BEFORE UPDATE ON "group_qualifications" FOR EACH ROW EXECUTE FUNCTION protect_group_qualification_payload();
