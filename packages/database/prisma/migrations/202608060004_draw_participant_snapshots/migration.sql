-- Draw evidence must freeze the exact participant set, not only its count.
CREATE UNIQUE INDEX "draw_configurations_competition_id_id_key"
  ON "draw_configurations"("competition_id", "id");

CREATE TABLE "draw_configuration_participants" (
    "draw_configuration_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "competition_participant_id" UUID NOT NULL,
    "canonical_order" INTEGER NOT NULL,
    "display_name_snapshot" TEXT NOT NULL,
    "bye_count_snapshot" INTEGER NOT NULL,

    CONSTRAINT "draw_configuration_participants_pkey"
      PRIMARY KEY ("draw_configuration_id", "competition_participant_id")
);

CREATE UNIQUE INDEX "draw_configuration_participants_order_key"
  ON "draw_configuration_participants"("draw_configuration_id", "canonical_order");

ALTER TABLE "draw_configuration_participants"
  ADD CONSTRAINT "draw_configuration_participants_configuration_fkey"
  FOREIGN KEY ("competition_id", "draw_configuration_id")
  REFERENCES "draw_configurations"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configuration_participants"
  ADD CONSTRAINT "draw_configuration_participants_participant_fkey"
  FOREIGN KEY ("competition_id", "competition_participant_id")
  REFERENCES "competition_participants"("competition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_configuration_participants"
  ADD CONSTRAINT "draw_configuration_participants_order_check" CHECK ("canonical_order" > 0),
  ADD CONSTRAINT "draw_configuration_participants_bye_count_check" CHECK ("bye_count_snapshot" >= 0),
  ADD CONSTRAINT "draw_configuration_participants_name_check" CHECK (
    char_length(btrim("display_name_snapshot")) BETWEEN 1 AND 120
  );

CREATE FUNCTION prevent_frozen_draw_participant_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT "status" INTO parent_status
  FROM "draw_configurations"
  WHERE "id" = OLD."draw_configuration_id";

  IF parent_status IN ('FROZEN', 'DISCARDED') THEN
    RAISE EXCEPTION 'Frozen draw participant snapshots are immutable';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER "draw_participants_immutable_when_frozen"
BEFORE UPDATE OR DELETE ON "draw_configuration_participants"
FOR EACH ROW EXECUTE FUNCTION prevent_frozen_draw_participant_mutation();
