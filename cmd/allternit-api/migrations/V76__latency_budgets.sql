-- Latency budgets and percentile reporting for the admin control plane.
-- Targets are stored per organization and model (model_id '*' is the global default).

CREATE TABLE IF NOT EXISTS latency_budgets (
    org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    model_id    TEXT NOT NULL,
    p50_ms      INTEGER CHECK (p50_ms > 0),
    p95_ms      INTEGER CHECK (p95_ms > 0),
    p99_ms      INTEGER CHECK (p99_ms > 0),
    ttft_p95_ms INTEGER CHECK (ttft_p95_ms > 0),
    enabled     INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (org_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_latency_budgets_org ON latency_budgets(org_id);
