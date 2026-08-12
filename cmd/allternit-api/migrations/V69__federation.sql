-- Federation: trust external identity providers and map claims to workspace roles.
CREATE TABLE IF NOT EXISTS federation_issuers (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    issuer_url      TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_federation_issuers_org
    ON federation_issuers(organization_id);

CREATE TABLE IF NOT EXISTS federation_rules (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    issuer_id       TEXT NOT NULL,
    claim_name      TEXT NOT NULL,
    claim_value     TEXT NOT NULL,
    workspace_id    TEXT,
    role            TEXT NOT NULL,
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issuer_id) REFERENCES federation_issuers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_federation_rules_org
    ON federation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_federation_rules_issuer
    ON federation_rules(issuer_id);
