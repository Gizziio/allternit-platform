-- Enterprise credentials used by API automation, Codex-style CLI clients,
-- and agent/session-scoped OAuth connections. Plaintext bearer credentials
-- are never stored.

CREATE TABLE IF NOT EXISTS admin_api_keys (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash        TEXT NOT NULL UNIQUE,
    key_prefix      TEXT NOT NULL,
    name            TEXT NOT NULL,
    scopes          TEXT NOT NULL DEFAULT '[]',
    revoked         INTEGER NOT NULL DEFAULT 0,
    expires_at      DATETIME,
    last_used_at    DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_api_keys_org ON admin_api_keys(organization_id, created_at);

CREATE TABLE IF NOT EXISTS access_tokens (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    token_prefix    TEXT NOT NULL,
    name            TEXT NOT NULL,
    scopes          TEXT NOT NULL DEFAULT '[]',
    revoked         INTEGER NOT NULL DEFAULT 0,
    expires_at      DATETIME NOT NULL,
    last_used_at    DATETIME,
    rotated_from_id TEXT REFERENCES access_tokens(id) ON DELETE SET NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_access_tokens_user ON access_tokens(user_id, created_at);

CREATE TABLE IF NOT EXISTS allternit_vault_credentials (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    agent_id        TEXT,
    session_id      TEXT,
    encrypted_value TEXT NOT NULL,
    expires_at      DATETIME,
    revoked_at      DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (agent_id IS NOT NULL OR session_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_credential_scope
    ON allternit_vault_credentials(user_id, provider, IFNULL(agent_id, ''), IFNULL(session_id, ''));
