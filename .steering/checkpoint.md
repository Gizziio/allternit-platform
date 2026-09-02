# Steering checkpoint

## Allternit Cloud backend: Contabo migration, fly.io removal, Postgres fixes (2026-09-02)

### Goal
Complete the Fly.io → Contabo migration of the Allternit Cloud control plane:
remove the Fly provider entirely, make ContaboRuntimeService the single hosted-
runtime path, fix all SQLite→Postgres migration bugs found by the new chained
E2E test, and ship the fixed binary to production.

### Just did
- Removed fly_runtime_service, deploy-fly.{sh,py}, deploy-cloud-api-fly.yml,
  fly.tomls, FLY_ORGANIZATION_DEPLOYMENT.md; rewired hosted_runtimes routes +
  hosted_runtime_lifecycle (metering/GC/wake) to ContaboRuntimeService
  (docker start/stop/inspect); fixed dead fly.dev URL in
  deploy-cloudflare-pages.yml.
- executor_service: fixed `$1` bind placeholder leaked into an HTTP URL
  (broke event mirroring); added missing eventtype/clienttype enums to test
  schemas. All 10 executor tests pass.
- Chained E2E (tests/e2e_contabo_provision_heartbeat.rs, gated on
  ALLTERNIT_E2E_CONTABO=1) PASSES on mail: provision → data plane → Ed25519
  pairing exchange → device token → heartbeat → online.
- Fixed 9 real production bugs the E2E exposed: quota can_create_hosted_runtime
  i64-vs-BOOLEAN, 4 ambiguous ON CONFLICT self-increments,
  user_cost_budgets.alert_enabled INTEGER→BOOLEAN (live column converted),
  raw-vs-hashed bootstrap token, pairing JSON casing, base64url, Ed25519
  oneshot signing, RuntimeIdentity doc shape, provision() stomping the
  exchange's 'running' transition.
- 72/72 lib tests pass on mail; release binary deployed to production
  (api.allternit.com healthy) and to the standby (identical md5, cold standby).
- Standby (31.220.95.165) live on Tailscale with streaming Postgres replica;
  failover tested end-to-end; cert sync automated via certbot deploy hook.

### Next
- Commit + push this work to main (user approved).
- Fly.io org can be decommissioned in the Fly dashboard (account-level step).

### Open questions
- None blocking.
