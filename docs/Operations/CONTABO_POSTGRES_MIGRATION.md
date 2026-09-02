# Allternit Cloud Backend Migration: Contabo + Postgres

## Overview

The Allternit Cloud control plane has been migrated off Fly.io onto a Contabo VPS (`mail`, 100.108.37.126) with PostgreSQL as the production database. This document describes the architecture, migration steps, and operational procedures.

## Architecture

### Control Plane

- **Host**: Contabo VPS `mail` (100.108.37.126), Ubuntu 24.04
- **API Binary**: `/opt/allternit-cloud-api/bin/allternit-cloud-api`
- **Service**: `allternit-cloud-api.service` (systemd)
- **Public Endpoint**: `https://api.allternit.com` (nginx + Let's Encrypt + Cloudflare)
- **Database**: PostgreSQL 16, database `allternit`, user `allternit`
- **Monitoring**: Prometheus (9091), Grafana (3000), Alertmanager (9093)

### User Workloads

- **Current**: Provisioned as Docker containers on the existing Contabo VPS via `POST /api/v1/hosted-runtimes/contabo`
- **Future**: New Contabo VPS instances can be added as workload hosts. 31.220.95.165 is deployed as the control-plane standby; additional VPSes can be added for workloads.

### Standby (Live, tested 2026-09-02)

- **Host**: Contabo Cloud VPS 8 `allternit-standby` (31.220.95.165, Tailscale 100.83.199.24), 8 vCPU / 23 GB RAM
- **Database**: PostgreSQL 16 hot standby, streaming replication from `mail` over Tailscale (replay lag < 1s)
- **API**: Binary, `.env`, and systemd unit installed but stopped/disabled (cold standby, no split-brain)
- **Edge**: nginx with a copy of the Let's Encrypt cert for `api.allternit.com` (Cloudflare Full strict works immediately after a DNS flip)
- **Failover**: DNS flip via Cloudflare global API key + `pg_promote()` — documented and tested end-to-end (incl. a live runtime heartbeat) in [`FAILOVER_RUNBOOK.md`](./FAILOVER_RUNBOOK.md)

## Migration from SQLite to Postgres

### What Was Done

1. **Data Migration**: Used `pgloader` to migrate `/opt/allternit-cloud-api/data/api.db` (SQLite) to PostgreSQL.
2. **Schema Conversion**:
   - Converted all `TIMESTAMP` columns to `TIMESTAMPTZ`
   - Created Postgres enum types (`runstatus`, `jobstatus`, `approvalstatus`, etc.) matching the Rust `sqlx::Type` enums
   - Altered columns to use the enum types
3. **Code Migration**:
   - Replaced `sqlx::SqlitePool` with `sqlx::PgPool` across `cmd/allternit-cloud-api`
   - Updated `init_db` to use `sqlx::postgres::PgConnectOptions`
   - Converted SQL bind placeholders from `?` to `$1, $2, ...`
   - Replaced SQLite-specific functions (`datetime('now')`, `strftime`, `INSERT OR IGNORE`) with Postgres equivalents
   - Updated `allternit-cloud-wizard` to use `PgCheckpointStore`
   - Updated `infrastructure/scheduler` to use `PgPool`

### Known Limitations

- **Migrations**: Embedded SQLite migrations (`cmd/allternit-cloud-api/migrations/*.sql`) are not run against Postgres. The production schema is managed externally via `pgloader`. A proper Postgres migration set should be created for future schema changes.
- **Tests**: Unit tests currently expect a Postgres test database at `postgres://postgres:postgres@localhost:5432/allternit_test`. Test DDL needs to be converted from SQLite to Postgres syntax.

## Monitoring and Alerting

### Metrics

- **API Metrics**: `GET /api/v1/metrics` exposes Prometheus metrics:
  - `allternit_api_requests_total`
  - `allternit_api_request_errors_total`
  - `allternit_api_request_duration_microseconds_total`
  - `allternit_runs_total`, `allternit_runs_active`
  - `allternit_cloud_instances`, `allternit_deployments_total`, `allternit_deployments_active`

### Prometheus

- Config: `/etc/prometheus/prometheus.yml`
- Scrape target: `localhost:8082/api/v1/metrics`
- Rules: `/etc/prometheus/rules/allternit.yml`
  - `AllternitApiDown` (critical)
  - `AllternitApiHighErrorRate` (warning)
  - `AllternitApiHighLatency` (warning)

### Grafana

- URL: `http://mail:3000`
- Datasource: Prometheus (`http://localhost:9091`)
- Dashboard: `Allternit Cloud API` (`/d/allternit-cloud-api`)

### Alertmanager

- URL: `http://mail:9093`
- Receives alerts from Prometheus
- Notification channels need to be configured (email, Slack, etc.)

## CI/CD

### GitHub Actions

- Workflow: `.github/workflows/deploy-cloud-api-contabo.yml`
- Trigger: Push to `main` with changes to `cmd/allternit-cloud-api/**`, `cmd/allternit-cloud-wizard/**`, `infrastructure/cloud/**`, etc.
- Steps:
  1. Build `x86_64-unknown-linux-gnu` release binary
  2. Deploy via `cmd/allternit-cloud-api/deploy-contabo.sh`

### Required Secrets

- `CONTABO_DEPLOY_HOST` (default: `100.108.37.126`)
- `CONTABO_DEPLOY_USER` (default: `root`)
- `CONTABO_SSH_KEY` (private key for SSH access)

## Operational Procedures

### Deploy a New Binary

```bash
# On the VPS
cd /opt/allternit-build
export PATH="/usr/local/rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH"
cargo build --release -p allternit-cloud-api

# Or use the deploy script from local
./cmd/allternit-cloud-api/deploy-contabo.sh /path/to/binary
```

### Database Access

```bash
# As postgres superuser
sudo -u postgres psql -d allternit

# As application user
psql "postgres://allternit:allternit_pg_2026@localhost:5432/allternit"
```

### Backup

```bash
# Backup Postgres
sudo -u postgres pg_dump allternit > /backup/allternit-$(date +%Y%m%d).sql

# Backup SQLite (legacy, for reference)
cp /opt/allternit-cloud-api/data/api.db /backup/api-$(date +%Y%m%d).db
```

## Blockers and Next Steps

1. ~~**Hetzner Standby**~~ → Done with Contabo instead: standby is live on 31.220.95.165 with streaming replication; failover tested 2026-09-02. See [`FAILOVER_RUNBOOK.md`](./FAILOVER_RUNBOOK.md).
2. **Postgres Migrations**: Create `migrations_pg/` directory with Postgres-compatible DDL for future schema changes.
3. **Test Database**: Set up a Postgres test database for unit tests and convert test DDL from SQLite syntax.
4. ~~**New Contabo VPS**~~ → Done: 31.220.95.165 set up (Tailscale, Docker, Postgres replica, API binary, nginx).
5. **End-to-End Test**: Provision a runtime via the Contabo endpoint, pair it, and verify a heartbeat through `api.allternit.com`.

## End-to-End Test Procedure

To verify the Contabo provisioning endpoint and runtime pairing:

1. **Provision a runtime**:
   ```bash
   curl -X POST https://api.allternit.com/api/v1/hosted-runtimes/contabo \
     -H "Authorization: Bearer <clerk-token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "e2e-test", "memoryMb": 1024}'
   ```

2. **Verify the runtime instance is created**:
   ```bash
   psql "postgres://allternit:allternit_pg_2026@localhost:5432/allternit" \
     -c "SELECT id, status, runtime_device_id FROM hosted_runtime_instances WHERE name = 'e2e-test';"
   ```

3. **Pair the runtime** (the container's agent-daemon auto-pairs using the bootstrap token; verify via):
   ```bash
   psql "postgres://allternit:allternit_pg_2026@localhost:5432/allternit" \
     -c "SELECT id, status, last_seen_at FROM runtime_devices WHERE id = '<runtime_device_id>';"
   ```

4. **Verify heartbeat**:
   ```bash
   curl -s https://api.allternit.com/api/v1/runtimes/<runtime_device_id>/heartbeat \
     -H "Authorization: Bearer <device-token>"
   ```

## Known Test Issues

- `services::executor_service::tests::dispatch_failure_requeues_run` — warning event not generated (event logic, not database)
- `services::executor_service::tests::execute_run_completes_and_mirrors_events` — stdout event not mirrored (event logic, not database)

## Data Plane Installation

The Contabo provisioning endpoint now installs the full data plane in each container:

1. **Dependencies**: `curl`, `jq`, `openssl`, `ca-certificates`, `nodejs`, `npm`
2. **gizzi-code**: Downloaded from pinned GitHub release, SHA-256 verified
3. **agent-daemon**: Copied from `/opt/allternit-build/cmd/agent-daemon/dist`, dependencies installed via npm
4. **Pairing**: Creates runtime pairing via `/api/v1/runtime-pairings`, signs challenge with ephemeral Ed25519 key, exchanges for device token
5. **Services**: Starts `gizzi-code serve` on port 8013 and `agent-daemon` in background

## End-to-End Test

The integration test `services::contabo_runtime_service::tests::provision_creates_container_and_instance_record` verifies:

- Docker container is created with correct environment variables
- `hosted_runtime_instances` record is created and marked `running`
- Runtime credentials are returned (instance ID, container ID, runtime device ID, bootstrap token)
- Cleanup destroys the container and updates the record

Run it with:

```bash
cargo test -p allternit-cloud-api --lib services::contabo_runtime_service::tests
```

## Remaining Work

- ~~**Hetzner Standby**~~ → Done with Contabo: see Standby section and `FAILOVER_RUNBOOK.md`.
- ~~**Heartbeat Verification**~~ → Done 2026-09-02: `tests/e2e_contabo_provision_heartbeat.rs` (gated on `ALLTERNIT_E2E_CONTABO=1`) chains the real flow on the VPS — provision → container data plane → Ed25519 pairing exchange → device token → heartbeat → `online`. Fixed along the way: quota `can_create_hosted_runtime` decoded as i64 vs BOOLEAN, ambiguous unqualified self-increments in `ON CONFLICT` clauses, `user_cost_budgets.alert_enabled` INTEGER→BOOLEAN, raw-vs-hashed bootstrap token, camelCase pairing JSON, base64url encoding, Ed25519 oneshot signing via real files, the RuntimeIdentity document shape agent-daemon expects, and `provision()` stomping the exchange's `running` transition.
- **Cert sync**: standby's Let's Encrypt cert is now synced automatically via a certbot deploy hook on `mail` (`/etc/letsencrypt/renewal-hooks/deploy/sync-standby.sh`).
