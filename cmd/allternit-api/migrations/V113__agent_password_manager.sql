-- Agent-native password manager: password credentials, site scoping, and autofill audit fields.
-- Extends the existing vault (V37 + V40) to support username/password pairs bound to origins.

ALTER TABLE allternit_vault_credentials
    ADD COLUMN credential_type TEXT NOT NULL DEFAULT 'oauth'
    CHECK (credential_type IN ('oauth', 'password', 'passkey'));

ALTER TABLE allternit_vault_credentials
    ADD COLUMN username TEXT;

ALTER TABLE allternit_vault_credentials
    ADD COLUMN origin_pattern TEXT;

ALTER TABLE allternit_vault_credentials
    ADD COLUMN last_used_at DATETIME;

ALTER TABLE allternit_vault_credentials
    ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS vault_credential_sites (
    id            TEXT PRIMARY KEY,
    credential_id TEXT NOT NULL REFERENCES allternit_vault_credentials(id) ON DELETE CASCADE,
    origin        TEXT NOT NULL,
    path_pattern  TEXT,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vault_credential_sites_credential
    ON vault_credential_sites(credential_id);

CREATE INDEX IF NOT EXISTS idx_vault_credential_sites_origin
    ON vault_credential_sites(origin);

-- Fast lookup of password credentials by origin (used by extension autofill).
CREATE INDEX IF NOT EXISTS idx_vault_credentials_origin_type
    ON allternit_vault_credentials(origin_pattern, credential_type)
    WHERE credential_type = 'password' AND vault_id IS NOT NULL;
