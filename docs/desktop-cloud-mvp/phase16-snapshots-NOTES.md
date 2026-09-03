# Phase 16 — Persistent disk snapshots and S3 backups

## Goal
Let users checkpoint a bot desktop at the Incus volume level, list/restore/delete
checkpoints through the unified API, and export full instance backups to the
S3-compatible object store running on the VPS.

## What changed
- Added snapshot primitives to the `Substrate`/`ExecutionDriver` traits in
  `platform/contracts/driver-interface` and implemented them in
  `cmd/allternit-computer-cloud/src/substrate.rs` (`IncusSubstrate`) and
  `cmd/allternit-computer-cloud/src/driver.rs` (`IncusDriver`).
- Added `cmd/allternit-api/src/bot_desktop_snapshots.rs` exposing:
  - `POST   /api/v1/bots/:bot_id/desktop/snapshots`
  - `GET    /api/v1/bots/:bot_id/desktop/snapshots`
  - `POST   /api/v1/bots/:bot_id/desktop/snapshots/:snapshot_id/restore`
  - `DELETE /api/v1/bots/:bot_id/desktop/snapshots/:snapshot_id`
- Wired the new routes into `cmd/allternit-api/src/bot_desktop_routes.rs`.
- Added `cmd/allternit-computer-cloud/guest/backup-to-s3.sh`.
  - Exports an Incus instance to a gzip-compressed tarball.
  - Configures its own `mc` alias from `S3_ENDPOINT`, `S3_ACCESS_KEY`,
    `S3_SECRET_KEY` so it does not depend on a preconfigured alias.
  - Uploads the tarball to the configured bucket and verifies the object with
    `mc stat` before exiting.
- MinIO is running on the VPS at `127.0.0.1:9000` with bucket
  `allternit-desktop-backups`.

## Test results
```
cargo test -p allternit-computer-cloud
  18 passed; 0 failed

cargo test -p allternit-api bot_desktop
  26 passed; 0 failed
```

## End-to-end proof
Screen recording: `phase16-snapshots-proof.webm`.
Demonstrates:
1. `POST /api/v1/bots/:bot_id/desktop/snapshots` returning a new `snapshot_id`.
2. `GET /api/v1/bots/:bot_id/desktop/snapshots` listing the created snapshot.
3. `DELETE /api/v1/bots/:bot_id/desktop/snapshots/:snapshot_id` removing it.
4. `backup-to-s3.sh <instance_name> <backup_name>` on the Incus host exporting
   an ~834 MiB tarball and uploading it to MinIO.
5. `mc ls -r allternit/allternit-desktop-backups` showing the persisted backup
   object and `mc stat` confirming its size.

## Known limitations / next steps
- Snapshot list currently extracts only the snapshot name from Incus; timestamp
  and stateful flags can be enriched by fetching each snapshot's metadata.
- Backups are triggered by running the script on the Incus host. A future phase
  can wire the script into a control-plane job queue so users can request
  backups through the API directly.
- Phase 17 replaces local-dev auth with production auth and audit logging.
