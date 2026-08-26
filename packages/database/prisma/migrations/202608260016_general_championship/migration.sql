CREATE TABLE "general_championships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "edition_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "champion_institution_id" UUID,
    "champion_points" INTEGER,
    "finalized_at" TIMESTAMPTZ(6),
    "finalized_by" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID NOT NULL,
    CONSTRAINT "general_championships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "general_championships_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'FINALIZED')),
    CONSTRAINT "general_championships_champion_points_check" CHECK ("champion_points" IS NULL OR "champion_points" >= 0),
    CONSTRAINT "general_championships_finalized_shape_check" CHECK (
      ("status" = 'FINALIZED' AND "champion_institution_id" IS NOT NULL AND "champion_points" IS NOT NULL AND "finalized_at" IS NOT NULL AND "finalized_by" IS NOT NULL)
      OR
      ("status" <> 'FINALIZED' AND "champion_institution_id" IS NULL AND "champion_points" IS NULL AND "finalized_at" IS NULL AND "finalized_by" IS NULL)
    )
);

CREATE UNIQUE INDEX "general_championships_edition_id_event_id_key" ON "general_championships"("edition_id", "event_id");
CREATE INDEX "general_championships_edition_id_event_id_status_idx" ON "general_championships"("edition_id", "event_id", "status");

CREATE TABLE "general_championship_scoring_rules" (
    "championship_id" UUID NOT NULL,
    "placement" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    CONSTRAINT "general_championship_scoring_rules_pkey" PRIMARY KEY ("championship_id", "placement"),
    CONSTRAINT "general_championship_scoring_rules_placement_check" CHECK ("placement" >= 1),
    CONSTRAINT "general_championship_scoring_rules_points_check" CHECK ("points" >= 0),
    CONSTRAINT "general_championship_scoring_rules_label_check" CHECK (char_length(btrim("label")) BETWEEN 1 AND 80)
);

CREATE TABLE "general_championship_contributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "championship_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_competition_id" UUID,
    "source_placement" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "annulled_at" TIMESTAMPTZ(6),
    "annulled_by" UUID,
    "annulment_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "general_championship_contributions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "general_championship_contributions_source_type_check" CHECK ("source_type" IN ('COMPETITION_PLACEMENT', 'SPECIAL')),
    CONSTRAINT "general_championship_contributions_status_check" CHECK ("status" IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ANNULLED')),
    CONSTRAINT "general_championship_contributions_points_check" CHECK ("points" >= 0),
    CONSTRAINT "general_championship_contributions_source_shape_check" CHECK (
      ("source_type" = 'COMPETITION_PLACEMENT' AND "source_competition_id" IS NOT NULL AND "source_placement" IS NOT NULL AND "source_placement" >= 1)
      OR
      ("source_type" = 'SPECIAL' AND "source_competition_id" IS NULL AND "source_placement" IS NULL)
    ),
    CONSTRAINT "general_championship_contributions_confirmation_shape_check" CHECK (
      ("status" = 'PENDING_CONFIRMATION' AND "confirmed_at" IS NULL AND "confirmed_by" IS NULL AND "annulled_at" IS NULL AND "annulled_by" IS NULL)
      OR
      ("status" = 'CONFIRMED' AND "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL AND "annulled_at" IS NULL AND "annulled_by" IS NULL)
      OR
      ("status" = 'ANNULLED' AND "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL AND "annulled_at" IS NOT NULL AND "annulled_by" IS NOT NULL AND char_length(btrim(COALESCE("annulment_reason", ''))) >= 10)
    )
);

CREATE UNIQUE INDEX "general_championship_contributions_championship_source_placement_key"
ON "general_championship_contributions"("championship_id", "source_competition_id", "source_placement");
CREATE INDEX "general_championship_contributions_championship_status_idx" ON "general_championship_contributions"("championship_id", "status");
CREATE INDEX "general_championship_contributions_institution_status_idx" ON "general_championship_contributions"("institution_id", "status");

ALTER TABLE "general_championships"
  ADD CONSTRAINT "general_championships_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championships_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championships_champion_institution_id_fkey" FOREIGN KEY ("champion_institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championships_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championships_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "general_championship_scoring_rules"
  ADD CONSTRAINT "general_championship_scoring_rules_championship_id_fkey" FOREIGN KEY ("championship_id") REFERENCES "general_championships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "general_championship_contributions"
  ADD CONSTRAINT "general_championship_contributions_championship_id_fkey" FOREIGN KEY ("championship_id") REFERENCES "general_championships"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championship_contributions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championship_contributions_source_competition_id_fkey" FOREIGN KEY ("source_competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championship_contributions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championship_contributions_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "general_championship_contributions_annulled_by_fkey" FOREIGN KEY ("annulled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
