ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('ADMIN', 'SUPERADMIN'));

CREATE TABLE "official_draws" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "competition_id" UUID NOT NULL,
  "configuration_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "algorithm_version" TEXT NOT NULL,
  "evidence_json" JSONB NOT NULL,
  "evidence_hash" CHAR(64) NOT NULL,
  "result_hash" CHAR(64) NOT NULL,
  "seed_commitment" CHAR(64) NOT NULL,
  "seed_hex" CHAR(64) NOT NULL,
  "executed_at" TIMESTAMPTZ(6) NOT NULL,
  "executed_by" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6),
  "confirmed_by" UUID,
  "annulled_at" TIMESTAMPTZ(6),
  "annulled_by" UUID,
  "annulment_reason" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "official_draws_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "official_draws_competition_id_id_key" UNIQUE ("competition_id", "id"),
  CONSTRAINT "official_draws_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "official_draws_status_check" CHECK (
    "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ANNULLED')
  ),
  CONSTRAINT "official_draws_algorithm_check" CHECK ("algorithm_version" = 'oes-draw-v1'),
  CONSTRAINT "official_draws_hashes_check" CHECK (
    "evidence_hash" ~ '^[0-9a-f]{64}$' AND
    "result_hash" ~ '^[0-9a-f]{64}$' AND
    "seed_commitment" ~ '^[0-9a-f]{64}$' AND
    "seed_hex" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "official_draws_confirmation_check" CHECK (
    ("status" = 'PENDING_CONFIRMATION' AND "confirmed_at" IS NULL AND "confirmed_by" IS NULL)
    OR
    ("status" IN ('CONFIRMED', 'ANNULLED') AND "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL)
  ),
  CONSTRAINT "official_draws_separation_check" CHECK (
    "confirmed_by" IS NULL OR "confirmed_by" <> "executed_by"
  ),
  CONSTRAINT "official_draws_annulment_check" CHECK (
    ("status" <> 'ANNULLED' AND "annulled_at" IS NULL AND "annulled_by" IS NULL AND "annulment_reason" IS NULL)
    OR
    ("status" = 'ANNULLED' AND "annulled_at" IS NOT NULL AND "annulled_by" IS NOT NULL AND "annulment_reason" IS NOT NULL AND length(btrim("annulment_reason")) > 0)
  )
);

CREATE UNIQUE INDEX "official_draws_one_active_per_configuration_key"
  ON "official_draws"("configuration_id")
  WHERE "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED');
CREATE INDEX "official_draws_competition_id_status_idx"
  ON "official_draws"("competition_id", "status");

ALTER TABLE "official_draws"
  ADD CONSTRAINT "official_draws_competition_id_fkey"
  FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "official_draws_configuration_fkey"
  FOREIGN KEY ("competition_id", "configuration_id")
  REFERENCES "draw_configurations"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "official_draws_executed_by_fkey"
  FOREIGN KEY ("executed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "official_draws_confirmed_by_fkey"
  FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "official_draws_annulled_by_fkey"
  FOREIGN KEY ("annulled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "draw_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "execution_id" UUID NOT NULL,
  "competition_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "draw_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "draw_groups_competition_id_id_key" UNIQUE ("competition_id", "id"),
  CONSTRAINT "draw_groups_execution_id_ordinal_key" UNIQUE ("execution_id", "ordinal"),
  CONSTRAINT "draw_groups_execution_id_label_key" UNIQUE ("execution_id", "label"),
  CONSTRAINT "draw_groups_ordinal_check" CHECK ("ordinal" > 0),
  CONSTRAINT "draw_groups_execution_fkey" FOREIGN KEY ("competition_id", "execution_id")
    REFERENCES "official_draws"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "draw_group_members" (
  "group_id" UUID NOT NULL,
  "competition_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "member_ordinal" INTEGER NOT NULL,
  CONSTRAINT "draw_group_members_pkey" PRIMARY KEY ("group_id", "participant_id"),
  CONSTRAINT "draw_group_members_group_id_member_ordinal_key" UNIQUE ("group_id", "member_ordinal"),
  CONSTRAINT "draw_group_members_ordinal_check" CHECK ("member_ordinal" > 0),
  CONSTRAINT "draw_group_members_group_fkey" FOREIGN KEY ("competition_id", "group_id")
    REFERENCES "draw_groups"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "draw_group_members_participant_fkey" FOREIGN KEY ("competition_id", "participant_id")
    REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "draw_pairings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "execution_id" UUID NOT NULL,
  "competition_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "pairing_type" TEXT NOT NULL,
  "participant_a_id" UUID NOT NULL,
  "participant_b_id" UUID,
  "prior_bye_count" INTEGER,
  CONSTRAINT "draw_pairings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "draw_pairings_competition_id_id_key" UNIQUE ("competition_id", "id"),
  CONSTRAINT "draw_pairings_execution_id_ordinal_key" UNIQUE ("execution_id", "ordinal"),
  CONSTRAINT "draw_pairings_ordinal_check" CHECK ("ordinal" > 0),
  CONSTRAINT "draw_pairings_shape_check" CHECK (
    ("pairing_type" = 'MATCH' AND "participant_b_id" IS NOT NULL AND "prior_bye_count" IS NULL)
    OR
    ("pairing_type" = 'BYE' AND "participant_b_id" IS NULL AND "prior_bye_count" >= 0)
  ),
  CONSTRAINT "draw_pairings_distinct_check" CHECK (
    "participant_b_id" IS NULL OR "participant_a_id" <> "participant_b_id"
  ),
  CONSTRAINT "draw_pairings_execution_fkey" FOREIGN KEY ("competition_id", "execution_id")
    REFERENCES "official_draws"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "draw_pairings_participant_a_fkey" FOREIGN KEY ("competition_id", "participant_a_id")
    REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "draw_pairings_participant_b_fkey" FOREIGN KEY ("competition_id", "participant_b_id")
    REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "matches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "competition_id" UUID NOT NULL,
  "execution_id" UUID NOT NULL,
  "round_number" INTEGER NOT NULL,
  "group_id" UUID,
  "pairing_id" UUID,
  "ordinal" INTEGER NOT NULL,
  "participant_a_id" UUID NOT NULL,
  "participant_b_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_RESULT',
  CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matches_execution_id_ordinal_key" UNIQUE ("execution_id", "ordinal"),
  CONSTRAINT "matches_shape_check" CHECK (
    ("group_id" IS NOT NULL AND "pairing_id" IS NULL AND "round_number" = 0)
    OR
    ("group_id" IS NULL AND "pairing_id" IS NOT NULL AND "round_number" > 0)
  ),
  CONSTRAINT "matches_status_check" CHECK ("status" = 'PENDING_RESULT'),
  CONSTRAINT "matches_distinct_check" CHECK ("participant_a_id" <> "participant_b_id"),
  CONSTRAINT "matches_execution_fkey" FOREIGN KEY ("competition_id", "execution_id")
    REFERENCES "official_draws"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "matches_competition_fkey" FOREIGN KEY ("competition_id")
    REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "matches_group_fkey" FOREIGN KEY ("competition_id", "group_id")
    REFERENCES "draw_groups"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "matches_pairing_fkey" FOREIGN KEY ("competition_id", "pairing_id")
    REFERENCES "draw_pairings"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "matches_participant_a_fkey" FOREIGN KEY ("competition_id", "participant_a_id")
    REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "matches_participant_b_fkey" FOREIGN KEY ("competition_id", "participant_b_id")
    REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION protect_official_draw_evidence() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'official draw evidence cannot be deleted';
  END IF;
  IF NEW."competition_id" <> OLD."competition_id"
    OR NEW."configuration_id" <> OLD."configuration_id"
    OR NEW."algorithm_version" <> OLD."algorithm_version"
    OR NEW."evidence_json" <> OLD."evidence_json"
    OR NEW."evidence_hash" <> OLD."evidence_hash"
    OR NEW."result_hash" <> OLD."result_hash"
    OR NEW."seed_commitment" <> OLD."seed_commitment"
    OR NEW."seed_hex" <> OLD."seed_hex"
    OR NEW."executed_at" <> OLD."executed_at"
    OR NEW."executed_by" <> OLD."executed_by" THEN
    RAISE EXCEPTION 'official draw evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "official_draws_evidence_immutable"
  BEFORE UPDATE OR DELETE ON "official_draws"
  FOR EACH ROW EXECUTE FUNCTION protect_official_draw_evidence();
