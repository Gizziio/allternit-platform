-- Enterprise Phase 1: data residency, workload identity federation,
-- device attestation, retention / zero-data-residence, and workspace IP allowlisting.

CREATE TABLE IF NOT EXISTS data_residency_policies (
    org_id                 TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    pinned_regions         TEXT NOT NULL DEFAULT '[]', -- JSON array of region codes
    default_region         TEXT,
    enforce_region_pinning INTEGER NOT NULL DEFAULT 0,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_data_residency_policies_org ON data_residency_policies(org_id);

CREATE TABLE IF NOT EXISTS workload_identity_providers (
    id            TEXT PRIMARY KEY,
    org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('aws', 'azure', 'gcp', 'github', 'kubernetes', 'okta', 'spiffe')),
    config        TEXT NOT NULL DEFAULT '{}', -- JSON configuration object
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workload_identity_providers_org ON workload_identity_providers(org_id, provider_type);

CREATE TABLE IF NOT EXISTS workload_identity_credentials (
    id             TEXT PRIMARY KEY,
    provider_id    TEXT NOT NULL REFERENCES workload_identity_providers(id) ON DELETE CASCADE,
    org_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject        TEXT NOT NULL,
    token_preview  TEXT, -- safe prefix / fingerprint; plaintext never stored
    issued_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     DATETIME,
    last_used_at   DATETIME,
    revoked        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(provider_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_workload_identity_credentials_org ON workload_identity_credentials(org_id, provider_id);

CREATE TABLE IF NOT EXISTS device_attestation_records (
    id                TEXT PRIMARY KEY,
    org_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform          TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'macos', 'windows', 'web')),
    attestation_token TEXT NOT NULL, -- opaque attestation blob or JWT from platform
    status            TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked', 'expired')),
    expires_at        DATETIME,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_device_attestation_records_org ON device_attestation_records(org_id, user_id);

CREATE TABLE IF NOT EXISTS retention_policies (
    org_id                  TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    chat_retention_days     INTEGER,
    project_retention_days  INTEGER,
    artifact_retention_days INTEGER,
    zero_data_residence     INTEGER NOT NULL DEFAULT 0,
    zdr_regions             TEXT NOT NULL DEFAULT '[]', -- JSON array of region codes where data must not persist
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (chat_retention_days IS NULL OR chat_retention_days >= 0),
    CHECK (project_retention_days IS NULL OR project_retention_days >= 0),
    CHECK (artifact_retention_days IS NULL OR artifact_retention_days >= 0)
);
CREATE INDEX IF NOT EXISTS idx_retention_policies_org ON retention_policies(org_id);

CREATE TABLE IF NOT EXISTS workspace_ip_allowlists (
    id          TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
    org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ip_range    TEXT NOT NULL, -- CIDR notation, e.g. 203.0.113.0/24
    description TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workspace_ip_allowlists_workspace ON workspace_ip_allowlists(workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_workspace_ip_allowlists_org ON workspace_ip_allowlists(org_id);
