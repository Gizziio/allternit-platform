# Steering checkpoint — session/console-be-p7

## Goal
Backend build-out Phase 7 (G12): webhooks v2 — retry with backoff, delivery-log endpoint, event registry, emitters at real call sites. All implemented; verifying.

## Just did
- webhook_subscription_routes.rs: event registry (`events` module, 12 types + wildcard), `RetryPolicy` (env `ALLTERNIT_WEBHOOK_RETRY_BASE_SECS`, default 5s, ×4 per retry, ±25% jitter, MAX_ATTEMPTS=3), `attempt_delivery` retry loop (4xx = permanent fail), `GET /beta/webhooks/:id/deliveries` (page/limit/status, org-scoped 404, body truncated to 500 chars), `deliver_registered_event` ({id,type,created_at,data} envelope). Existing deliver_session_event / deliver_deployment_run_update payloads unchanged.
- Emitters: agent.created/updated/archived (agent_routes create/patch/update/archive), session.created/archived (cloud_agents_routes), session.over_budget (beta_session_routes append_event), deployment.run_created (beta_deployment_routes trigger + deployment_scheduler tick), billing.credit_purchase (fabric_credits_routes purchase), key.created/revoked (llm_gateway keys create/revoke). All fire-and-forget, never fail the request.
- 21 webhook tests pass (retry schedule, 4xx permanent, envelope+signature, wildcard, registry 400s, deliveries listing/filter/auth/scope, per-emitter firing, resilience).

## Next
- Full `cargo test -p allternit-api` (running), live smoke, release-preflight, then PR/attest/cleanup per session lifecycle.

## Open questions
- None.
