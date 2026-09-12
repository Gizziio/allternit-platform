# Attestation — session/console-be-p5 (console backend phase 5)

**Date:** 2026-09-12
**Agent:** kimi-code
**PR:** #400 (merge `552a42d57`)
**Topic:** Tags cost attribution, batch metering, cloud costs params (G8–G10)

## What was done
- **G8**: V146 — resource_tags; llm_usage_events.tags + batch_id; llm_virtual_keys.tags. /api/v1/tags CRUD (upsert on dup key; types agent/session/gateway_key/deployment). tags field on /v1/chat/completions (≤20 entries, 128-char caps, 400). Key-tag inheritance for untagged requests. /gateway/usage?group_by=tag, /gateway/logs?tag=.
- **G10**: NativeBatchProvider stamps x-allternit-batch-id; every sub-request meters through proxy choke point with batch attribution.
- **G9**: cloud-api costs month + group_by honored/validated; tenant/owner scoping (NULL-owner world-readable hole closed).

## Verification
- allternit-api: 953 passed / 5 failed = the 5 known pre-existing env failures; 17 new tests. Live smoke (port 18099, stub provider) verified tagging, inheritance, batch_id, group_by=tag, logs filter, CRUD 400s. release-preflight 35/0.
- allternit-cloud-api: 285 passed / 1 pre-existing docker-env failure; 3 new cost_params tests (own harness — crate-wide tests/common harness pre-existing broken in this env: 32 failures with or without change, untouched).

## Incidents / deviations
- /v1/responses intentionally untagged (fabric path charges credits ledger, not llm_usage_events — decoration avoided).
- Over-limit tags 400, not trimmed.
- Pre-auth network failures in batches unmeterable by design (documented).
- Pre-existing not fixed: cloud-api tests/common harness (32 env failures), docker-dependent lib test, 5 known api env failures, runs.completed_steps BIGINT-vs-model-i32 drift (worked around by column selection).
- Session spanned a pause/quota interruption; partial work resumed intact (subagent agent-7 resumed).

## Honest deferrals
- Phases 6–10 remain.
