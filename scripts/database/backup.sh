#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

OUTPUT_PATH="${1:-./artifacts/database/oes.dump}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
DATABASE_URL_LIBPQ="${DATABASE_URL%%\?*}"
OUTPUT_DIR=$(dirname "$OUTPUT_PATH")
OUTPUT_FILE=$(basename "$OUTPUT_PATH")
TEMP_FILE=".${OUTPUT_FILE}.tmp"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR/$TEMP_FILE"

docker run --rm --network host \
  -v "$(cd "$OUTPUT_DIR" && pwd):/backup" \
  "$POSTGRES_IMAGE" \
  pg_dump \
  --dbname="$DATABASE_URL_LIBPQ" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="/backup/$TEMP_FILE"

mv "$OUTPUT_DIR/$TEMP_FILE" "$OUTPUT_PATH"
sha256sum "$OUTPUT_PATH" > "$OUTPUT_PATH.sha256"

echo "Backup created: $OUTPUT_PATH"
echo "Checksum created: $OUTPUT_PATH.sha256"
