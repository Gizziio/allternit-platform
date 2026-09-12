# Attestation — session/console-be-p9 (console backend phase 9, MONEY)

**Date:** 2026-09-12
**Agent:** kimi-code
**PR:** #428 (merge `4aa294342`)
**Topic:** Credits ↔ Stripe bridge, default-off and deployment-gated (G15)

## What was done
- cloud-api: checkout metadata allternit_org_id; webhook grants only mode=payment + payment_status=paid (+ async_payment_succeeded); webhook_events dedup (pg 015); fabric_ledger bridge client -> allternit-api org ledger via x-allternit-internal-token re-verified grant, idempotency key stripe-{event_id}; misconfigured bridge -> 503 (never silently credits wrong ledger). docs/credits-stripe-bridge.md.
- allternit-api: /credits/purchase honesty gate (409 unless ALLTERNIT_CREDITS_CHECKOUT_ENABLED + cloud URL -> returns checkout_url, never self-credits); self-crediting path removed; admin grant requires internal token + organization_id + idempotency_key.

## Verification
- **Live Stripe TEST-mode round trip** (stripe listen + stripe trigger, operator test profile): signed checkout.session.completed -> $10 granted exactly once (balance 10.0, dedup row). No live keys.
- allternit-api: 1005 lib pass / 6 failed = known set exactly; integrations 6/6+14/14; 9 new tests. cloud-api: 294 lib pass / 1 pre-existing docker; 50 billing tests; new signed-webhook HTTP test. release-preflight 35/0.

## Incidents / deviations
- Reused existing x-allternit-internal-token middleware instead of inventing HMAC (deployment requirement: same ALLTERNIT_INTERNAL_SERVICE_TOKEN on both services — documented).
- Session spanned two quota/network interruptions (subagent agent-11 resumed; no code lost).

## Honest deferrals / NOT production-live
- Fabric-ledger grants fire only when bridge env vars are set — no deployment sets them; grants keep landing in cloud wallet meanwhile.
- /credits/purchase stays 409-gated until the flag is deliberately set.
- Phase 10 remains.
