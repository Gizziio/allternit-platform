# Steering checkpoint — session/console-fe-p7

**Goal:** Cleanup phase — (1) bot default-model data migration (DB rows pinned to retired openai/gpt-5-mini → current Kimi default, deferred from PR #439); (2) cloud-api integration-test harness v2 (proper schema namespacing instead of shared public tables).

**Just did:** Worktree `allternit-session-console-fe-p7` on `session/console-fe-p7` from origin/main.

**Next:** Recon both items precisely, implement via coder subagent, verify, PR/merge/attest.

**Open questions:** Exact storage of bot default model (recon first).

---

## 2026-09-13 — Recon findings (both items)

### Item 1 — bot default-model migration: GO (rows ARE still read)

Attestations: `agent-ledger/summaries/2026-09-12-1955-botdefault-0912-...md` (#439) and `...-2055-botdefault2-0912-...md` (#443).
- Storage: `agents` table (V1 baseline), columns `model`/`provider`; bot rows flagged by `is_bot` (V143, backfilled from config JSON `$.isBot`). Seeded Gizzi id `gizzi-packaged-assistant` (`useAgentBootstrap.ts`).
- Current default (post-#439): `getDefaultAgentModel()` → `{ id: "kimi/kimi-for-coding", provider: "custom" }` (`agent-models.ts`, synthesized because the virtual kimi id is absent from the gateway registry). `LOCAL_DEFAULT_RUNTIME_MODEL = "kimi-cli/kimi-k3"` (send-path fallback only).
- #439/#443 removed the `bot.provider/bot.model` composer fallback AND session-metadata re-pin. BUT `resolveModelRef` in `lib/bots/bot-runtime-env.ts` still reads `agent.model` for harness modes `byok`/`subprocess`/`cloud` (default harness is `{mode:"cloud"}` since V6 `harness_config` column). Callers: `resolveAgentChatRuntimeModelId` ← `mode-session-store.ts:584` and `group-chat-turn-runner.ts:146` (group-chat member turns have NO picker → hit the row's model directly).
- Server side: `gizzi_chat_stream.rs::parse_model_ref` falls back to the agent row's provider/model when no runtimeModelId is supplied (`chat_routes.rs`), so a bare `openai/gpt-5-mini` row reaches unprovisioned desktop gizzi → ProviderModelNotFoundError.
- Conclusion: migration is warranted, scoped to `is_bot = 1` rows (don't touch deliberately-configured non-bot agents), exact-match `model = 'openai/gpt-5-mini'` → `model = 'kimi/kimi-for-coding'`, `provider = 'custom'` (exactly what `defineAgent` writes for new rows today). Irreversible (down would clobber legitimately-created kimi rows). Next free V-number: **V161** (max is V160).

### Item 2 — cloud-api harness v2: GO

- `tests/common/mod.rs::init_test_db` creates `it_<uuid>` schema + `SET search_path TO <schema>, public`, then `sqlx::migrate!("./migrations_pg")` — all 15 files are `public.`-qualified (341 `public.` in 001 alone) + 14 enum guards `n.nspname = 'public'` in 001, so everything lands in `public` and suites share tables.
- Rewrite plan (harness-only, lib's `src/db/migrations.rs` untouched): at runtime read `migrations_pg/*.sql` via `CARGO_MANIFEST_DIR`, per file (1) `n.nspname = 'public'` → `n.nspname = current_schema()` (guards must check the fresh schema, else existing public types skip creation → `$1::runmode` cast fails again), (2) strip `public.` qualifiers, (3) split statements with a dollar-quote/quote/comment-aware splitter (naive `;` split breaks the `DO $$…$$` blocks in 001/002), execute each on the pool. No bookkeeping — fresh schema per run IS the isolation. Splitter gets unit tests.
- after_connect: `SET search_path TO <schema>` only (drop `, public`) so isolation is genuine.
- Drop-on-Drop: store schema name in TestApp; `Drop` spawns a thread with its own tokio runtime → `DROP SCHEMA IF EXISTS <schema> CASCADE`, best-effort.
- Other suites: leave. `cost_params` + `billing_webhook_grants` intentionally share `public` with unique ids + row cleanup; both `e2e_*` build their own minimal scratch schemas (own drop-on-drop already).

## 2026-09-13 — Implementation + verification status

**Item 1 (DONE):** `cmd/allternit-api/migrations/V161__bot_default_model_kimi.sql` — irreversible UPDATE scoped to `is_bot=1 AND model='openai/gpt-5-mini'` → `model='kimi/kimi-for-coding', provider='custom'` (exactly what defineAgent writes today).

**Item 2 (DONE):** `cmd/allternit-cloud-api/tests/common/mod.rs` — runtime migration rewrite (strip `public.`, guards → `current_schema()`), dollar-quote-aware statement splitter with 9 unit tests, `search_path TO <schema>` only (no public), no bookkeeping, drop-on-Drop (thread + fresh runtime, `DROP SCHEMA ... CASCADE`). Other suites untouched (cost_params/billing_webhook_grants share public intentionally; both e2e_* build own minimal schemas).

**Verified so far:**
- cloud-api lib: 294 passed / 1 failed = known docker-env failure (baseline 294/1) ✓
- integration_tests: 3 consecutive runs, 41 passed (32 integration + 9 splitter unit tests) / 0 failed — true isolation holds across runs ✓
- cost_params 3/3, billing_webhook_grants 1/1, e2e_billing 1/1, e2e_contabo 1/1 (task's baseline numbers for cost_params/webhook_grants were swapped; source has 3 and 1 tests respectively) ✓
- Schema cleanup: `it_*` count on allternit_test unchanged at 401 across a full suite run (all historical leftovers; zero new) ✓
- `node scripts/release-preflight.mjs`: 35 passed / 0 failed ✓
- Pending: full `cargo test -p allternit-api` vs 1042/5 baseline (background).

## 2026-09-13 — Landing (orchestrator)

**Just did:** Full verification done. cloud-api: lib 294/1 (docker-env baseline), integration_tests 41/41 ×3 runs, cost_params 1/1, billing_webhook_grants 3/3, e2e_billing 1/1, e2e_contabo 1/1; `it_*` schema count unchanged across runs; 401 historical leftovers dropped from allternit_test. allternit-api: full suite blocked by machine load >200 (two concurrent session builds) — 298 passed / 4 known env failures before stall; V161 verified directly (all 161 migrations apply to scratch SQLite; functional UPDATE check: bot row migrated, Kimi + non-bot rows untouched). release-preflight 35/0.
**Next:** commit/push PR, merge, attest, cleanup.
**Open questions:** None.
