-- Fabric model gateway catalog and per-token usage ledger.
-- Mirrors the hardcoded planning catalogs in the OpenAI/Together/Fireworks
-- inference adapters, but keeps the canonical cost-per-token ledger in the
-- control plane so the Model Gateway can charge the credits ledger directly.

CREATE TABLE IF NOT EXISTS fabric_model_catalog (
    id TEXT PRIMARY KEY,
    provider_kind TEXT NOT NULL,
    model_id TEXT NOT NULL,
    display_name TEXT,
    input_cents_per_1m INTEGER NOT NULL DEFAULT 0,
    output_cents_per_1m INTEGER NOT NULL DEFAULT 0,
    context_tokens INTEGER NOT NULL DEFAULT 0,
    quality_tier TEXT NOT NULL DEFAULT 'fast',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider_kind, model_id)
);

CREATE INDEX IF NOT EXISTS idx_fabric_model_catalog_provider
    ON fabric_model_catalog(provider_kind, model_id);

-- Per-request model usage events. Each row is a billed inference call.
CREATE TABLE IF NOT EXISTS fabric_model_usage_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider_kind TEXT NOT NULL,
    model_id TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    ledger_entry_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fabric_model_usage_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_model_usage_org
    ON fabric_model_usage_events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fabric_model_usage_model
    ON fabric_model_usage_events(provider_kind, model_id, created_at);
