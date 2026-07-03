-- Auth enhancements: tenants and API keys for the unified Rust API auth layer.

-- ── Tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    domain      TEXT UNIQUE,
    config      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Users tenant link ───────────────────────────────────────────────────────
-- Adds optional tenant association to the existing users table.
ALTER TABLE users ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

-- ── API keys ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id    TEXT REFERENCES tenants(id),
    key_hash     TEXT NOT NULL UNIQUE,
    key_prefix   TEXT,
    name         TEXT,
    scopes       TEXT,
    revoked      INTEGER NOT NULL DEFAULT 0,
    expires_at   DATETIME,
    last_used_at DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
