-- Agent evaluation datasets and runs.
-- Datasets store a JSON array of test cases (prompt + expected tools/outputs).
-- Runs link a dataset to an agent and a rubric; results/scores are stored as JSON.

CREATE TABLE IF NOT EXISTS eval_datasets (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    cases               TEXT NOT NULL DEFAULT '[]', -- JSON array
    created_by          TEXT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eval_datasets_org ON eval_datasets(organization_id);

CREATE TABLE IF NOT EXISTS eval_runs (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dataset_id          TEXT NOT NULL REFERENCES eval_datasets(id) ON DELETE CASCADE,
    rubric_id           TEXT REFERENCES outcome_rubrics(id) ON DELETE SET NULL,
    agent_id            TEXT,
    name                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed
    results             TEXT DEFAULT '[]', -- JSON array of per-case results
    scores              TEXT DEFAULT '{}', -- JSON object of aggregate scores
    created_by          TEXT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eval_runs_org ON eval_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_eval_runs_dataset ON eval_runs(dataset_id);
