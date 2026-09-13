-- 015_webhook_events.sql
--
-- G15 (credits ↔ Stripe): processed-Stripe-event ledger for the one-off
-- credit purchase path. Stripe retries deliveries; the credit grant must
-- happen at most once per event. The per-event row here is the first-line
-- dedupe (a replay is acknowledged without re-calling the fabric ledger),
-- while the actual money guarantee remains the ledger idempotency key
-- (`stripe-{event_id}` in allternit-api's credit_purchase_idempotency and
-- the cloud wallet's credit_transactions.transaction_id).
--
-- `target` records where the grant landed ('fabric_ledger' when the
-- allternit-api bridge consumed it, 'cloud_wallet' for the legacy local
-- wallet path) so flipping the bridge on later cannot re-deliver an event
-- that already granted somewhere.

CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    target TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
