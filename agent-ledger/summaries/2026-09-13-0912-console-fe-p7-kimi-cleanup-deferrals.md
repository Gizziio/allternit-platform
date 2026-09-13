# Session attestation — session/console-fe-p7 (console-port Phase 7, cleanup of deferrals)

- **Date:** 2026-09-13 0912 local
- **Agent:** Kimi Code (main session 956ff32a; implementation by coder subagent resumed after a 5-hour quota wall)
- **PR:** #471 → merge SHA `379b740a92cf45f23205909a9cf2f86759950937`
- **Scope:** the two deferrals left over from the Anthropic-console port program. No console-surface (TSX) changes; both items backend/test-harness.

## What was done

### 1. Bot default-model data migration — `cmd/allternit-api/migrations/V161__bot_default_model_kimi.sql`

Deferred from PRs #439/#443. Recon verdict: migration warranted, not just documentation — two code paths still read the agent row's model:

- `resolveModelRef` in `surfaces/ai.allternit.com/src/lib/bots/bot-runtime-env.ts` reads `agent.model` for harness modes `byok`/`subprocess`/`cloud`; reached from group-chat turns and the no-picker send fallback.
- `parse_model_ref` in `cmd/allternit-api/src/gizzi_chat_stream.rs` falls back to the row's provider/model when no runtimeModelId is supplied.

Pre-#439 bot rows carry `model = 'openai/gpt-5-mini'` (retired agent-catalog default) which desktop gizzi does not serve → `ProviderModelNotFoundError` on those paths.

Migration: `UPDATE agents SET model='kimi/kimi-for-coding', provider='custom' WHERE is_bot=1 AND model='openai/gpt-5-mini'` — exactly what `defineAgent`/`getDefaultAgentModel()` writes for new rows today. Scoped to bot rows so deliberately-configured non-bot agents are untouched. Irreversible by design (documented in the file header; a down migration cannot distinguish migrated rows from rows legitimately created with the Kimi default afterwards).

### 2. Cloud-api integration-test harness v2 — real schema isolation

`cmd/allternit-cloud-api/tests/common/mod.rs`. Before: `SET search_path TO <it_schema>, public` + `sqlx::migrate!("./migrations_pg")`, but all `migrations_pg` DDL is `public.`-qualified (pg_dump style, 341 qualifiers in 001 alone + 14 `n.nspname='public'` enum guards), so every table and enum type landed in the shared `public` schema and parallel suites shared tables. PR #440 made that pass by keeping the `public` fallback; this finishes the job:

- At test time each `migrations_pg/*.sql` file is read from `CARGO_MANIFEST_DIR`, rewritten (`n.nspname = 'public'` → `current_schema()` in the DO-block guards; `public.` stripped), split by a quote/comment/dollar-quote-aware statement splitter (naive `;` split breaks the `DO $$…$$` blocks in 001/002), executed against the per-test `it_<uuid>` schema.
- `after_connect` pins `search_path TO <schema>` only — no `public` fallback; unqualified enum casts (`$1::runmode`) resolve in-schema.
- No `_sqlx_migrations` bookkeeping: the unique-per-run schema is the isolation.
- `TestApp::Drop` drops the schema (`DROP SCHEMA IF EXISTS … CASCADE` on a fresh connection via a short-lived runtime) — runs no longer accumulate `it_*` schemas on the dev test DB.
- Splitter ships 9 unit tests (single/double quotes with doubled escapes, line/block/nested comments, `$$` and tagged `$body$` blocks, `$1` operator vs dollar-quote disambiguation, empty/comment-only statements).
- Other suites deliberately untouched: `cost_params`/`billing_webhook_grants` share `public` with unique ids + row cleanup; both `e2e_*` build their own minimal scratch schemas with their own teardown.

## Verification evidence

- `cargo test -p allternit-cloud-api` — lib **294 passed / 1 failed**, the failure being the known docker-env `contabo_runtime_service` test (identical to pre-change baseline).
- `integration_tests`: **41/41**, run **3 consecutive times**; `it_*` schema count on `allternit_test` unchanged across a full run (zero new leftovers). The 401 historical leftovers from the old harness generations were cleaned up (all were bookkeeping-only `_sqlx_migrations` or abandoned per-test schemas; `DROP SCHEMA … CASCADE` on `it_%`).
- `cost_params` 1/1, `billing_webhook_grants` 3/3, `e2e_billing` 1/1, `e2e_contabo` 1/1.
- `cargo test -p allternit-api` — full suite attempted twice; both runs stalled when machine load exceeded 200 under two concurrent session builds (`allternit-cu23`, `allternit-session-adocs2-0913` each compiling the full api crate), starving `computer_control` tests at 0% CPU. First run: 298 passed / 4 failed before the stall — all 4 in `agent_cloud_routes::*_through_real_os_control_plane`, the known env-dependent class (control-plane binary invocation). V161 specifically verified: refinery `embed_migrations!` validated it at compile time; DB-backed tests applying the full migration stack on fresh temp DBs passed; direct functional check — all 161 migration files applied in order to a scratch SQLite DB with zero errors, then V161 repointed an old-default bot row to `kimi/kimi-for-coding`/`custom` while leaving an already-Kimi bot row and a non-bot `gpt-5-mini` row untouched.
- `node scripts/release-preflight.mjs` — **35 passed / 0 failed**.

## Incidents

- The implementation subagent (agent-23) hit the 5-hour Kimi quota wall mid-recon; resumed and its partial edits on disk were complete and correct — no rework needed, only verification.
- The full-suite hang above was diagnosed as environment contention, not a code regression: the test binary sat at 0% CPU while load average held above 200 from other sessions' rustc builds.

## Honest deferrals

- Full `cargo test -p allternit-api` green run not obtained in this session (environment contention). The change to that crate is one embedded SQL migration file; verification was targeted as described. Recommend the next session that touches `allternit-api` Rust code re-run the full suite when the machine is quiet.
- Desktop rebuild skipped per phase convention — nothing here is desktop-bundled UI; the api sidecar consumes V161 at startup (covered by preflight).

## Program status

This was the final phase of the Anthropic-console port. Complete program: backend phases + PR #440 test fixes, frontend Phases 1–6 (PRs #446, #451, #454, #458, #460, #464), and this cleanup (#471). All seven stubs retired as of Phase 6; the deferral ledger is now empty.
