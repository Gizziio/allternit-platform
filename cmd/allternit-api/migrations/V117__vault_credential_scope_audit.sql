-- Dedicated audit log for credential fill/use events and stricter origin enforcement.
-- Each time an agent or user decrypts/uses a password credential we record the
-- actor, requested origin, and context so users can review what was accessed.

CREATE TABLE IF NOT EXISTS vault_credential_use_log (
    id              TEXT PRIMARY KEY,
    credential_id   TEXT NOT NULL REFERENCES allternit_vault_credentials(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('fill', 'use')),
    origin          TEXT,
    actor           TEXT,
    context         TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vault_credential_use_log_credential
    ON vault_credential_use_log(credential_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_credential_use_log_org
    ON vault_credential_use_log(organization_id, created_at DESC);
