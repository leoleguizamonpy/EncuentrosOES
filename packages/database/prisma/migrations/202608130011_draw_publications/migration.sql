CREATE TABLE "draw_publications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "official_draw_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "act_json" JSONB NOT NULL,
    "verification_code" CHAR(64) NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "published_by" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "draw_publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "draw_publications_official_draw_id_key" ON "draw_publications"("official_draw_id");
CREATE UNIQUE INDEX "draw_publications_competition_id_official_draw_id_key" ON "draw_publications"("competition_id", "official_draw_id");
CREATE UNIQUE INDEX "draw_publications_verification_code_key" ON "draw_publications"("verification_code");
CREATE INDEX "draw_publications_competition_id_status_published_at_idx" ON "draw_publications"("competition_id", "status", "published_at" DESC);

ALTER TABLE "draw_publications"
  ADD CONSTRAINT "draw_publications_status_check" CHECK ("status" IN ('PUBLISHED', 'REVOKED')),
  ADD CONSTRAINT "draw_publications_verification_code_check" CHECK ("verification_code" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "draw_publications_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "draw_publications_revocation_check" CHECK (
    ("status" = 'PUBLISHED' AND "revoked_at" IS NULL AND "revocation_reason" IS NULL)
    OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND length(trim("revocation_reason")) > 0)
  );

ALTER TABLE "draw_publications" ADD CONSTRAINT "draw_publications_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "draw_publications" ADD CONSTRAINT "draw_publications_official_draw_fkey" FOREIGN KEY ("competition_id", "official_draw_id") REFERENCES "official_draws"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "draw_publications" ADD CONSTRAINT "draw_publications_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
