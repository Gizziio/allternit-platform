-- Service accounts for organization-scoped API access.
-- Plaintext secrets are shown once at creation/rotation; only a SHA-256
-- digest is stored, mirroring llm_virtual_keys and api_keys.

CREATE TABLE IF NOT EXISTS service_accounts (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    client_id       TEXT NOT NULL UNIQUE,
    hashed_secret   TEXT NOT NULL,
    scopes          TEXT, -- JSON array of scope strings; NULL means all scopes.
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_rotated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_accounts_org ON service_accounts(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_service_accounts_client_id ON service_accounts(client_id);
