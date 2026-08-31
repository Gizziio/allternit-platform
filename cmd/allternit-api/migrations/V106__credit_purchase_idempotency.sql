-- Idempotency tracking for credit purchases and admin grants.
-- Prevents duplicate balance credits when a client retries a purchase request.
CREATE TABLE IF NOT EXISTS credit_purchase_idempotency (
    idempotency_key TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    ledger_entry_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_credit_purchase_idempotency_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_credit_purchase_idempotency_ledger
        FOREIGN KEY (ledger_entry_id) REFERENCES fabric_credits_ledger(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_purchase_idempotency_org
    ON credit_purchase_idempotency(organization_id, created_at);
