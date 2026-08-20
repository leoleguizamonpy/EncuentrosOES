#!/usr/bin/env sh
set -eu

if [ -z "${BACKUP_FAKE_REMOTE_DIR:-}" ]; then
  echo "BACKUP_FAKE_REMOTE_DIR is required." >&2
  exit 1
fi

command_name="${1:-}"
case "$command_name" in
  upload)
    source_path="${2:-}"
    remote_path="${3:-}"
    expected_sha="${4:-}"
    if [ ! -f "$source_path" ] || [ -z "$remote_path" ] || [ -z "$expected_sha" ]; then
      echo "Invalid upload contract." >&2
      exit 1
    fi
    destination="$BACKUP_FAKE_REMOTE_DIR/$remote_path"
    mkdir -p "$(dirname "$destination")"
    cp "$source_path" "$destination"
    printf '%s\n' "$remote_path" >> "$BACKUP_FAKE_REMOTE_DIR/uploads.log"
    ;;
  retain)
    remote_prefix="${2:-}"
    retention_days="${3:-}"
    if [ -z "$remote_prefix" ] || [ -z "$retention_days" ]; then
      echo "Invalid retention contract." >&2
      exit 1
    fi
    printf '%s %s\n' "$remote_prefix" "$retention_days" > "$BACKUP_FAKE_REMOTE_DIR/retention.log"
    ;;
  *)
    echo "Unsupported backup transport command." >&2
    exit 1
    ;;
esac
