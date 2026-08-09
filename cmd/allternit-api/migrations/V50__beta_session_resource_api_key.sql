-- Align beta_session_resources resource kinds with the Phase 3 contract.
-- The previous schema allowed 'env_var'; the product contract uses 'api_key'.
-- SQLite does not support ALTER COLUMN, so we recreate the table.

CREATE TABLE IF NOT EXISTS beta_session_resources_new (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('github_token', 'vault_credential', 'api_key')),
    encrypted_value TEXT,
    resource_ref TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((encrypted_value IS NOT NULL) != (resource_ref IS NOT NULL)),
    UNIQUE(session_id, name),
    FOREIGN KEY (session_id) REFERENCES beta_sessions(id) ON DELETE CASCADE
);

INSERT INTO beta_session_resources_new
    (id, session_id, name, kind, encrypted_value, resource_ref, created_at)
SELECT
    id,
    session_id,
    name,
    CASE kind
        WHEN 'env_var' THEN 'api_key'
        ELSE kind
    END AS kind,
    encrypted_value,
    resource_ref,
    created_at
FROM beta_session_resources;

DROP TABLE beta_session_resources;

ALTER TABLE beta_session_resources_new RENAME TO beta_session_resources;

CREATE INDEX IF NOT EXISTS idx_beta_session_resources_session
    ON beta_session_resources(session_id, created_at);
