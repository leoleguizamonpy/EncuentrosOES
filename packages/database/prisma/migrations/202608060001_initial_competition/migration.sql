Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email_normalized" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modalities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "modalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sport_modalities" (
    "event_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "modality_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "event_sport_modalities_pkey" PRIMARY KEY ("event_id","sport_id","modality_id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "edition_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "modality_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "format_code" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "finalized_at" TIMESTAMPTZ(6),
    "finalized_by" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "enabled_at" TIMESTAMPTZ(6) NOT NULL,
    "enabled_by" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "competition_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "editions_year_key" ON "editions"("year");

-- CreateIndex
CREATE UNIQUE INDEX "events_code_key" ON "events"("code");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_event_id_code_key" ON "institutions"("event_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_event_id_normalized_name_key" ON "institutions"("event_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_event_id_id_key" ON "institutions"("event_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sports_code_key" ON "sports"("code");

-- CreateIndex
CREATE UNIQUE INDEX "modalities_code_key" ON "modalities"("code");

-- CreateIndex
CREATE INDEX "competitions_edition_id_event_id_status_idx" ON "competitions"("edition_id", "event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_edition_id_event_id_sport_id_modality_id_key" ON "competitions"("edition_id", "event_id", "sport_id", "modality_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_event_id_id_key" ON "competitions"("event_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "competition_participants_competition_id_institution_id_key" ON "competition_participants"("competition_id", "institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "competition_participants_competition_id_id_key" ON "competition_participants"("competition_id", "id");

-- AddForeignKey
ALTER TABLE "editions" ADD CONSTRAINT "editions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editions" ADD CONSTRAINT "editions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sport_modalities" ADD CONSTRAINT "event_sport_modalities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sport_modalities" ADD CONSTRAINT "event_sport_modalities_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sport_modalities" ADD CONSTRAINT "event_sport_modalities_modality_id_fkey" FOREIGN KEY ("modality_id") REFERENCES "modalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_event_id_sport_id_modality_id_fkey" FOREIGN KEY ("event_id", "sport_id", "modality_id") REFERENCES "event_sport_modalities"("event_id", "sport_id", "modality_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_event_id_competition_id_fkey" FOREIGN KEY ("event_id", "competition_id") REFERENCES "competitions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_event_id_institution_id_fkey" FOREIGN KEY ("event_id", "institution_id") REFERENCES "institutions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_enabled_by_fkey" FOREIGN KEY ("enabled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks not expressible in Prisma Schema Language
ALTER TABLE "users"
  ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('ACTIVE', 'DISABLED', 'LOCKED')),
  ADD CONSTRAINT "users_credential_version_check" CHECK ("credential_version" > 0),
  ADD CONSTRAINT "users_display_name_check" CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 120);

CREATE UNIQUE INDEX "users_email_normalized_lower_key"
  ON "users" (lower("email_normalized"));

ALTER TABLE "editions"
  ADD CONSTRAINT "editions_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
  ADD CONSTRAINT "editions_status_check" CHECK ("status" IN ('DRAFT', 'OPEN', 'CLOSED')),
  ADD CONSTRAINT "editions_revision_check" CHECK ("revision" > 0);

ALTER TABLE "institutions"
  ADD CONSTRAINT "institutions_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "institutions_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 160);

ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_status_check" CHECK ("status" IN ('DRAFT', 'OPEN', 'LOCKED', 'FINALIZED')),
  ADD CONSTRAINT "competitions_format_check" CHECK ("format_code" IS NULL OR "format_code" IN ('GROUP_STAGE', 'KNOCKOUT')),
  ADD CONSTRAINT "competitions_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "competitions_lock_evidence_check" CHECK (
    ("status" IN ('DRAFT', 'OPEN') AND "locked_at" IS NULL AND "locked_by" IS NULL)
    OR
    ("status" IN ('LOCKED', 'FINALIZED') AND "locked_at" IS NOT NULL AND "locked_by" IS NOT NULL)
  ),
  ADD CONSTRAINT "competitions_finalization_evidence_check" CHECK (
    ("status" <> 'FINALIZED' AND "finalized_at" IS NULL AND "finalized_by" IS NULL)
    OR
    ("status" = 'FINALIZED' AND "finalized_at" IS NOT NULL AND "finalized_by" IS NOT NULL)
  );

ALTER TABLE "competition_participants"
  ADD CONSTRAINT "competition_participants_status_check" CHECK ("status" IN ('ENABLED', 'WITHDRAWN')),
  ADD CONSTRAINT "competition_participants_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "competition_participants_display_name_check" CHECK (
    char_length(btrim("display_name")) BETWEEN 1 AND 120
  );

