# Attestation — session/console-be-p6 (console backend phase 6)

**Date:** 2026-09-12
**Agent:** kimi-code
**PR:** #404 (merge `a4bff2d20`)
**Topic:** Cache-hit accounting + /gateway/caching analytics (G11)

## What was done
- V147: hits + last_used_at on llm_context_caches + prompt_cache (prompt_cache materialized CREATE-IF-NOT-EXISTS first — cache.rs lazily creates it); context_cache_id on llm_usage_events.
- proxy.rs: fire-and-forget hit increment at cache apply (warn-only); context_cache_id threaded through nonstream/stream/failover/disconnect paths into usage rows (Phase 5 batch_id pattern); /gateway/logs exposes it.
- GET /api/v1/gateway/caching: period param, totals (requests, cache hits, cached_tokens, savings estimate via llm_pricing input-rate math, over-200k tier aware, unpriced models reported), per-model + per-cache breakdowns, honest zeros.
- llm_pricing.rs: estimated_cache_savings_microdollars + pure cache_savings_microdollars (test-pinned).

## Verification
- 12 new tests; full suite 962 passed / 6 failed = 5 known env failures + aci policy_seat_tests race (verified pre-existing: passes 5/5 in isolation, parallel-test race on process-global ALLTERNIT_COMPUTER_USE_DIR, untouched code). Live smoke (port 4899, stub) verified hits/stamp/usage row/aggregates/logs. release-preflight 35/0.

## Incidents / deviations
- prompt_cache columns migrated but uninstrumented (resolver has no in-proxy callers) — documented in V147 header + endpoint; future read path just records against migrated columns.
- aci policy-audit env-var race flagged as worth a separate fix (pre-existing).

## Honest deferrals
- Phases 7–10 remain.
