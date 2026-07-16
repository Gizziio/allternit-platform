# Allternit Miniapps Registry — Staging Deployment

This stack runs the registry exactly the way production is expected to look:
PostgreSQL for persistence, MinIO as S3-compatible object storage, the
`apps-registry` API, an intake worker, nginx as TLS terminator and rate
limiter, and a daily encrypted-at-rest backup loop into MinIO.

```
postgres  (16-alpine, healthchecked, persistent volume)
minio     (S3-compatible: quarantine + published + backup buckets, private)
minio-init(one-shot bucket provisioning)
registry  (apps-registry API, built from the repo root via Dockerfile.registry)
worker    (reference intake worker, services/registry/intake-worker)
nginx     (TLS on 8443, read/write rate-limit zones, audit access log)
backup    (pg_dump -> gzip -> MinIO, retention-pruned)
```

## Quick start

```sh
cd services/registry/deploy/staging

# 1. Secrets
cp .env.example .env
# edit .env — POSTGRES_PASSWORD, MINIO_ROOT_*, both API tokens must be long
# random values. Never commit .env.

# 2. TLS certificate (staging: self-signed is fine)
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout certs/registry.key -out certs/registry.crt \
  -days 365 -subj "/CN=registry.staging.local"

# 3. Bring the stack up
docker compose up -d

# 4. Smoke it
curl --cacert certs/registry.crt https://localhost:8443/health
# (or -k with a self-signed cert)
```

The registry listens internally on `registry:3109`; only nginx is published
(`${REGISTRY_TLS_PORT:-8443}`). There is intentionally no dedicated `/health`
route in the API — nginx proxies `/health` to `GET /v1/miniapps?limit=1`,
which exercises the database pool.

## Publisher / reviewer flow

1. Register or rotate a publisher key:
   `POST /v1/publishers/keys` (publisher bearer token).
2. Submit a signed manifest: `POST /v1/miniapps/submissions`.
3. The submission becomes an intake job. Workers claim it via
   `POST /v1/intake/jobs/claim` and report one result per required stage.
4. With `MINIAPP_INTAKE_ENFORCE=1` (the staging default) a version can only
   be approved after the pipeline reports it `awaiting_review`.
5. Review: `POST /v1/miniapps/:id/review` with the admin token. Approving
   requires the version's signing key to be ACTIVE for that publisher.
6. Published assets are copied from the quarantine bucket to the published
   bucket; published rows are immutable (enforced by a database trigger).

### Kill switches

Emergency stops are API calls, recorded in `kill_switch_events` with actor
and reason:

```sh
# Stop the entire marketplace (listings return empty + killSwitch:true)
curl --cacert certs/registry.crt -X POST https://localhost:8443/v1/admin/kill-switches \
  -H "Authorization: Bearer $MINIAPP_REGISTRY_ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"scope":"marketplace","enabled":true,"reason":"incident","actor":"ops"}'

# Kill one miniapp (hidden from listings, releases 404)
... -d '{"scope":"miniapp","miniappId":"acme.weather","enabled":true,...}'
```

Lift a switch by POSTing the same scope with `"enabled":false`.

## The reference intake worker — read this before approving anything

`services/registry/intake-worker/worker.mjs` is a **fail-closed reference
implementation**. It honestly executes two local stages:

- `schema_validation` — mirrors the registry's `valid_manifest` rule.
- `signature_validation` — real Ed25519 verification over the canonical
  manifest serialization shared with the desktop client.

The other nine required stages (`repo_check`, `license_check`, `secret_scan`,
`dependency_scan`, `malware_scan`, `sbom`, `install_test`, `health_test`,
`ui_test`) are reported as **fail** with `summary.implemented=false`. That is
deliberate: with `MINIAPP_INTAKE_ENFORCE=1`, no submission can reach
`awaiting_review` until real isolated scanners are deployed. Nothing sails
through unverified.

For early staging bring-up you may set `MINIAPP_INTAKE_ENFORCE=0` in `.env`
to allow manual approval without pipeline evidence. **Never do this in
production.** Treat every approval granted while enforcement was off as
untrusted.

Production scanners must run in disposable VMs/containers (never on the
registry host) and implement those nine stages against the same claim/result
contract; the reference worker's source documents the exact payloads.

Worker smoke test (fake registry, signature cross-checks against the desktop
signer): `scripts/marketplace-verify/verify.sh` runs
`services/registry/intake-worker/worker-smoke.mjs`.

## Backups and restore

The `backup` service dumps PostgreSQL every `BACKUP_INTERVAL_SECONDS`
(default 24h), gzips it, uploads to the `MINIAPP_BACKUP_BUCKET`, and prunes
dumps older than `BACKUP_RETENTION_DAYS` (default 30). MinIO data itself
(buckets) lives in the `minio-data` volume — snapshot that volume for asset
durability.

Restore:

```sh
# list dumps
docker compose run --rm minio-init ls local/$MINIAPP_BACKUP_BUCKET
# fetch + restore into a fresh postgres
gunzip -c registry-YYYYmmdd-HHMMSS.sql.gz | \
  docker compose exec -T postgres psql -U registry -d registry
```

Verify restores periodically; an untested backup is not a backup.

## Rate limiting, TLS, audit logs

- nginx: 60 r/s read zone (`/v1/`), 10 r/s write zone (submissions, reviews,
  uploads, install events, ratings, publisher keys, admin, intake).
- TLS 1.2/1.3 only; the registry container is never exposed without TLS.
- Every request is written to nginx's access log (`registry-access.json`
  inside the container) with status and latency — this is the HTTP audit
  trail. nginx does not log headers, so bearer tokens are not recorded.
  Database-level audit (actor + timestamp) lives in the `reviews`,
  `publisher_keys`, `scan_reports`, and `kill_switch_events` tables.

## Monitoring

Staging monitoring is deliberately simple: `docker compose ps` healthchecks,
the nginx access/error logs, and `docker compose logs registry worker`.
There is **no metrics endpoint yet** — before production, add Prometheus
metrics to the registry (queue depth, intake job age, 5xx rates) and alert
on: intake jobs stuck pending, review queue age, backup failures, disk
pressure on both volumes, and certificate expiry.

## Known staging limitations

- The reference worker runs in the compose network, not in a disposable VM.
  Real scanners must be isolated per the handoff requirements.
- MinIO root credentials double as the registry's S3 keys; production should
  use a dedicated service account with bucket-scoped policy.
- Self-signed certs are for staging only; production terminates TLS with a
  real certificate (or behind a load balancer that does).
- Single replica of everything; no HA, no queue autoscaling.
