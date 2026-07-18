-- Virtual API keys for the LLM gateway (OpenAI-compatible /v1 surface).
-- Plaintext keys are shown once at creation; only the SHA-256 hex digest is
-- stored, mirroring the api_keys pattern from V9.

CREATE TABLE IF NOT EXISTS llm_virtual_keys (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id            TEXT,
    key_hash             TEXT NOT NULL UNIQUE,
    key_prefix           TEXT,
    name                 TEXT,
    revoked              INTEGER NOT NULL DEFAULT 0,
    expires_at           DATETIME,
    last_used_at         DATETIME,
    monthly_budget_cents INTEGER,
    rate_limit_rpm       INTEGER,
    -- JSON array of allowed model ids ("provider/model", bare model id, or a
    -- policy alias); NULL means all models are allowed.
    allowed_models       TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_llm_virtual_keys_hash ON llm_virtual_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_llm_virtual_keys_user ON llm_virtual_keys(user_id);
