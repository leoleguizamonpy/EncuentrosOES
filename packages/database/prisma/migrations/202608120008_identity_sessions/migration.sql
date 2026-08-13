ALTER TABLE "users"
  ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "login_blocked_until" TIMESTAMPTZ(6),
  ADD CONSTRAINT "users_failed_login_count_check" CHECK ("failed_login_count" >= 0);

CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "csrf_hash" CHAR(64) NOT NULL,
  "credential_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "idle_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_sessions_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "user_sessions_credential_version_check" CHECK ("credential_version" > 0),
  CONSTRAINT "user_sessions_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "user_sessions_expiry_check" CHECK (
    "created_at" <= "last_seen_at" AND
    "last_seen_at" < "idle_expires_at" AND
    "idle_expires_at" <= "expires_at"
  ),
  CONSTRAINT "user_sessions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
