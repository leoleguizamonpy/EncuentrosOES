#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [ "${1:-}" = "--" ]; then
  shift
fi

BACKUP_PATH="${1:-./artifacts/database/oes.dump}"
RESTORE_DB_NAME="${RESTORE_DB_NAME:-oes_restore}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
DATABASE_URL_LIBPQ="${DATABASE_URL%%\?*}"
BACKUP_DIR=$(dirname "$BACKUP_PATH")
BACKUP_FILE=$(basename "$BACKUP_PATH")

case "$RESTORE_DB_NAME" in
  ''|*[!A-Za-z0-9_]*)
    echo "RESTORE_DB_NAME may contain only letters, numbers and underscores." >&2
    exit 1
    ;;
esac

SERVER_URL=$(printf '%s' "$DATABASE_URL_LIBPQ" | sed -E 's#/[^/]+$#/postgres#')
RESTORE_URL=$(printf '%s' "$DATABASE_URL_LIBPQ" | sed -E "s#/[^/]+$#/$RESTORE_DB_NAME#")

if [ ! -f "$BACKUP_PATH" ] || [ ! -f "$BACKUP_PATH.sha256" ]; then
  echo "Backup and checksum are required before restore." >&2
  exit 1
fi

sha256sum --check "$BACKUP_PATH.sha256"

docker run --rm --network host "$POSTGRES_IMAGE" \
  psql "$SERVER_URL" --set=ON_ERROR_STOP=1 --command="DROP DATABASE IF EXISTS \"$RESTORE_DB_NAME\" WITH (FORCE);"

docker run --rm --network host "$POSTGRES_IMAGE" \
  psql "$SERVER_URL" --set=ON_ERROR_STOP=1 --command="CREATE DATABASE \"$RESTORE_DB_NAME\";"

cleanup() {
  docker run --rm --network host "$POSTGRES_IMAGE" \
    psql "$SERVER_URL" --set=ON_ERROR_STOP=1 --command="DROP DATABASE IF EXISTS \"$RESTORE_DB_NAME\" WITH (FORCE);" >/dev/null
}
trap cleanup EXIT INT TERM

docker run --rm --network host \
  -v "$(cd "$BACKUP_DIR" && pwd):/backup:ro" \
  "$POSTGRES_IMAGE" \
  pg_restore \
  --dbname="$RESTORE_URL" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "/backup/$BACKUP_FILE"

SENTINEL_COUNT=$(docker run --rm --network host "$POSTGRES_IMAGE" \
  psql "$RESTORE_URL" --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command="SELECT count(*) FROM backup_restore_sentinel WHERE id = 'backup-drill';")

if [ "$SENTINEL_COUNT" != "1" ]; then
  echo "Restore verification failed: sentinel row was not restored exactly once." >&2
  exit 1
fi

MIGRATION_COUNT=$(docker run --rm --network host "$POSTGRES_IMAGE" \
  psql "$RESTORE_URL" --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command='SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;')

if [ "$MIGRATION_COUNT" -lt 13 ]; then
  echo "Restore verification failed: migration history is incomplete." >&2
  exit 1
fi

echo "Restore drill passed: sentinel and migration history verified in isolated database $RESTORE_DB_NAME."
