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
if [ -z "${BACKUP_ID:-}" ]; then
  echo "BACKUP_ID is required." >&2
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
case "$BACKUP_REMOTE_PREFIX" in
  *'@'*|*'?'*|*'#'*)
    echo "BACKUP_REMOTE_PREFIX must not contain credentials, query or fragment data." >&2
    exit 1
    ;;
esac
case "$BACKUP_ID" in
  ''|*[!A-Za-z0-9._-]*)
    echo "BACKUP_ID may contain only letters, numbers, dot, underscore and hyphen." >&2
    exit 1
    ;;
esac

OUTPUT_DIR="${BACKUP_REMOTE_RESTORE_DIR:-./artifacts/database/remote-restore/$BACKUP_ID}"
mkdir -p "$OUTPUT_DIR"
DUMP_PATH="$OUTPUT_DIR/$BACKUP_ID.dump"
CHECKSUM_PATH="$DUMP_PATH.sha256"
MANIFEST_PATH="$OUTPUT_DIR/$BACKUP_ID.manifest.json"
REMOTE_BASE="${BACKUP_REMOTE_PREFIX%/}/$BACKUP_ID"

"$BACKUP_TRANSPORT_EXECUTABLE" download "$REMOTE_BASE.manifest.json" "$MANIFEST_PATH"
"$BACKUP_TRANSPORT_EXECUTABLE" download "$REMOTE_BASE.dump.sha256" "$CHECKSUM_PATH"
"$BACKUP_TRANSPORT_EXECUTABLE" download "$REMOTE_BASE.dump" "$DUMP_PATH"

BACKUP_ID="$BACKUP_ID" \
DUMP_FILE="$(basename "$DUMP_PATH")" \
CHECKSUM_FILE="$(basename "$CHECKSUM_PATH")" \
MANIFEST_PATH="$MANIFEST_PATH" \
node <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST_PATH, 'utf8'));
const expected = {
  schemaVersion: 'oes-backup-manifest-v1',
  backupId: process.env.BACKUP_ID,
  dumpFile: process.env.DUMP_FILE,
  checksumFile: process.env.CHECKSUM_FILE,
};
for (const [key, value] of Object.entries(expected)) {
  if (manifest[key] !== value) throw new Error(`Backup manifest ${key} does not match the requested remote object.`);
}
if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
  throw new Error('Backup manifest SHA-256 is invalid.');
}
if (!Number.isInteger(manifest.retentionDays) || manifest.retentionDays < 1 || manifest.retentionDays > 3650) {
  throw new Error('Backup manifest retention policy is invalid.');
}
NODE

CHECKSUM_SHA=$(awk 'NR==1 {print $1}' "$CHECKSUM_PATH")
MANIFEST_SHA=$(MANIFEST_PATH="$MANIFEST_PATH" node -e "const fs=require('node:fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.env.MANIFEST_PATH,'utf8')).sha256)")
if [ "$CHECKSUM_SHA" != "$MANIFEST_SHA" ]; then
  echo "Remote checksum does not match the backup manifest." >&2
  exit 1
fi
(cd "$OUTPUT_DIR" && sha256sum --check "$(basename "$CHECKSUM_PATH")")

sh scripts/database/restore-drill.sh "$DUMP_PATH"

echo "Remote backup restore drill completed: $BACKUP_ID"
