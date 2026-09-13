# Attestation — session/console-be-p8 (console backend phase 8)

**Date:** 2026-09-12
**Agent:** kimi-code
**PR:** #419 (merge `9a700802a`)
**Topic:** Data-residency enforcement, org rate limits, vault PATCH (G13–G14)

## What was done
- V149: providers.region (default 'global' = never satisfies a pin, fails closed), organizations.gateway_rate_limit_rpm.
- llm_gateway/data_residency.rs: per-org policy cache (10s TTL + write invalidation), candidate filtering at the resolve choke point (primary + gizzi fallbacks + failover chain); 451 data_residency_violation naming pinned regions. Active only when enforce_region_pinning && pinned_regions non-empty.
- admin GET/PUT /api/v1/admin/rate-limits: api_rate_limit_rpm (null=600 default; 0 clamps to 1, NOT unlimited — PUT rejects 0 with explanation), gateway_rate_limit_rpm (null=no cap, sliding window in auth.rs -> 429 org_rate_limited + Retry-After, fails open on accounting errors).
- PATCH /vaults/:id + /beta alias (name/description).

## Verification
- 15 new tests; cargo test --lib 1001 passed / 5 failed = the 5 known env failures. Live smoke (port 18099): rate-limit round-trips + 400s, live 429, pin passes/blocks per region, cache-invalidation live, enforce-off 200, vault PATCH + 404. release-preflight 35/0.

## Incidents / deviations
- Migration V149 not V148 (taken by content_artifacts).
- Provider region DB/seed-level only (no provider write endpoint exists); surfacing in provider list responses is follow-up.
- Middleware semantics discovery: existing api_rate_limit_rpm treats 0 as 1 (max(1)) — documented rather than changed.

## Honest deferrals
- Phases 9–10 remain.
