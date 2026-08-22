#!/usr/bin/env sh
set -eu

required_var() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is required for REAL-STORAGE-DRILL." >&2
    exit 1
  fi
}

required_var DATABASE_URL
required_var BACKUP_TRANSPORT_EXECUTABLE
required_var BACKUP_REMOTE_PREFIX
required_var BACKUP_RETENTION_DAYS
required_var BACKUP_PROVIDER_LABEL
required_var REAL_STORAGE_PRIVATE_CONFIRMED
required_var REAL_STORAGE_ENCRYPTED_CONFIRMED
required_var REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED

for confirmation in \
  REAL_STORAGE_PRIVATE_CONFIRMED \
  REAL_STORAGE_ENCRYPTED_CONFIRMED \
  REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED
do
  eval "value=\${$confirmation}"
  if [ "$value" != "YES" ]; then
    echo "$confirmation must be exactly YES." >&2
    exit 1
  fi
done

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

case "$BACKUP_TRANSPORT_EXECUTABLE" in
  *scripts/database/test/fake-backup-transport.sh)
    echo "REAL-STORAGE-DRILL refuses the repository fake backup transport." >&2
    exit 1
    ;;
esac

if [ -n "${BACKUP_FAKE_REMOTE_DIR:-}" ]; then
  echo "REAL-STORAGE-DRILL refuses BACKUP_FAKE_REMOTE_DIR." >&2
  exit 1
fi

case "$BACKUP_REMOTE_PREFIX" in
  file:*|/*|./*|../*)
    echo "REAL-STORAGE-DRILL requires a remote storage prefix, not a local filesystem path." >&2
    exit 1
    ;;
esac

case "$BACKUP_PROVIDER_LABEL" in
  *$'\n'*|*$'\r'*)
    echo "BACKUP_PROVIDER_LABEL must be a single line." >&2
    exit 1
    ;;
esac

if [ -z "${BACKUP_ID:-}" ]; then
  BACKUP_ID="$(date -u +%Y%m%dT%H%M%SZ)-real-storage"
  export BACKUP_ID
fi

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

sh scripts/database/roundtrip-drill.sh

COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EVIDENCE_DIR="${REAL_STORAGE_EVIDENCE_DIR:-./artifacts/database/real-storage-drill}"
mkdir -p "$EVIDENCE_DIR"
EVIDENCE_PATH="$EVIDENCE_DIR/$BACKUP_ID.json"

BACKUP_ID="$BACKUP_ID" \
BACKUP_PROVIDER_LABEL="$BACKUP_PROVIDER_LABEL" \
BACKUP_RETENTION_DAYS="$BACKUP_RETENTION_DAYS" \
STARTED_AT="$STARTED_AT" \
COMPLETED_AT="$COMPLETED_AT" \
node <<'NODE' > "$EVIDENCE_PATH"
const evidence = {
  schemaVersion: 'oes-real-storage-drill-evidence-v1',
  backupId: process.env.BACKUP_ID,
  provider: process.env.BACKUP_PROVIDER_LABEL,
  startedAt: process.env.STARTED_AT,
  completedAt: process.env.COMPLETED_AT,
  retentionDays: Number(process.env.BACKUP_RETENTION_DAYS),
  privateStorageConfirmed: true,
  encryptedStorageConfirmed: true,
  minimumPrivilegeConfirmed: true,
  uploadDownloadVerified: true,
  manifestAndSha256Verified: true,
  isolatedRestoreVerified: true,
};
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
NODE

echo "REAL-STORAGE-DRILL completed: $BACKUP_ID"
echo "Sanitized evidence written to: $EVIDENCE_PATH"
