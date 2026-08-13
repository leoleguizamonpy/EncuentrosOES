-- CreateTable
CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_role" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "competition_id" UUID,
    "revision_before" INTEGER,
    "revision_after" INTEGER,
    "correlation_id" UUID NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "resource_type" TEXT,
    "resource_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_entries_competition_id_occurred_at_idx" ON "audit_entries"("competition_id", "occurred_at" DESC);
CREATE INDEX "audit_entries_resource_type_resource_id_occurred_at_idx" ON "audit_entries"("resource_type", "resource_id", "occurred_at");
CREATE INDEX "audit_entries_correlation_id_idx" ON "audit_entries"("correlation_id");
CREATE UNIQUE INDEX "idempotency_records_actor_id_scope_idempotency_key_hash_key" ON "idempotency_records"("actor_id", "scope", "idempotency_key_hash");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks not expressible in Prisma Schema Language
ALTER TABLE "audit_entries"
  ADD CONSTRAINT "audit_entries_actor_role_check" CHECK ("actor_role" IN ('SYSTEM', 'ADMIN', 'SUPERADMIN', 'OPERATOR')),
  ADD CONSTRAINT "audit_entries_revision_before_check" CHECK ("revision_before" IS NULL OR "revision_before" > 0),
  ADD CONSTRAINT "audit_entries_revision_after_check" CHECK ("revision_after" IS NULL OR "revision_after" > 0);

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_status_check" CHECK ("status" IN ('PROCESSING', 'COMPLETED', 'FAILED_RETRYABLE')),
  ADD CONSTRAINT "idempotency_records_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "response_status" IS NOT NULL AND "response_body" IS NOT NULL)
    OR ("status" <> 'COMPLETED')
  );
