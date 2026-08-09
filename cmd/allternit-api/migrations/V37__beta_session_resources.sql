-- Named credentials and environment values attached to managed beta sessions.
CREATE TABLE IF NOT EXISTS beta_session_resources (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('github_token', 'vault_credential', 'env_var')),
    encrypted_value TEXT,
    resource_ref TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((encrypted_value IS NOT NULL) != (resource_ref IS NOT NULL)),
    UNIQUE(session_id, name),
    FOREIGN KEY (session_id) REFERENCES beta_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_beta_session_resources_session
    ON beta_session_resources(session_id, created_at);
