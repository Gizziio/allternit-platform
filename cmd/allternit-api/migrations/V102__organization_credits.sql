-- Pre-paid credits ledger for unified compute and other metered resources.
-- Each organization has a balance in USD cents. All usage deducts from this
-- balance; subscriptions, top-ups, and manual grants add to it.

CREATE TABLE IF NOT EXISTS organization_credits (
    org_id                      TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    balance_cents               INTEGER NOT NULL DEFAULT 0,
    lifetime_purchased_cents    INTEGER NOT NULL DEFAULT 0,
    lifetime_consumed_cents     INTEGER NOT NULL DEFAULT 0,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organization_credits_org
    ON organization_credits(org_id);

CREATE TRIGGER IF NOT EXISTS organization_credits_updated_at
AFTER UPDATE ON organization_credits
BEGIN
    UPDATE organization_credits SET updated_at = CURRENT_TIMESTAMP WHERE org_id = NEW.org_id;
END;

-- Immutable credit transactions. Every change to balance_cents has a matching
-- row here for audit and reporting.
CREATE TABLE IF NOT EXISTS credit_transactions (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount_cents    INTEGER NOT NULL, -- positive = credit, negative = debit
    kind            TEXT NOT NULL CHECK (kind IN ('purchase', 'subscription_grant', 'manual_grant', 'usage', 'refund')),
    description     TEXT,
    reference_id    TEXT,             -- idempotency key or related usage_event id
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_org
    ON credit_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created
    ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference
    ON credit_transactions(reference_id);
