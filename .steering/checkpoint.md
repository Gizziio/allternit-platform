# Steering checkpoint — session/console-be-p6

## Goal
Backend build-out Phase 6 (G11): cache-hit accounting. Add hits/last_used_at to llm_context_caches + prompt_cache, context_cache_id on llm_usage_events; record at the request path (proxy.rs where context_cache_id is consumed ~:1664-1683); GET /api/v1/gateway/caching aggregate (hit rate, cached_tokens savings estimate, per-cache stats).

## Just did
- Worktree allternit-session-console-be-p6 on session/console-be-p6 from origin/main (6f7bbcebb).
- V147 migration (hits/last_used_at on llm_context_caches + prompt_cache, context_cache_id on llm_usage_events + index; prompt_cache materialized via CREATE IF NOT EXISTS first because cache.rs creates it lazily — ALTER alone would fail on fresh DBs).
- context_cache::record_cache_hit; proxy.rs increments at cache-apply time (best-effort, warn-only) and threads context_cache_id through RequestOutcome → record_usage_event (INSERT + idempotent UPDATE), incl. streaming guard + failover paths.
- llm_pricing::estimated_cache_savings_microdollars (+ pure cache_savings_microdollars, over-200k tier aware).
- GET /api/v1/gateway/caching in admin_routes.rs (period param <n>d default 30d; totals incl. estimated savings + basis string; per-model cached tokens; context-cache breakdown scoped via llm_virtual_keys; prompt-cache breakdown honestly shows hits=0 — no in-proxy read path exists); /gateway/logs rows now expose context_cache_id.
- 12 new unit tests (proxy metering, admin caching/logs, pricing savings) — all pass; llm_gateway lib suite 187/187.
- prompt cache: NOT instrumented in-proxy (resolve_cache_entry has zero production callers) — documented in V147 header + report.

## Next
- DONE (verification): full suite 962 passed / 6 failed = the 5 known env failures (4× agent_cloud real-OS-control-plane, 1× rails gate round-trip) + 1 pre-existing flake `aci_routes::policy_seat_tests::audit_api_returns_rows_with_bot_filter` (env-var race on ALLTERNIT_COMPUTER_USE_DIR; passes in isolation, untouched by this change).
- Live smoke passed (stub Gizzi, scratch port 4899, temp DB): cache create → completion w/ context_cache_id → hits=1, last_used_at set, usage row carries context_cache_id + cached_tokens=120, /gateway/caching + /gateway/logs sane.
- release-preflight.mjs: 35 passed, 0 failed.
- Awaiting human/orchestrator: commit + push + PR (commit/push forbidden to this agent).

## Open questions
- "Hit" definition: a request referencing a cache id counts as a hit for that cache; also derive provider-reported cached_tokens aggregate from llm_usage_events (already per-request).
