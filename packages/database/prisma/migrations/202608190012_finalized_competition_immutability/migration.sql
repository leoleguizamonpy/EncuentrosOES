CREATE OR REPLACE FUNCTION prevent_finalized_competition_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_competition_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_competition_id := OLD.competition_id;
  ELSE
    target_competition_id := NEW.competition_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM competitions
    WHERE id = target_competition_id
      AND status = 'FINALIZED'
  ) THEN
    RAISE EXCEPTION 'Finalized competition evidence is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER competition_participants_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON competition_participants
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER draw_configurations_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON draw_configurations
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER official_draws_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON official_draws
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER draw_groups_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON draw_groups
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER draw_pairings_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON draw_pairings
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER matches_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON matches
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER match_results_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON match_results
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER group_standings_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON group_standings
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();

CREATE TRIGGER group_qualifications_finalized_immutability
BEFORE INSERT OR UPDATE OR DELETE ON group_qualifications
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_competition_mutation();
