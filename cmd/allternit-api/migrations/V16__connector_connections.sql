-- Owned connector connections (Allternit connector standard).
-- Auth-method-agnostic ACTIVE connection record. Complements mcp_oauth_sessions
-- (which is OAuth *flow state*). One row per (connector_id, user_id) regardless
-- of how the user authenticated: local_cli (e.g. `gh`), oauth2 (PKCE/loopback),
-- device_flow, or api_key. Tokens are stored at rest in the local SQLite DB
-- (same as mcp_oauth_sessions.tokens today); at-rest encryption via
-- ENCRYPTION_KEY is a tracked polish item (S6).

CREATE TABLE IF NOT EXISTS connector_connections (
    id            TEXT PRIMARY KEY,
    connector_id  TEXT NOT NULL,
    user_id       TEXT,
    auth_type     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'disconnected',
    access_token  TEXT,
    refresh_token TEXT,
    expires_at    DATETIME,
    scopes        TEXT,
    account       TEXT,
    metadata      TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connector_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_connector_connections_user ON connector_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connector_connections_status ON connector_connections(status);
