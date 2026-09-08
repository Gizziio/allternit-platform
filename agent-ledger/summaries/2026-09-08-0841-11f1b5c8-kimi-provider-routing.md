# Attestation — Provider Routing v1 (Hermes-style, per-model overrides)

- **Session:** 11f1b5c8 (kimi)
- **Date:** 2026-09-08
- **Branch:** `session/11f1b5c8` @ 28082b388, merged to main via **PR #132** → 9c3a8a134
- **Motivation:** Owner asked for Hermes Agent's provider-routing model (see hermes-agent.nousresearch.com docs "Provider Routing / per-model overrides") as a first-class capability of the Allternit cloud offering across its surfaces — implemented in the Allternit platform itself, not by running Hermes.

## What was done

Provider routing policies for the LLM gateway, modeled on Hermes' `models:` per-model override shape (provider selection, failover chain, per-route API key / base URL / timeout overrides), plus a per-request pin so a caller (or a gizzi-code session) can force a specific route for a given model.

**Rust / gateway (commit 28082b388):**

- **V133 migration** — `agent_cloud_routes` + `provider_route_overrides` tables (tenant-scoped routing policies with JSONB per-model overrides; per-tenant override rows keyed by route id).
- **`cmd/allternit-api/src/llm_gateway/provider_routing.rs`** — policy resolution, failover chain expansion, per-route override merging, pin validation (9 unit tests).
- **Admin API** — `GET`/`PUT /api/v1/gateway/provider-routing` for tenant-scoped policy management (store-backed, round-trip verified live).
- **Proxy injection (`proxy.rs`)** — resolved route (primary) is injected into the upstream request; on a failed attempt the next failover route is re-resolved and injected, so a failing provider automatically rolls to the next configured route.

**gizzi-code (in-session path):**

- `PromptInput.provider` → session message metadata `provider_routing` → `llm.ts` injects provider/baseURL for `@ai-sdk/openai-compatible` only (other providers don't accept those fields).
- 3 schema tests in `cmd/gizzi-code/test/session/provider-routing.test.ts`.

- **Plan doc:** `spec/provider-routing/plan.md` (in the session branch / now on main).

## Verification evidence

- `cargo test`: 658 pass; provider_routing module 9/9.
- 4 `agent_cloud_routes` test failures are **pre-existing**, not from this change: they exercise a stale hardcoded AllternitOS control-plane binary and fail on main the same way.
- gizzi-code session tests: 109 pass (including the 3 new provider-routing schema tests).
- Typecheck clean for all touched files.
- Admin API store/round-trip verified live against the local gateway (policy PUT → GET returns merged policy; pin accepted and honored in resolution).

## Incidents

- The 4 pre-existing `agent_cloud_routes` failures (see above) — root cause is a stale hardcoded control-plane binary in the test fixture, unrelated to this work.
- Shared checkout `main` was dirty with another agent's in-progress work (shellapp hotfix + terminal-workspace changes) at attestation time, so the ledger commit was made from a detached worktree at `origin/main` (9c3a8a134) instead of the shared checkout, leaving the other agent's working tree untouched.

## Honest deferrals

- **No wire-level end-to-end smoke against a real upstream provider.** Owner directive: "live testing because we are going production" / production is the test — mock smoke artifacts were deliberately removed. The proxy path is covered by unit tests + live admin API round-trip; first live provider traffic will confirm the wire behavior.
- **BYO subscription / end-user API keys** — not in this slice; policies are operator/tenant-managed for now.
- **Ops-side `model_route` MCP extension** and **Agent Hub UI pins** — deferred follow-ups.
- **ACI → Hermes config.yaml bridge** — mapping Allternit route policies into Hermes-native config is a possible future export, not built here.

## Follow-ups for later sessions

1. BYO-subscription key management (per-user route credentials).
2. Ops gateway `model_route` MCP tool extension to expose the admin API.
3. Agent Hub UI for pinning a session to a route (the API and metadata path already support it).
4. Optional Hermes config.yaml export of Allternit routing policies.
