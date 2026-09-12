-- ── Cowork principals (A:// §8.3–8.4) ───────────────────────────────────────
-- Workspace-scoped executable identities. Workers authenticate with a bearer
-- token whose SHA-256 hash is stored here; possession of an a:// address alone
-- is not authentication.
CREATE TABLE IF NOT EXISTS cowork_principals (
    id           TEXT PRIMARY KEY,
    workspace    TEXT NOT NULL,
    capabilities TEXT NOT NULL DEFAULT '[]',
    token_hash   TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cowork_principals_workspace ON cowork_principals(workspace);
CREATE INDEX IF NOT EXISTS idx_cowork_principals_token ON cowork_principals(token_hash);
