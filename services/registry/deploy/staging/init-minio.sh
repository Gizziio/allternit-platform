#!/bin/sh
# Create the quarantine/published/backup buckets. Quarantine is private;
# published objects are served only through presigned URLs as well — nothing
# is world-readable.
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

for bucket in "$MINIAPP_ASSETS_QUARANTINE_BUCKET" "$MINIAPP_ASSETS_BUCKET" "$MINIAPP_BACKUP_BUCKET"; do
  mc mb --ignore-existing "local/$bucket"
done

# Object lock / versioning is intentionally NOT enabled on the published
# bucket: asset keys are content-addressed (sha256), so immutability is a
# property of the key namespace.
echo "buckets ready: $MINIAPP_ASSETS_QUARANTINE_BUCKET $MINIAPP_ASSETS_BUCKET $MINIAPP_BACKUP_BUCKET"
