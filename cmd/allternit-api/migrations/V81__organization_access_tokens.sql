-- Organization-scoped access tokens for CLI/Codex-style surfaces.
-- Admins can create, revoke, and rotate tokens; the platform stores only a
-- SHA-256 hash and a short prefix so tokens can be identified after creation.

CREATE TABLE IF NOT EXISTS organization_access_tokens (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    name            TEXT NOT NULL,
    token_prefix    TEXT NOT NULL,
    hashed_token    TEXT NOT NULL,
    scopes          TEXT,
    expires_at      DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at    DATETIME,
    revoked_at      DATETIME
);

CREATE INDEX IF NOT EXISTS idx_org_access_tokens_org_created
    ON organization_access_tokens(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_org_access_tokens_prefix
    ON organization_access_tokens(org_id, token_prefix);
