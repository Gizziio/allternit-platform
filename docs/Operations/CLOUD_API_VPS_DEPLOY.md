# Allternit Cloud API — VPS Deploy Runbook

**Server:** `mail` (Contabo control plane, api.allternit.com) via `ssh root@mail` (Tailscale SSH).
**Binary:** `/opt/allternit-cloud-api/bin/allternit-cloud-api`, systemd unit `allternit-cloud-api`, port 8082 (nginx fronts 443 → 8082).
**Build tree:** `/opt/allternit-build` (full repo checkout — NOT `/opt/allternit-src`, stale Fly-era).
**Env:** `/opt/allternit-cloud-api/.env` (chmod 600). Prod DB: `sudo -u postgres psql -d allternit`.

## Deploy loop

**Prefer the codified script: `scripts/deploy-cloud-api.sh`** (from the repo root; `--fast` skips tests, `--dry-run` prints steps). It runs the loop below and *verifies the swap* — the check that catches a stale binary. The manual steps remain for reference:

1. `rsync -a --partial --timeout=60 cmd/allternit-cloud-api/{src,tests,migrations_pg,migrations}/ root@mail:/opt/allternit-build/cmd/allternit-cloud-api/...` (mirror each dir; touch any changed `.rs` files on mail — rsync `-a` preserves mtimes and cargo skips otherwise).
2. Apply schema manually — there is no migration runner:
   `ssh root@mail "sudo -u postgres psql -d allternit -v ON_ERROR_STOP=1 -f /opt/allternit-build/cmd/allternit-cloud-api/migrations_pg/00X.sql"`.
   After any `ALTER TYPE` (or on sqlx cached-plan errors) restart the service.
3. **Build the binary — `cargo test --release --lib` does NOT refresh it** (2026-09-03 incident: three consecutive deploys copied a stale 07:26 binary because the loop skipped the bin build; the guards/pricing fix/broker were not actually live for hours). Required, in order:
   ```bash
   cargo build --release -p allternit-cloud-api      # refreshes target/release/allternit-cloud-api
   cargo test --release -p allternit-cloud-api --lib # suite (known local-only failure: contabo_runtime_service provision test, no docker on mac; passes on mail)
   ```
4. Swap + restart:
   `systemctl stop allternit-cloud-api && cp target/release/allternit-cloud-api /opt/allternit-cloud-api/bin/ && systemctl start allternit-cloud-api`
5. **Verify the swap actually took** (do not skip — this is what catches a stale binary):
   - `ls -la target/release/allternit-cloud-api` — mtime must be now, size should track recent builds.
   - `curl -s localhost:8082/api/v1/health` → `{"status":"healthy"}`.
   - Check for the new feature's startup log line (e.g. `Inference pools seeded: ...`).
   - New DB objects present when applicable (e.g. `SELECT * FROM inference_pools;`).
   - `journalctl -u allternit-cloud-api --since "2 min ago" -p err` — no new errors.

## Adjacent operational facts

- Builds take 2–4 min; run over ssh in a background task with no timeout. Long test runs: `nohup` on the server + poll journal.
- Standby VPS `allternit-standby` (31.220.95.165) uses `~/.ssh/id_ed25519_gizziio` (Tailscale SSH disabled there); PG streaming replica — schema changes replicate automatically, apply migrations on `mail` only. Failover: `docs/Operations/FAILOVER_RUNBOOK.md`.
- Billing smoke tests: webhook signature recipe + credit_transactions FK notes in the session handoff; smoke users must be inserted into `users` first (CASCADE cleanup).
- Reconciliation timer: `reconcile-billing.timer` (daily, /usr/local/bin + /etc/systemd/system, files in `infrastructure/cloud/`).
