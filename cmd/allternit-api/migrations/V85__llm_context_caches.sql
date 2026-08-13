-- Kimi parity R2: reusable context caches for long-prompt optimization.
CREATE TABLE IF NOT EXISTS llm_context_caches (
    id             TEXT PRIMARY KEY,
    virtual_key_id TEXT NOT NULL REFERENCES llm_virtual_keys(id) ON DELETE CASCADE,
    tenant_id      TEXT,
    name           TEXT,
    messages_json  TEXT NOT NULL,
    ttl_seconds    INTEGER,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_llm_context_caches_key
    ON llm_context_caches(virtual_key_id, created_at DESC);
