# Attestation — session/console-be-p1 (console backend phase 1)

**Date:** 2026-09-11-1131
**Agent:** kimi-code
**PR:** #343 (merge `5bf3f1c89`)
**Topic:** Console backend build-out Phase 1 — eliminate dead-end stubs (agents/prototype, monitor, runtime settings)

## What was done

Phase 1 of the approved 10-phase "no stubs" console backend plan (parent plan: `/Users/joe/allternit-console-gap-analysis.md` + plans/rictor-ant-man-batgirl.md). Three frontend surfaces dead-ended against nonexistent backend routes; all three are now backed by real, persisted, auth-gated APIs.

1. **`POST /api/v1/agents/prototype`** (`agent_routes.rs`) — Agent Studio saves real `agents` rows (status=`prototype`, upsert keyed by user+name, reusing the existing INSERT path and status column). `GET /agents` excludes prototypes unless `?include=prototypes` (backward compatible); `GET /agents/:id` returns them. Response carries a copyable curl + `@allternit/sdk/cloud-agents` example pair, mirroring the Agents Console convention. `AgentStudioView.tsx` repointed: real save, run = save → `POST /agents/:id/runs`.
2. **`/api/v1/monitor/{agents,logs,system}`** (new `monitor_routes.rs`, merged at `main.rs` ~:703) — per-user, Clerk-gated like neighbors. agents: per-agent rows from honest `agents`+`beta_sessions` aggregates + summary (total agents, session counts by state, work-task queue depth, deployments due ≤24h); logs: interleaved `beta_session_events` + `llm_usage_events` tail (default 100, cap 500, source-tagged); system: uptime, sqlite DB size (new `DbHandle::path()`), 5 table counts, queue depth by status. Untracked metrics return 0, never invented. `MonitorView.tsx` parses the real shapes, gained a load-error banner and honest labels ("Sessions" not "Tasks").
3. **`/api/v1/runtime/settings{,/reset}` + `/runtime/drivers{,/:type/status,/:type/activate}`** (new `runtime_settings_routes.rs`) — per-user persisted settings (migration **V142__runtime_settings.sql**; V140/V141 already existed, so V142 not V140 as originally planned), validated section patches over server defaults, reset endpoint. Drivers follow the frontend hook's contract types (process/container/microvm/wasm — deviation from brief: the hook defines these, not local/voice/mesh). Status is honest probing: process = real HTTP check of the gizzi runtime `/health`; container/microvm = whether AppState registered the driver; unavailable activation = **409**, never fake success. `useRuntimeSettings.ts` fabrication fallback removed — real errors now propagate to the panel's error banner.

## Verification evidence

- `cargo test -p allternit-api`: **889 passed, 5 failed** — all 5 failures pre-existing and environment-dependent (4× `agent_cloud_routes` `*through_real_os_control_plane`, 1× `rails::gate_data_plane_round_trip`); confirmed identical on clean base via `git stash`. 14 new tests (5 prototype + 4 monitor + 5 runtime settings) all pass.
- Live smoke (debug binary, temp data dirs, scratch ports 18713/18714, servers killed after): 401 without auth on all new families; G1 201 + list filter + 400 on invalid; G2 all 200 with seeded data; G3 defaults→validated PUT (persists)→reset, real gizzi `/health` probe returned `healthy:true, active_instances:1`, wasm activate → honest 409. User's real :8013 gateway verified unaffected.
- `bun run typecheck` (surfaces/ai.allternit.com): clean on all touched files; 6 remaining errors are pre-existing `fabric-session/*` on base 1e52b9ea7 (already fixed in newer local main elsewhere).
- `vitest useRuntimeSettings.test.ts`: 4/4 with fabrication removed.
- `node scripts/release-preflight.mjs`: **35 passed, 0 failed**.

## Incidents / deviations

- Migration numbered V142, not V140 as planned (V140/V141 `cloud_agents*` already occupied the numbers).
- Driver taxonomy = hook's contract types (process/container/microvm/wasm), not the brief's local/voice/mesh — driven by what the frontend actually consumes.
- AgentStudio run path reached live gizzi on :4096 end-to-end; the model call itself returned gizzi's own `ProviderModelNotFoundError` → honest 502 (that gizzi has no providers configured — pre-existing `run_agent` behavior, out of scope).
- `node_modules` symlinks into the shared checkout were created so typecheck/vitest could run (gitignored; shared checkout itself never modified).

## Honest deferrals

- Phase 2–10 of the plan remain (agents PATCH/is_bot/versions/toolset perms, deployment scheduler, memory-store contents, tags/costs/batch metering, caching analytics, webhooks v2, residency + org rate limits, Stripe credits wiring, gizzi telemetry + announcements). Tracked in parent plan.
- Monitor and runtime-settings routes are per-user; there is intentionally no global/admin monitor view in this phase.
