-- Tenant-level LLM spend caps. `hard = 1` blocks requests over the cap with
-- 429 budget_exceeded; `hard = 0` is advisory only (warning header / reporting).

CREATE TABLE IF NOT EXISTS llm_budgets (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    period       TEXT NOT NULL DEFAULT 'monthly',
    budget_cents INTEGER NOT NULL,
    hard         INTEGER NOT NULL DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_llm_budgets_tenant ON llm_budgets(tenant_id, period);
