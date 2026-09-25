# Gateway Hardening + Console Control Plane — Plan

> Session: `session/gwrobust` · 2026-09-19
> Basis: `Allternit Brain/Products/GatewayGapAnalysis.md` (gap analysis vs OpenRouter / LiteLLM / Portkey / Cloudflare AI Gateway / Kong / Envoy AI Gateway patterns).
> Scope this session: **P0 items + first console control pages.** P1/P2 remain in the brain doc.

## P0.1 — Failover cooldown tracker (failover.rs)

**Gap:** failover is a static chain + retry policy. No cooldowns, no failure-rate health, no circuit breaking. LiteLLM/OpenRouter treat health-based failover as table stakes.

**Design:**
- `CooldownTracker` in `failover.rs`: per-(org? no — global per provider+model) in-memory map `provider_id+model -> FailureRecord { fails: Vec<Instant>, cooldown_until: Option<Instant> }`.
- Rules (LiteLLM-aligned):
  - HTTP 429 from a provider → immediate cooldown (default 5s, configurable via `RetryPolicy`).
  - Failure rate > 50% over a rolling 1-min window (≥ 4 attempts) → cooldown (default 30s).
  - `select_fallback` skips providers in cooldown; if ALL chain providers are cooling down, use least-recently-failed (fail-open, don't hard-fail the request).
- Wired into the proxy retry loop: record outcome per attempt (success clears the record), consult before each `select_fallback` call.
- Deliberately in-memory (matches rate limiter; shared-state move is P2 #9).
- Metrics: Prometheus counters `llm_failover_cooldown_total{provider,model}`, `llm_failover_skipped_total`.

**Verify:** unit tests in `failover.rs` (time-injected via a clock trait or manual Instant math), full `cargo test -p allternit-api llm_gateway`.

## P0.2 — Streaming failover

**Gap:** retry loop is non-streaming only (`proxy.rs:2097-2118`); streaming requests get one attempt.

**Decision needed (checkpoint open question):** gateway-owned retry-with-resume vs structured retry-hint event for gizzi to re-drive. **This session:** implement the *hint event* path (smaller blast radius, SSE already has an error-event channel; gizzi owns session state and can re-drive with full context). Emit `allternit.retry_hint` SSE event `{retryable: true, reason, next_fallback: {...}}` on upstream stream failure; document that gizzi-code handles re-drive. Gateway-owned transparent resume is deferred.

## P0.3 — Wire conformance harness

**Gap:** zero wire-level e2e; live smoke test removed by owner decision ("real traffic is the test"); no conformance suite (UHP work treats one as table stakes).

**Design:** in-repo mock-provider fixture server, no real network:
- `cmd/allternit-api/tests/wire_conformance.rs` (or `llm_gateway/tests/`): spins an axum mock provider on localhost:0 implementing OpenAI chat/completions + embeddings (streaming SSE + non-streaming + 429 + 500 + slow-response fixtures).
- Gateway pointed at the mock via a test-only provider registration in the `DbHandle::new_memory()` flow.
- Conformance cases v1: (1) non-stream happy path, usage recorded; (2) stream happy path, chunks forwarded, usage in-stream; (3) 429 → failover to next provider in chain, cooldown recorded; (4) 500 → retry per policy; (5) BYOK attach on resolve / strip on failover; (6) residency violation → 451.
- Runs in `cargo test` — pure CI, no owner-decision conflict (no mocks of *production* behavior claimed; this is a fixture harness, not a smoke test).

## P0.4 — Fence the fakes

**Gap:** `embeddings.rs`, `images.rs`, `realtime_audio.rs` return deterministic hash-fakes / stubs on billed surfaces.

**Design:** when no provider is configured, return `501 Not Implemented` with stable error code `allternit.not_configured` and a `detail` naming the missing provider kind — never silent fake output. Gate behind env `ALLTERNIT_GATEWAY_ALLOW_FAKE_PROVIDERS=1` (dev-only escape, documented). Update module doc-headers. Tests assert 501 + code.

## Console — control plane pages (platform.allternit.com)

**Gap:** analytics console exists (Usage/Cost/Logs/Caching/RateLimits), but the control plane is API-only: no UI for provider-routing policy, BYOK credentials, DLP rules, inference hooks.

**This session (2 pages):**
1. **Routing policy editor** (`console/gateway/RoutingPolicyPage.tsx`):
   - JSON editor for the Hermes-six policy + per-model override table.
   - Live resolve preview via existing `POST /gateway/provider-routing/resolve` (type model → see resolved chain before saving).
   - GET/PUT `/gateway/provider-routing`, plus existing Hermes export link.
2. **BYOK credentials page** (`console/gateway/RouteCredentialsPage.tsx`): list (masked fingerprints from API), add (validate-before-store), delete, per provider.

Nav: add "Gateway" group to the console sidebar under/with Analytics. Same Clerk org-owner/admin auth as existing admin pages. No new backend endpoints required.

## Explicit non-goals this session

- P1 (OTel wiring, response caching, org BYOK pool, tokenizers) — follow-up sessions.
- P2 (shared rate-limit state, GitOps round-trip, native-mode sorting, CP/DP split).
- Gateway-owned transparent stream resume (deferred behind P0.2 hint-event path).
- `model_route` MCP changes.

## Verification contract

- `cargo test -p allternit-api llm_gateway` green (incl. new tests).
- `npx tsc --noEmit` clean in `surfaces/platform.allternit.com`.
- Manual smoke: boot api on 18013 with scratch data dir, curl the fenced endpoints → 501; curl routing resolve; page renders (vite dev or build).
- Ledger attestation at session end per AGENTS.md lifecycle.
