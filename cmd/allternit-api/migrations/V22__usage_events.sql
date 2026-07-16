-- Metered usage records for Tier-3 sandboxing (BYOC and allternit-hosted
-- metered pass-through alike). No invoices table yet -- usage/summary
-- computes drafts on demand from these rows; persisting drafts only becomes
-- worth it once a real payment-processor charger exists (Clover's invoicing
-- API isn't ready yet; Stripe isn't decided -- see billing.rs's NoopCharger).

CREATE TABLE IF NOT EXISTS usage_events (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL REFERENCES organizations(id),
    -- Foreign key into the Python ACU gateway's own SQLite EnvironmentAuthority
    -- store -- no FK constraint possible cross-service/cross-database.
    environment_id      TEXT NOT NULL,
    resource_type       TEXT NOT NULL, -- e.g. 'sandbox_runtime', 'vcpu_seconds', 'gpu_seconds'
    quantity            REAL NOT NULL,
    unit                TEXT NOT NULL,
    provider             TEXT, -- 'aws' | 'gcp' | 'azure' | NULL (allternit-hosted metered)
    started_at          DATETIME NOT NULL,
    ended_at            DATETIME NOT NULL,
    -- Computed server-side from pricing.rs's rate table -- never trust a
    -- client-supplied cost; pricing/margin logic lives in exactly one place.
    computed_cost_cents INTEGER NOT NULL DEFAULT 0,
    -- The Python side's stop() does a best-effort POST with no local
    -- durability; a retried delivery must be a no-op, not a double-charge.
    idempotency_key     TEXT UNIQUE,
    metadata            TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_events_org ON usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_started ON usage_events(started_at);
