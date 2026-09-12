# Steering checkpoint — session/console-be-p5

## Goal
Backend build-out Phase 5 (G8–G10): (1) tags — resource_tags table + CRUD + tag write path on gateway requests stored on llm_usage_events so Tags becomes cost attribution; (2) fix cloud-api costs.rs ignoring month + group_by params (provider/region/instance_type; tenant scoping); (3) batch metering — native batch sub-requests carry batch_id so batch spend shows in logs/usage/cost.

## Just did
- G8 done: V146 (resource_tags; llm_usage_events.tags/batch_id; llm_virtual_keys.tags), tag_routes.rs (GET/POST upsert/DELETE by id+query, enum-validated), gateway write path (request `tags` validated 400 over limits, key-inherited defaults, x-allternit-batch-id header), record_usage_event persists tags+batch_id (incl. idempotent UPDATE), /gateway/usage?group_by=tag (json_each), /gateway/logs?tag= filter + tags/batch_id in rows. Tests: tag_routes CRUD (3), translate validation (4), proxy metering (4), admin usage/logs (3) — all green.
- G9 done: costs.rs honors month (YYYY-MM, 400 otherwise) + group_by (provider|region|instance_type, 400 otherwise; tag intentionally gateway-only); tenant scoping = runs.tenant_id OR legacy owner_id = auth user; get_run_cost now selects only owner/tenant columns (full-Run decode trips on completed_steps BIGINT-vs-INTEGER drift). Tests: new tests/cost_params.rs (3, green against live local Postgres).
- G10 done: BatchProvider::submit(batch_id, …); NativeBatchProvider stamps x-allternit-batch-id on every sub-request; failures recorded via proxy error path. Tests: worker passes batch.id (1), stub-server header assertions (2).
- Pre-existing breakage found (not fixed beyond what's noted): cloud-api tests/integration_tests.rs harness broken in this env (empty per-test schema vs public.-qualified migrations_pg DDL) — all 32 tests fail with/without this change; cloud-api lib has 1 docker-dependent failure; allternit-api has the 5 known env failures.

## Next
- Report to caller. No commits per task constraints (parent handles PR/attest/cleanup).

## Verification (all done)
- allternit-api: lib 953 passed / 5 failed (exactly the known pre-existing: 4× agent_cloud real-OS-control-plane + 1× rails gate round-trip); health_metrics_test 6/6; viz_routes_test 14/14.
- allternit-cloud-api: lib 285 passed / 1 pre-existing docker-dependent failure; cost_params 3/3; integration_tests 32 pre-existing failures (broken search_path harness, unrelated); e2e binaries pass.
- Live smoke (scratch port 18099, temp DB, stub Gizzi :4099): tagged completion → usage row carries tags; untagged → inherits key tags; X-Allternit-Batch-Id → batch_id set; /gateway/logs?tag= filters (key or value match); /gateway/usage?group_by=tag aggregates; /api/v1/tags CRUD + upsert + 400s; 21-tag request rejected 400.
- release-preflight: 35 passed, 0 failed.

## Open questions
- POST /tags upserts on duplicate key (documented choice, friendlier for console UI). Over-limit request tags are rejected with a 400 (not trimmed) — deterministic, matches gateway error style.
- /v1/responses (fabric_model_routes) charges the fabric credits ledger, not llm_usage_events — tags not added there (would be decoration, not attribution).
