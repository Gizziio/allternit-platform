-- Inference provider pools: per-pool monthly budget ceilings (the circuit
-- breaker for upstream spend), per-pool usage attribution, and the config
-- surface for the free-tier pool policy.
--
-- One row per configured upstream provider (seeded at startup by
-- services::inference_pool from the same env vars main.rs uses; operator-edited
-- budgets are never overwritten on re-seed). inference_usage.pool_id links
-- every settled completion to its pool; NULL pool_id rows predate pools or
-- come from an unseeded provider.
--
-- kind 'byok' and rate_limit_rpm are reserved for later phases; v1 only reads
-- enabled, monthly_budget_usd, and priority.

CREATE TABLE IF NOT EXISTS inference_pools (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'pay_per_token',
    monthly_budget_usd REAL,
    rate_limit_rpm INTEGER,
    priority INTEGER NOT NULL DEFAULT 100,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inference_usage ADD COLUMN pool_id TEXT REFERENCES inference_pools(id);

CREATE INDEX IF NOT EXISTS idx_inference_usage_pool_month
    ON inference_usage(pool_id, created_at);
