#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)
DRILL="$ROOT_DIR/scripts/database/real-storage-drill.sh"
FAKE_TRANSPORT="$ROOT_DIR/scripts/database/test/fake-backup-transport.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

DUMMY_TRANSPORT="$TMP_DIR/backup-transport"
cat > "$DUMMY_TRANSPORT" <<'SH'
#!/usr/bin/env sh
exit 99
SH
chmod +x "$DUMMY_TRANSPORT" "$FAKE_TRANSPORT"

EVIDENCE_DIR="$TMP_DIR/evidence"

fail_case() {
  name="$1"
  expected="$2"
  shift 2
  stdout="$TMP_DIR/$name.stdout"
  stderr="$TMP_DIR/$name.stderr"
  rm -rf "$EVIDENCE_DIR"

  if "$@" >"$stdout" 2>"$stderr"; then
    echo "Expected failure but command succeeded: $name" >&2
    exit 1
  fi

  if ! grep -F "$expected" "$stderr" >/dev/null; then
    echo "Failure message mismatch for: $name" >&2
    cat "$stderr" >&2
    exit 1
  fi

  if [ -e "$EVIDENCE_DIR" ]; then
    echo "Evidence must not be created for rejected drill: $name" >&2
    exit 1
  fi

  echo "guard ok: $name"
}

base_env() {
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    "$@"
}

fail_case missing-database 'DATABASE_URL is required for REAL-STORAGE-DRILL.' \
  env -u DATABASE_URL \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

fail_case missing-provider-label 'BACKUP_PROVIDER_LABEL is required for REAL-STORAGE-DRILL.' \
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

fail_case privacy-not-confirmed 'REAL_STORAGE_PRIVATE_CONFIRMED must be exactly YES.' \
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    REAL_STORAGE_PRIVATE_CONFIRMED='NO' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

fail_case encryption-not-confirmed 'REAL_STORAGE_ENCRYPTED_CONFIRMED must be exactly YES.' \
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='NO' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

fail_case minimum-privilege-not-confirmed 'REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED must be exactly YES.' \
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='NO' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

fail_case fake-transport 'REAL-STORAGE-DRILL refuses the repository fake backup transport.' \
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$FAKE_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

fail_case fake-remote-dir 'REAL-STORAGE-DRILL refuses BACKUP_FAKE_REMOTE_DIR.' \
  env \
    DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
    BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
    BACKUP_REMOTE_PREFIX='oes-production' \
    BACKUP_RETENTION_DAYS='30' \
    BACKUP_PROVIDER_LABEL='local-guard-test' \
    BACKUP_FAKE_REMOTE_DIR="$TMP_DIR/fake-remote" \
    REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
    REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
    REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
    REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
    sh "$DRILL"

for prefix in 'file:./backup' '/tmp/backup' './backup' '../backup'; do
  safe_name=$(printf '%s' "$prefix" | tr '/:.' '___')
  fail_case "local-prefix-$safe_name" 'REAL-STORAGE-DRILL requires a remote storage prefix, not a local filesystem path.' \
    env \
      DATABASE_URL='postgresql://oes:oes@localhost:5432/oes?schema=public' \
      BACKUP_TRANSPORT_EXECUTABLE="$DUMMY_TRANSPORT" \
      BACKUP_REMOTE_PREFIX="$prefix" \
      BACKUP_RETENTION_DAYS='30' \
      BACKUP_PROVIDER_LABEL='local-guard-test' \
      REAL_STORAGE_PRIVATE_CONFIRMED='YES' \
      REAL_STORAGE_ENCRYPTED_CONFIRMED='YES' \
      REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED='YES' \
      REAL_STORAGE_EVIDENCE_DIR="$EVIDENCE_DIR" \
      sh "$DRILL"
done

# A non-local-looking configuration must reach the transport layer. The dummy
# transport exits 99; this proves the guards did not reject a valid shape while
# still preventing a local test from completing a fake REAL-STORAGE-DRILL.
stdout="$TMP_DIR/pass-shape.stdout"
stderr="$TMP_DIR/pass-shape.stderr"
rm -rf "$EVIDENCE_DIR"
set +e
base_env sh "$DRILL" >"$stdout" 2>"$stderr"
status=$?
set -e
if [ "$status" -ne 99 ]; then
  echo "Expected a valid-shaped drill to reach the dummy transport (exit 99), got $status." >&2
  cat "$stderr" >&2
  exit 1
fi
if [ -e "$EVIDENCE_DIR" ]; then
  echo "Evidence must not be created when the underlying round-trip fails." >&2
  exit 1
fi

echo 'REAL-STORAGE-DRILL local guard suite passed.'
