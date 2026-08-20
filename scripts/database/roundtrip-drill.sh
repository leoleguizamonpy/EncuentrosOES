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

if [ -z "${BACKUP_ID:-}" ]; then
  BACKUP_ID="$(date -u +%Y%m%dT%H%M%SZ)-roundtrip"
  export BACKUP_ID
fi

sh scripts/database/backup-publish.sh
sh scripts/database/remote-restore-drill.sh

echo "External backup round-trip drill completed: $BACKUP_ID"
