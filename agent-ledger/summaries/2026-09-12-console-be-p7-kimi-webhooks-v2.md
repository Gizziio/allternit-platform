# Attestation — session/console-be-p7 (console backend phase 7)

**Date:** 2026-09-12
**Agent:** kimi-code
**PR:** #413 (merge `bfaec3a84`)
**Topic:** Webhooks v2 — retries, delivery log, event registry (G12)

## What was done
- Retry with backoff: 3 attempts, base x 4^(n-1) ± 25% jitter (ALLTERNIT_WEBHOOK_RETRY_BASE_SECS, default 5s); 4xx permanent, connect/timeout/5xx retried; in-place delivery row updates; retries in spawned tokio tasks (process death abandons — documented).
- GET /beta/webhooks/:id/deliveries — paginated, status filter, org-scoped 404, 500-char body truncation.
- Event registry: 12 types + wildcard (alone-only, validated 400); existing session/deployment payload shapes untouched.
- Emitters: agent lifecycle, session created/archived/over_budget, deployment.run_created (trigger + scheduler, org resolved via users.organization_id), billing.credit_purchase, key.created/revoked (no plaintext). Fire-and-forget, never fail requests.

## Verification
- 18 new tests; full suite 980 passed / 6 failed = 5 known env + claim_race wall-clock flake (verified pre-existing: reproduced on unmodified file at :56; minutely-cron due-10s-ago edge). Live smoke (port 8898): signed agent.created delivered, deliveries row, 400 unknown type, dead endpoint → failed/attempts=3, cross-org 404. release-preflight 35/0.

## Incidents / deviations
- Wildcard implemented (nearly free). session.created/event_created can both fire for same action (extend-don't-break).
- Scheduler org resolution: users without org silently get no delivery (consistent with other emitters' org_id:None).
- Session spanned a quota interruption; partial work resumed intact (subagent agent-9 resumed).

## Honest deferrals
- Phases 8–10 remain. claim_race flake + aci policy-audit env race flagged as separate pre-existing fixes.
