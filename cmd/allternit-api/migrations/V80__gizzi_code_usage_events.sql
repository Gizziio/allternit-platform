-- Usage analytics events for gizzi-code (the Allternit CLI/Codex-style surface).
-- This lets self-hosted and BYOC deployments collect per-session/per-turn
-- telemetry without sending it to a third-party analytics service.

CREATE TABLE IF NOT EXISTS gizzi_code_usage_events (
    id                      TEXT PRIMARY KEY,
    tenant_id               TEXT NOT NULL,
    user_id                 TEXT,
    session_id              TEXT,
    event_type              TEXT NOT NULL DEFAULT 'turn',
    model                   TEXT,
    provider                TEXT,
    prompt_tokens           INTEGER DEFAULT 0,
    completion_tokens       INTEGER DEFAULT 0,
    cost_microdollars       INTEGER DEFAULT 0,
    tool_calls_accepted     INTEGER DEFAULT 0,
    tool_calls_rejected     INTEGER DEFAULT 0,
    metadata                TEXT,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gizzi_usage_tenant_created
    ON gizzi_code_usage_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gizzi_usage_session
    ON gizzi_code_usage_events(tenant_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gizzi_usage_user
    ON gizzi_code_usage_events(tenant_id, user_id, created_at);
