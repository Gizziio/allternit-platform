#!/bin/sh
# Nightly pg_dump shipped to MinIO with retention pruning. Runs in a loop
# inside the postgres:16-alpine image (pg_dump + busybox wget available).
set -eu

while :; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="/tmp/registry-${stamp}.sql.gz"
  echo "[backup] starting pg_dump -> $file"
  if pg_dump --no-owner --no-privileges | gzip > "$file"; then
    # Upload with the MinIO client installed on first run.
    if ! command -v mc >/dev/null 2>&1; then
      wget -q -O /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc \
        && chmod +x /usr/local/bin/mc
    fi
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    if mc cp "$file" "local/$MINIAPP_BACKUP_BUCKET/postgres/"; then
      echo "[backup] uploaded registry-${stamp}.sql.gz"
    else
      echo "[backup] upload FAILED" >&2
    fi
    # Prune backups older than the retention window.
    mc find "local/$MINIAPP_BACKUP_BUCKET/postgres/" \
      --older-than "${BACKUP_RETENTION_DAYS}d" --exec "mc rm {}" 2>/dev/null || true
  else
    echo "[backup] pg_dump FAILED" >&2
  fi
  rm -f "$file"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
