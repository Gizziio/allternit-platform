CREATE TABLE IF NOT EXISTS llm_batches (
    id             TEXT PRIMARY KEY,
    virtual_key_id TEXT NOT NULL REFERENCES llm_virtual_keys(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL,
    tenant_id      TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    requests_json  TEXT NOT NULL,
    results_json   TEXT NOT NULL DEFAULT '[]',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at   DATETIME
);

CREATE INDEX IF NOT EXISTS idx_llm_batches_owner
    ON llm_batches(virtual_key_id, created_at DESC);
