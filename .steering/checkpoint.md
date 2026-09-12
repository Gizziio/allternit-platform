# Steering checkpoint — session/console-be-p9

## Goal
Backend build-out Phase 9 (G15, MONEY): credits ↔ Stripe — credit-pack checkout → webhook-confirmed grant into the allternit-api org credits ledger, with end-to-end idempotency and a /credits/purchase honesty gate.

## Status: IMPLEMENTATION + VERIFICATION COMPLETE (uncommitted, awaiting human review/PR)

## Just did (full session)
- allternit-api: `ALLTERNIT_CREDITS_CHECKOUT_ENABLED` honesty gate on POST /credits/purchase (409 "credits purchase is not enabled in this deployment; use the billing checkout" unless flag set AND cloud API configured; then returns the billing checkout URL, never self-credits); internal-token grant path on /admin/credits/grant (synthetic `internal-service` identity from auth_middleware + header re-verified in handler; org + idempotency_key mandatory; reference_type stripe_checkout; 404 on unknown org); `credit_purchase_idempotency` ledger replay verified; BILLING_CREDIT_PURCHASE webhook delivery moved to the internal grant path.
- cloud-api: checkout metadata gains `allternit_org_id` (400 at checkout when bridge on but no org); webhook grants only on mode=payment + payment_status=paid (async payment methods settle via checkout.session.async_payment_succeeded, now also handled); `webhook_events` dedup table (migrations_pg 015, registered as v15) written after successful grant; `services/fabric_ledger.rs` bridge client (ALLTERNIT_FABRIC_LEDGER_URL + ALLTERNIT_INTERNAL_SERVICE_TOKEN, 5s timeout); misconfigured bridge (URL without token) refuses to grant; wallet fallback preserved + recorded so enabling the bridge later never re-grants old events.
- Docs: cmd/allternit-cloud-api/docs/credits-stripe-bridge.md (flow, cross-service auth, env flags, deployment requirement, not-production-live notes).

## Verification evidence
- cargo test -p allternit-cloud-api --no-fail-fast: lib 294 passed / 1 failed (pre-existing docker-env contabo test); integration_tests 0/32 (pre-existing tests/common harness breakage — confirmed identical failure with changes stashed); cost_params 3/3, e2e 1/1 + 1 ignored, billing_webhook_grants 1/1 (new HTTP-level signed-webhook test: forged signature 401, paid event grants once, replay idempotentReplay=true, no double grant).
- cargo test -p allternit-api --no-fail-fast: lib 1005 passed / 6 failed = known pre-existing set exactly (4× agent_cloud OS-control-plane + 1× rails gate + 1× scheduler claim_race flake, both "possibly" items from the brief's list); integration binaries all green (health_metrics 6/6, viz_routes 14/14).
- node scripts/release-preflight.mjs: 35 passed, 0 failed.
- LIVE TEST-MODE round trip (operator has stripe CLI test profile): `stripe listen` → local cloud-api with test keys; real checkout session created via POST /billing/checkout (metadata contract on the session, verified via retrieve); `stripe trigger checkout.session.completed` with metadata overrides → Stripe-signed delivery → webhook verified signature → $10 granted once (credit_transactions + user_credits + webhook_events rows); GET /billing/credits shows balance_usd 10.0. No live keys touched, no real charge, all rows/processes/key file cleaned up.

## Next
- Human review → PR (session rules: commit/push/PR/merge are human-gated steps this session was told not to perform: "Do NOT run git commit/push").
- Production wiring still required: set ALLTERNIT_FABRIC_LEDGER_URL + ALLTERNIT_INTERNAL_SERVICE_TOKEN (same value both services) to turn on fabric-ledger grants; set ALLTERNIT_CREDITS_CHECKOUT_ENABLED on allternit-api to open the /credits/purchase delegation.

## Open questions
- None.
