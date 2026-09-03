#!/bin/bash
# Back up an Incus instance to an S3-compatible object store.
# Run this on the Incus host.
#
# Usage:
#   export S3_ENDPOINT=https://s3.example.com
#   export S3_ACCESS_KEY=...
#   export S3_SECRET_KEY=...
#   export S3_BUCKET=allternit-desktop-backups
#   backup-to-s3.sh <instance_name> [backup_name]

set -euo pipefail

INSTANCE="${1:-}"
BACKUP_NAME="${2:-${INSTANCE}-$(date +%Y%m%d-%H%M%S)}"

S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-minioadmin}"
S3_SECRET_KEY="${S3_SECRET_KEY:-minioadmin}"
S3_BUCKET="${S3_BUCKET:-allternit-desktop-backups}"
WORK_DIR="${WORK_DIR:-/tmp/allternit-backups}"

if [ -z "$INSTANCE" ]; then
    echo "ERROR: instance name required" >&2
    exit 1
fi

mkdir -p "$WORK_DIR"
TARBALL="${WORK_DIR}/${BACKUP_NAME}.tar.gz"

log() {
    echo "[backup-to-s3] $*"
}

cleanup() {
    rm -f "$TARBALL"
}
trap cleanup EXIT

# Ensure the MinIO/S3 alias exists in this shell. This makes the script
# self-contained and avoids silent failures when run as root on the Incus host.
mc alias set allternit "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" --api s3v4 >/dev/null

log "exporting Incus instance $INSTANCE to $TARBALL"
incus export "$INSTANCE" "$TARBALL" --instance-only --compression=gzip

log "checking S3 bucket $S3_BUCKET"
if ! mc ls "allternit/$S3_BUCKET" >/dev/null 2>&1; then
    log "creating bucket $S3_BUCKET"
    mc mb "allternit/$S3_BUCKET"
fi

log "uploading $TARBALL to s3://$S3_BUCKET/${BACKUP_NAME}.tar.gz"
mc cp "$TARBALL" "allternit/$S3_BUCKET/${BACKUP_NAME}.tar.gz"

# Verify the object actually persisted (catches silent multipart failures).
if ! mc stat "allternit/$S3_BUCKET/${BACKUP_NAME}.tar.gz" >/dev/null 2>&1; then
    log "ERROR: uploaded object is missing from bucket" >&2
    exit 1
fi

log "backup complete: s3://$S3_BUCKET/${BACKUP_NAME}.tar.gz"
