-- Foundation 2.1 allows an active SUPERADMIN to originate and explicitly
-- confirm the same critical operation. The original database CHECK constraints
-- predated that policy and rejected every same-actor confirmation before the
-- application/domain authority checks could be persisted.

ALTER TABLE "official_draws"
  DROP CONSTRAINT IF EXISTS "official_draws_separation_check";

ALTER TABLE "match_results"
  DROP CONSTRAINT IF EXISTS "match_results_separation_check";

ALTER TABLE "group_qualifications"
  DROP CONSTRAINT IF EXISTS "group_qualifications_separation_check";

CREATE OR REPLACE FUNCTION enforce_superadmin_self_confirmation() RETURNS trigger AS $$
DECLARE
  originator UUID;
  confirmer UUID;
  confirmer_role TEXT;
  confirmer_status TEXT;
BEGIN
  originator := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '')::UUID;
  confirmer := NULLIF(to_jsonb(NEW) ->> TG_ARGV[1], '')::UUID;

  IF confirmer IS NULL OR originator IS NULL OR confirmer <> originator THEN
    RETURN NEW;
  END IF;

  SELECT "role", "status"
    INTO confirmer_role, confirmer_status
    FROM "users"
    WHERE "id" = confirmer;

  IF confirmer_role IS DISTINCT FROM 'SUPERADMIN' OR confirmer_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'self-confirmation requires an active SUPERADMIN';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "official_draws_self_confirmation_guard" ON "official_draws";
CREATE TRIGGER "official_draws_self_confirmation_guard"
  BEFORE INSERT OR UPDATE OF "executed_by", "confirmed_by" ON "official_draws"
  FOR EACH ROW EXECUTE FUNCTION enforce_superadmin_self_confirmation('executed_by', 'confirmed_by');

DROP TRIGGER IF EXISTS "match_results_self_confirmation_guard" ON "match_results";
CREATE TRIGGER "match_results_self_confirmation_guard"
  BEFORE INSERT OR UPDATE OF "recorded_by", "confirmed_by" ON "match_results"
  FOR EACH ROW EXECUTE FUNCTION enforce_superadmin_self_confirmation('recorded_by', 'confirmed_by');

DROP TRIGGER IF EXISTS "group_qualifications_self_confirmation_guard" ON "group_qualifications";
CREATE TRIGGER "group_qualifications_self_confirmation_guard"
  BEFORE INSERT OR UPDATE OF "proposed_by", "confirmed_by" ON "group_qualifications"
  FOR EACH ROW EXECUTE FUNCTION enforce_superadmin_self_confirmation('proposed_by', 'confirmed_by');
