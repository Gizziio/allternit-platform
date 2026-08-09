-- First-class organization vaults and per-organization inference webhooks.

CREATE TABLE IF NOT EXISTS allternit_vaults (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_allternit_vaults_org
    ON allternit_vaults(organization_id, created_at);

ALTER TABLE allternit_vault_credentials
    ADD COLUMN vault_id TEXT REFERENCES allternit_vaults(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_vault_credential_scope;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_credential_scope
    ON allternit_vault_credentials(vault_id, provider, IFNULL(agent_id, ''), IFNULL(session_id, ''))
    WHERE vault_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_legacy_vault_credential_scope
    ON allternit_vault_credentials(user_id, provider, IFNULL(agent_id, ''), IFNULL(session_id, ''))
    WHERE vault_id IS NULL;

CREATE TABLE IF NOT EXISTS llm_inference_hooks (
    organization_id    TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    pre_inference_url  TEXT,
    post_inference_url TEXT,
    abort_on_pre_error INTEGER NOT NULL DEFAULT 1,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
