-- Per-request LLM usage rows. Token counts and cost come from Gizzi runtime
-- events verbatim (message.updated); the gateway never estimates tokens.
-- Cost is stored in microdollars (dollars * 1_000_000) so integer math works
-- end to end; 1 cent = 10_000 microdollars.
--
-- `idempotency_key` is UNIQUE: a retried delivery must be a no-op, not a
-- double-charge (same principle as V22 usage_events). `response_body` stores
-- the serialized chat.completion for idempotent replay of completed requests.

CREATE TABLE IF NOT EXISTS llm_usage_events (
    id                 TEXT PRIMARY KEY,
    virtual_key_id     TEXT REFERENCES llm_virtual_keys(id) ON DELETE SET NULL,
    user_id            TEXT,
    tenant_id          TEXT,
    -- Routing policy alias requested by the client (auto, allternit-*, ...),
    -- NULL when an explicit model was requested.
    policy             TEXT,
    provider_id        TEXT,
    model_id           TEXT,
    -- "provider/model" the request fell back FROM when a failover happened.
    fallback_from      TEXT,
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    completion_tokens  INTEGER NOT NULL DEFAULT 0,
    reasoning_tokens   INTEGER NOT NULL DEFAULT 0,
    cached_tokens      INTEGER NOT NULL DEFAULT 0,
    cost_microdollars  INTEGER NOT NULL DEFAULT 0,
    latency_ms         INTEGER NOT NULL DEFAULT 0,
    ttft_ms            INTEGER,
    -- 'in_progress' | 'ok' | 'error' | 'budget_exceeded' | 'rate_limited' | 'dlp_blocked'
    status             TEXT NOT NULL,
    error_type         TEXT,
    gizzi_session_id   TEXT,
    idempotency_key    TEXT UNIQUE,
    -- Serialized chat.completion JSON for idempotent replay; NULL for
    -- streaming and failed requests.
    response_body      TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_key ON llm_usage_events(virtual_key_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_tenant ON llm_usage_events(tenant_id, created_at);
