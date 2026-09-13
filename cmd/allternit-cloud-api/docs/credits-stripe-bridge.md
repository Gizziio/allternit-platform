# Credits ↔ Stripe bridge (G15)

How a credit-pack purchase becomes org ledger credits, and what must be
configured for each deployment. TEST MODE ONLY until the operator flips real
Stripe keys — the code never distinguishes; the keys do.

## Flow

1. `POST /api/v1/billing/checkout` (allternit-cloud-api) creates a Stripe
   Checkout Session in `mode=payment` for one of the static packs
   (`credits_10/25/50/100`, priced 1:1 from server-side config — the client
   only sends `pack_id`). Session metadata carries the grant contract:
   `clerk_user_id`, `allternit_credits_usd`, and `allternit_org_id` (the
   Clerk org active on the session — captured here because the webhook has no
   Clerk session to resolve it from later).
2. Stripe delivers `checkout.session.completed` (or
   `checkout.session.async_payment_succeeded` for async payment methods) to
   `POST /api/v1/webhooks/stripe`. The signature is verified against
   `STRIPE_WEBHOOK_SECRET` (HMAC-SHA256, 5-minute tolerance); only
   `mode=payment` + `payment_status=paid` sessions grant.
3. The webhook grants exactly once per Stripe event id:
   - `webhook_events` (migration `015_webhook_events.sql`) is the first-line
     dedupe — a retry is acknowledged as a replay without re-calling either
     ledger. The row is written only AFTER the grant succeeds, so a failed
     grant leaves no record and Stripe's retry re-attempts it.
   - The grant call itself carries the idempotency key `stripe-{event_id}`
     (the money guarantee): the allternit-api ledger replays it via
     `credit_purchase_idempotency`; the cloud wallet via the
     `credit_transactions.transaction_id` uniqueness.
4. Where the grant lands depends on the bridge (below). When the bridge is
   configured AND the event names `allternit_org_id`, credits go to the
   allternit-api org fabric ledger — the ledger that pays for compute.
   Otherwise they land in the cloud wallet (pre-G15 behavior), and
   `webhook_events.target` records which happened so enabling the bridge
   later never re-delivers an old event.

## Cross-service auth

The webhook → allternit-api call reuses the existing internal service token
pattern (same family as `x-allternit-billing-secret` on
`/api/v1/internal/billing/credits/transfer`):

- cloud-api sends `POST {ALLTERNIT_FABRIC_LEDGER_URL}/api/v1/admin/credits/grant`
  with header `x-allternit-internal-token: <ALLTERNIT_INTERNAL_SERVICE_TOKEN>`.
- allternit-api's `auth_middleware` verifies the token (constant-time) and
  injects the synthetic `internal-service` identity; the grant handler
  re-verifies the header and requires `organization_id` and
  `idempotency_key` in the body (both mandatory — a retry without a key
  could double-grant).
- 5-second client timeout; a grant failure returns non-2xx so Stripe retries.

**Deployment requirement:** set `ALLTERNIT_INTERNAL_SERVICE_TOKEN` to the
SAME value on both services (32+ random bytes). If
`ALLTERNIT_FABRIC_LEDGER_URL` is set but the token is missing, the webhook
REFUSES to grant (503 + error log, Stripe retries) rather than silently
crediting the wallet — that misconfiguration must be fixed, not masked.

## Env flags

| Service | Env | Semantics |
|---|---|---|
| cloud-api | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Existing; test keys in test mode. |
| cloud-api | `ALLTERNIT_FABRIC_LEDGER_URL` | allternit-api base URL. Unset = grants go to the cloud wallet (bridge off). |
| cloud-api | `ALLTERNIT_INTERNAL_SERVICE_TOKEN` | Shared secret for the grant call (must match allternit-api). |
| allternit-api | `ALLTERNIT_INTERNAL_SERVICE_TOKEN` | Verifies the grant call (plus `internalServiceToken` company config fallback). |
| allternit-api | `ALLTERNIT_CREDITS_CHECKOUT_ENABLED` | `true`/`1` only where the billing checkout is deployed. Until set, `POST /api/v1/credits/purchase` answers 409 "credits purchase is not enabled in this deployment; use the billing checkout" — it never self-credits. When set AND `ALLTERNIT_CLOUD_API_URL` is configured, it returns the platform billing checkout URL instead of crediting. |

## Not production-live yet

The webhook → fabric-ledger grant only fires when BOTH bridge env vars are
set; no deployment sets them yet. `/credits/purchase` stays behind its 409
honesty gate until `ALLTERNIT_CREDITS_CHECKOUT_ENABLED` is set. Wallet
fallback keeps pre-G15 deployments working unchanged.
