# Steering checkpoint — session/console-be-p8

## Goal
Backend build-out Phase 8 (G13–G14): (1) data-residency enforcement — gateway resolves org policy (data_residency_policies, data_residency_routes.rs CRUD-only today) during provider selection (llm_gateway/provider_routing.rs resolve step), restricting candidates by region; data_residency_violation error when no compliant provider. (2) Org rate limits: admin GET/PUT /api/v1/admin/rate-limits (read/write organizations.api_rate_limit_rpm — middleware already reads it, rate_limit.rs:1-50); org-level gateway LLM RPM limit (new column + check in llm_gateway/auth.rs beside budget pre-check). (3) Vaults PATCH/update endpoint (allternit_vault.rs has POST/GET/DELETE only).

## Just did
- V149 migration (next-free; V148 was taken by content_artifacts): providers.region TEXT NOT NULL DEFAULT 'global' + organizations.gateway_rate_limit_rpm INTEGER NULL.
- New llm_gateway/data_residency.rs: per-org 10s-TTL policy cache + invalidation hook, provider_regions lookup (missing row → 'global'), apply_policy (drops non-compliant fallbacks, promotes compliant fallback, ResidencyViolation naming pinned regions), enforce() async wrapper, 451 + data_residency_violation error.
- Hooked into proxy.rs chat_completions right after resolve_model (covers primary + Gizzi fallbackModels + nonstream retry chain).
- data_residency_routes::set_policy now invalidates the cache.
- New admin_rate_limit_routes.rs: GET/PUT /admin/rate-limits, org-admin gated like spend limits, mounted in main.rs. PUT accepts 1..=1_000_000 or null-to-clear; 0 rejected (middleware clamps .max(1) — NOT unlimited; documented). Serde double-Option needs custom deserializer to distinguish null vs missing.
- auth.rs: org_rate_limit_middleware (in-memory sliding window per tenant, 429 + org_rate_limited), wired between per-key rate limit and DLP in llm_gateway_router.
- allternit_vault.rs: PATCH /vaults/:id + /beta/vaults/:id (name/description; 404 matches existing).
- New unit tests all green: data_residency 9, admin_rate_limit_routes 5, auth 6, vault 3.

## Next
- Full cargo test -p allternit-api; live smoke on scratch port; release-preflight; PR.

## Verification (2026-09-12)
- cargo test -p allternit-api --lib: 1001 passed, 5 failed — all 5 in the known pre-existing env set (4× agent_cloud OS-control-plane "did not log its listening port", 1× rails gate_data_plane_round_trip). Integration tests (health_metrics 6, viz_routes 14): all pass.
- Live smoke (scratch port 18099, temp DB, dev-bypass + desktop-token identity): GET rate-limits defaults → PUT round-trip → 0/out-of-range 400s → gateway org RPM 2 → 3rd request 429 org_rate_limited → pin us-east-1 (openai compliant passes filter; anthropic/global 451 data_residency_violation) → re-pin eu-west-1 blocked openai immediately (cache invalidation live) → enforce off → unrestricted 200 → vault POST/PATCH/404 all correct. Server killed, scratch removed.
- node scripts/release-preflight.mjs: 35 passed, 0 failed.

## Open questions
- Provider region is set at the DB/seed level (providers.region); there is no provider write route today — region exposure in provider_routes list responses left as follow-up if wanted.
