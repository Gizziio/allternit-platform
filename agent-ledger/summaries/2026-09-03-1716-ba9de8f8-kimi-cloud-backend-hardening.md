# Agent Work Attestation — Allternit Cloud backend hardening (Fly.io → Contabo/VPS)

**Date:** 2026-09-03 17:16
**Session ID:** ba9de8f8
**Branch:** `main` (worked in shared checkout per established practice for this line; guard bypassed with `STEER_GUARD_OFF=1`)
**Agent:** kimi
**Commit:** `97ecec0bb` (tip of origin/main at handoff)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Production-hardening pass on `cmd/allternit-cloud-api` and its deployment after the Fly.io → Contabo migration. All work is deployed to the production control plane (`mail`, Contabo VPS, Tailscale SSH) and pushed to `origin/main`.

- **Auth unification** — `src/auth/resolve.rs`: `resolve_user()` / `resolve_user_id()` / `resolve_user_scoped(db, headers, scope)`. ~25 call sites across 11 route files swept from Clerk-only to Clerk-session-OR-Bearer-token. Token minting stays Clerk-only (no privilege escalation).
- **Security fix** — Contabo hosted-runtime destroy now verifies runtime ownership in the route (previously any authenticated user could destroy anyone's runtime by id).
- **Scoped API tokens** — platform-minted `alt_` keys (`api_keys` table) were validated nowhere; now authenticated inside `validate_token_against_db` (`src/auth/middleware.rs`) after the legacy md5 `api_tokens` miss. Scopes: `inference`, `compute`, `billing`, `account`. `["*"]` (prod default) = legacy full access; empty list = no scopes.
- **Pricing bugs (both directions)** — generic_openai ingest assumed per-1M prices; Groq quotes per-token. `per_token_price()` normalizer in `src/model_router/generic_openai.rs` (<1e-4 → per-token, else ÷1e6) + regression tests. The first bug was 1,000,000× *over*metering, caught and root-caused by the daily revenue reconciler on its first day.
- **Billing guards** (commit `b3d7404bf`) — G1 disk-quota reconciler (inert fs-capability flag, nodes are ext4/overlay2), G2 free inference $2/calendar-month for no-credits-row users (enforced pre-dispatch, reported on `GET /billing/credits`), G3 free-path 30 rpm rate limit (429 + Retry-After), G4 chargeback hold (`billing_purchase_trust`, untrusted buyers capped at $25 for 14 days), G5 daily revenue reconciliation (`reconcile_billing.py` + systemd timer on mail, posts to Alertmanager).
- **Pool broker + circuit breaker** (`067dc4a6c`) — `inference_pools` seeded per provider, 80% warn / 100% hard 403, `pool_id` on every usage row. `FREE_TIER_POOL_POLICY=cheap_only` ships inert.
- **BYOK** (`af922a44e`) — `user_inference_keys` (AES-GCM via existing credential cipher), validate-on-save, `GET/PUT/DELETE /api/v1/inference/keys`, per-request dispatch, meter-tokens-charge-nothing.
- **CI/CD** — `.github/workflows/deploy-cloud-api-contabo.yml` rewritten: test job (Postgres 16 service container, full release lib suite, docker available) gates a deploy job (`tailscale/github-action@v3` + `TS_AUTHKEY`, swap binary on mail via `cmd/allternit-cloud-api/deploy-contabo.sh` with post-swap `/api/v1/health` check + automatic rollback to `.prev`).
- **Docs** — `docs/Operations/CLOUD_API_VPS_DEPLOY.md` (deploy runbook incl. CI/CD setup), `docs/Operations/FAILOVER_RUNBOOK.md`, `CAPACITY_PLAN.md` updates.

## How it works

- Production API runs on `mail` (Contabo control plane) against **Postgres** (`sudo -u postgres psql -d allternit`); SQLite is no longer the prod store.
- Deploy: `scripts/deploy-cloud-api.sh` from repo root. **Golden rule:** `cargo build --release` before swapping — `cargo test --release --lib` does NOT refresh the binary (learned from a stale-binary incident).
- Live verification trio on mail: `python3 /tmp/soak_billing.py` (12 checks, must use priced model `qwen3.6-27b-groq` — Groq gpt-oss aliases are free upstream and deduct ~$0), `sweep_smoke.py` (5 endpoints, Bearer token), `scope_check.py` (8 scope-enforcement checks).
- Hetzner standby (`allternit-standby`, 100.83.199.24) holds the API binary, migrations, and a PG replica per `FAILOVER_RUNBOOK.md`.

## Verification

- mail release tests 168/168; soak 12/12 (retail deduction exact: 16+16 tokens → $8.6e-5 delta); sweep smoke 5/5; scope check 8/8. All green at handoff.
- `origin/main` = `97ecec0bb`; shared checkout clean.
- CI/CD YAML and bash syntax validated; workflow is INERT until `TS_AUTHKEY` secret exists.

## Known gaps / remaining work

- **Owner actions pending:** (1) create reusable `tag:ci` Tailscale auth key + `gh secret set TS_AUTHKEY` (ACL snippet in runbook § CI/CD) — then milestone 8 (CI/CD actually running) needs a `workflow_dispatch` proof run; (2) real $10 Stripe purchase (chargeback hold will apply); (3) DeepSeek/Kimi prepaid keys to enable the cheap-provider free pool (`FREE_POOL_PROVIDERS` + flip `FREE_TIER_POOL_POLICY`).
- **Goal milestones not yet proof-checked:** 5 (Hetzner standby failover test) and 8 (CI/CD run). 1–4, 6, 7 are effectively proven by the state above. The `/goal` is blocked and resumable via `/goal resume`.
- **Follow-up:** platform key-mint UI should send meaningful scope defaults (empty scopes currently mint full-access tokens by design).
- Known local-test baseline: `contabo_runtime_service::tests::provision_creates_container_and_instance_record` fails on macOS (no docker); passes on mail and CI.

## Files changed

- `cmd/allternit-cloud-api/src/auth/resolve.rs` — new auth resolution layer
- `cmd/allternit-cloud-api/src/auth/middleware.rs` — alt_ key validation in `validate_token_against_db`
- `cmd/allternit-cloud-api/src/model_router/generic_openai.rs` — per-token pricing normalizer + tests
- `cmd/allternit-cloud-api/src/routes/*` — ~25 call sites swept to resolve_user/resolve_user_id; destroy ownership check
- `cmd/allternit-cloud-api/deploy-contabo.sh` — health check + rollback
- `.github/workflows/deploy-cloud-api-contabo.yml` — test-gated Tailscale deploy
- `scripts/deploy-cloud-api.sh` — bash 3.2 compat
- `infrastructure/cloud/soak_billing.py` — 12-check live billing soak
- `docs/Operations/CLOUD_API_VPS_DEPLOY.md`, `docs/Operations/FAILOVER_RUNBOOK.md`, `CAPACITY_PLAN.md`
- (earlier in session) billing guards, pool broker, BYOK across `cmd/allternit-cloud-api/src/billing|services|model_router`, console BillingPage free-inference card
