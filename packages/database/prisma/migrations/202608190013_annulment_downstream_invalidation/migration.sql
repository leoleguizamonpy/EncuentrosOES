-- A replaced draw remains historical frozen evidence. It must retain its hash,
-- authority and participant snapshot while ceasing to be the active round.
ALTER TABLE draw_configurations
  DROP CONSTRAINT draw_configurations_status_check,
  DROP CONSTRAINT draw_configurations_freeze_evidence_check;

ALTER TABLE draw_configurations
  ADD CONSTRAINT draw_configurations_status_check CHECK (
    status IN ('DRAFT', 'FROZEN', 'DISCARDED', 'REPLACED')
  ),
  ADD CONSTRAINT draw_configurations_freeze_evidence_check CHECK (
    (status = 'DRAFT' AND canonical_hash IS NULL AND frozen_at IS NULL AND frozen_by IS NULL)
    OR
    (status IN ('FROZEN', 'DISCARDED', 'REPLACED') AND canonical_hash IS NOT NULL AND frozen_at IS NOT NULL AND frozen_by IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION prevent_frozen_draw_participant_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT status INTO parent_status
  FROM draw_configurations
  WHERE id = OLD.draw_configuration_id;

  IF parent_status IN ('FROZEN', 'DISCARDED', 'REPLACED') THEN
    RAISE EXCEPTION 'Frozen draw participant snapshots are immutable';
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION invalidate_downstream_after_result_annulment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_round_number integer;
  first_invalid_round integer;
  affected_configurations integer := 0;
  affected_draws integer := 0;
  affected_results integer := 0;
  actor_role text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'CONFIRMED' OR NEW.status <> 'ANNULLED' THEN
    RETURN NEW;
  END IF;

  SELECT m.round_number,
         CASE WHEN m.group_id IS NOT NULL THEN 1 ELSE m.round_number + 1 END
    INTO source_round_number, first_invalid_round
  FROM matches m
  WHERE m.id = NEW.match_id;

  IF source_round_number IS NULL OR first_invalid_round IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role
  FROM users
  WHERE id = NEW.annulled_by;

  WITH invalid_configurations AS (
    SELECT id
    FROM draw_configurations
    WHERE competition_id = NEW.competition_id
      AND format_code = 'KNOCKOUT'
      AND round_number >= first_invalid_round
      AND status = 'FROZEN'
  ), invalid_draws AS (
    SELECT od.id
    FROM official_draws od
    JOIN invalid_configurations dc ON dc.id = od.configuration_id
    WHERE od.status IN ('PENDING_CONFIRMATION', 'CONFIRMED')
  ), invalid_matches AS (
    SELECT m.id
    FROM matches m
    JOIN invalid_draws d ON d.id = m.execution_id
  )
  UPDATE match_results mr
  SET status = 'ANNULLED',
      annulled_at = NEW.annulled_at,
      annulled_by = NEW.annulled_by,
      annulment_reason = 'Upstream competitive evidence was annulled.',
      revision = mr.revision + 1
  WHERE mr.match_id IN (SELECT id FROM invalid_matches)
    AND mr.status IN ('PENDING_CONFIRMATION', 'CONFIRMED');
  GET DIAGNOSTICS affected_results = ROW_COUNT;

  WITH invalid_configurations AS (
    SELECT id
    FROM draw_configurations
    WHERE competition_id = NEW.competition_id
      AND format_code = 'KNOCKOUT'
      AND round_number >= first_invalid_round
      AND status = 'FROZEN'
  ), invalid_draws AS (
    SELECT od.id
    FROM official_draws od
    JOIN invalid_configurations dc ON dc.id = od.configuration_id
    WHERE od.status IN ('PENDING_CONFIRMATION', 'CONFIRMED')
  )
  UPDATE matches m
  SET status = 'PENDING_RESULT',
      winner_participant_id = NULL
  WHERE m.execution_id IN (SELECT id FROM invalid_draws);

  WITH invalid_configurations AS (
    SELECT id
    FROM draw_configurations
    WHERE competition_id = NEW.competition_id
      AND format_code = 'KNOCKOUT'
      AND round_number >= first_invalid_round
      AND status = 'FROZEN'
  ), invalid_draws AS (
    SELECT od.id
    FROM official_draws od
    JOIN invalid_configurations dc ON dc.id = od.configuration_id
    WHERE od.status IN ('PENDING_CONFIRMATION', 'CONFIRMED')
  )
  UPDATE draw_publications publication
  SET status = 'REVOKED',
      revoked_at = NEW.annulled_at,
      revocation_reason = 'Upstream competitive evidence was annulled.',
      revision = publication.revision + 1
  WHERE publication.official_draw_id IN (SELECT id FROM invalid_draws)
    AND publication.status = 'PUBLISHED';

  WITH invalid_configurations AS (
    SELECT id
    FROM draw_configurations
    WHERE competition_id = NEW.competition_id
      AND format_code = 'KNOCKOUT'
      AND round_number >= first_invalid_round
      AND status = 'FROZEN'
  )
  UPDATE official_draws od
  SET status = 'ANNULLED',
      annulled_at = NEW.annulled_at,
      annulled_by = NEW.annulled_by,
      annulment_reason = 'Upstream competitive evidence was annulled.',
      revision = od.revision + 1
  WHERE od.configuration_id IN (SELECT id FROM invalid_configurations)
    AND od.status IN ('PENDING_CONFIRMATION', 'CONFIRMED');
  GET DIAGNOSTICS affected_draws = ROW_COUNT;

  UPDATE draw_configurations dc
  SET status = 'REPLACED',
      revision = dc.revision + 1,
      updated_at = NEW.annulled_at,
      updated_by = NEW.annulled_by
  WHERE dc.competition_id = NEW.competition_id
    AND dc.format_code = 'KNOCKOUT'
    AND dc.round_number >= first_invalid_round
    AND dc.status = 'FROZEN';
  GET DIAGNOSTICS affected_configurations = ROW_COUNT;

  IF affected_configurations > 0 OR affected_draws > 0 OR affected_results > 0 THEN
    UPDATE competitions
    SET revision = revision + 1,
        updated_at = NEW.annulled_at,
        updated_by = NEW.annulled_by
    WHERE id = NEW.competition_id
      AND status = 'LOCKED';

    INSERT INTO audit_entries (
      id,
      occurred_at,
      actor_id,
      actor_role,
      action_code,
      resource_type,
      resource_id,
      competition_id,
      correlation_id,
      reason,
      metadata
    ) VALUES (
      gen_random_uuid(),
      NEW.annulled_at,
      NEW.annulled_by,
      COALESCE(actor_role, 'SUPERADMIN'),
      'DOWNSTREAM_COMPETITIVE_STATE_INVALIDATED',
      'COMPETITION',
      NEW.competition_id,
      NEW.competition_id,
      gen_random_uuid(),
      'A confirmed source result was annulled.',
      jsonb_build_object(
        'sourceResultId', NEW.id,
        'sourceMatchId', NEW.match_id,
        'sourceRoundNumber', source_round_number,
        'firstInvalidRound', first_invalid_round,
        'configurationsInvalidated', affected_configurations,
        'drawsAnnulled', affected_draws,
        'resultsAnnulled', affected_results
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_results_downstream_invalidation
AFTER UPDATE OF status ON match_results
FOR EACH ROW
WHEN (OLD.status = 'CONFIRMED' AND NEW.status = 'ANNULLED')
EXECUTE FUNCTION invalidate_downstream_after_result_annulment();
