#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi
if [ -z "${BACKUP_TRANSPORT_EXECUTABLE:-}" ]; then
  echo "BACKUP_TRANSPORT_EXECUTABLE is required." >&2
  exit 1
fi
if [ -z "${BACKUP_REMOTE_PREFIX:-}" ]; then
  echo "BACKUP_REMOTE_PREFIX is required." >&2
  exit 1
fi
if [ -z "${BACKUP_RETENTION_DAYS:-}" ]; then
  echo "BACKUP_RETENTION_DAYS is required." >&2
  exit 1
fi

case "$BACKUP_TRANSPORT_EXECUTABLE" in
  /*) ;;
  *)
    echo "BACKUP_TRANSPORT_EXECUTABLE must be an absolute path." >&2
    exit 1
    ;;
esac

if [ ! -x "$BACKUP_TRANSPORT_EXECUTABLE" ]; then
  echo "BACKUP_TRANSPORT_EXECUTABLE must point to an executable file." >&2
  exit 1
fi

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*)
    echo "BACKUP_RETENTION_DAYS must be an integer between 1 and 3650." >&2
    exit 1
    ;;
esac
if [ "$BACKUP_RETENTION_DAYS" -lt 1 ] || [ "$BACKUP_RETENTION_DAYS" -gt 3650 ]; then
  echo "BACKUP_RETENTION_DAYS must be an integer between 1 and 3650." >&2
  exit 1
fi

case "$BACKUP_REMOTE_PREFIX" in
  *'@'*|*'?'*|*'#'*)
    echo "BACKUP_REMOTE_PREFIX must not contain credentials, query or fragment data." >&2
    exit 1
    ;;
esac

OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-./artifacts/database/production}"
BACKUP_ID="${BACKUP_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
case "$BACKUP_ID" in
  ''|*[!A-Za-z0-9._-]*)
    echo "BACKUP_ID may contain only letters, numbers, dot, underscore and hyphen." >&2
    exit 1
    ;;
esac

DUMP_PATH="$OUTPUT_DIR/$BACKUP_ID.dump"
CHECKSUM_PATH="$DUMP_PATH.sha256"
MANIFEST_PATH="$OUTPUT_DIR/$BACKUP_ID.manifest.json"

sh scripts/database/backup.sh "$DUMP_PATH"
SHA256=$(awk '{print $1}' "$CHECKSUM_PATH")
CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

BACKUP_ID="$BACKUP_ID" \
BACKUP_CREATED_AT="$CREATED_AT" \
BACKUP_DUMP_FILE="$(basename "$DUMP_PATH")" \
BACKUP_CHECKSUM_FILE="$(basename "$CHECKSUM_PATH")" \
BACKUP_SHA256="$SHA256" \
BACKUP_RETENTION_DAYS="$BACKUP_RETENTION_DAYS" \
node <<'NODE' > "$MANIFEST_PATH"
const manifest = {
  schemaVersion: 'oes-backup-manifest-v1',
  backupId: process.env.BACKUP_ID,
  createdAt: process.env.BACKUP_CREATED_AT,
  dumpFile: process.env.BACKUP_DUMP_FILE,
  checksumFile: process.env.BACKUP_CHECKSUM_FILE,
  sha256: process.env.BACKUP_SHA256,
  retentionDays: Number(process.env.BACKUP_RETENTION_DAYS),
};
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
NODE

REMOTE_BASE="${BACKUP_REMOTE_PREFIX%/}/$BACKUP_ID"
"$BACKUP_TRANSPORT_EXECUTABLE" upload "$DUMP_PATH" "$REMOTE_BASE.dump" "$SHA256"
"$BACKUP_TRANSPORT_EXECUTABLE" upload "$CHECKSUM_PATH" "$REMOTE_BASE.dump.sha256" "$SHA256"
"$BACKUP_TRANSPORT_EXECUTABLE" upload "$MANIFEST_PATH" "$REMOTE_BASE.manifest.json" "$SHA256"
"$BACKUP_TRANSPORT_EXECUTABLE" retain "${BACKUP_REMOTE_PREFIX%/}" "$BACKUP_RETENTION_DAYS"

echo "External backup published: $BACKUP_ID"
echo "Retention requested: $BACKUP_RETENTION_DAYS days"
