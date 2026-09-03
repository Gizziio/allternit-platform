-- Passkey / WebAuthn credential storage.
-- Extends allternit_vault_credentials with WebAuthn-specific fields.

ALTER TABLE allternit_vault_credentials
    ADD COLUMN credential_id TEXT;

ALTER TABLE allternit_vault_credentials
    ADD COLUMN passkey_json TEXT;

ALTER TABLE allternit_vault_credentials
    ADD COLUMN sign_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_vault_credentials_credential_id
    ON allternit_vault_credentials(credential_id)
    WHERE credential_type = 'passkey';
