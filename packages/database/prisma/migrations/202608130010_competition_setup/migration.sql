ALTER TABLE "competitions"
  ADD COLUMN "group_count" INTEGER;

ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_format_group_count_check"
  CHECK (
    ("format_code" IS NULL AND "group_count" IS NULL)
    OR ("format_code" = 'KNOCKOUT' AND "group_count" IS NULL)
    OR ("format_code" = 'GROUP_STAGE' AND "group_count" > 0)
  );
