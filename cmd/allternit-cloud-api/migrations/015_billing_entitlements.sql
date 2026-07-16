-- Idempotency/audit records for subscription systems that grant or revoke
-- hosted-compute plan tiers. Provider-credit balances are deliberately out of
-- scope; this table only records managed-runtime entitlement changes.

CREATE TABLE billing_entitlement_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_plan_tier_id TEXT,
    plan_tier_id TEXT NOT NULL REFERENCES plan_tiers(id),
    source TEXT NOT NULL DEFAULT 'billing',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_entitlement_events_user
    ON billing_entitlement_events(user_id, created_at DESC);
