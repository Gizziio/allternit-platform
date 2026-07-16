-- BYOC (Bring Your Own Cloud) credentials: an org connects its own AWS/GCP/
-- Azure account so Firecracker-grade sandboxes provision into the customer's
-- cloud, not allternit's. One opaque sealed secret blob per row (matching
-- connector_connections' pattern from V16, not per-provider columns) so the
-- schema stays provider-agnostic -- the provider-specific shape (role ARN,
-- service-account JSON, client secret) lives inside the sealed JSON, not in
-- SQL columns.

CREATE TABLE IF NOT EXISTS cloud_credentials (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL CHECK(provider IN ('aws','gcp','azure')),
    label             TEXT NOT NULL,
    region            TEXT,
    -- Non-secret, shown back to the customer for their own role trust policy
    -- (e.g. AWS STS ExternalId). Never put anything sensitive here.
    external_id       TEXT,
    -- token_crypto::seal() of a provider-shaped JSON blob (role_arn /
    -- service_account_key / client_secret, as appropriate per provider).
    secret_sealed     TEXT NOT NULL,
    -- Soft-revoke only -- never hard-delete, so there's an audit trail of what
    -- an org once had access to.
    status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','error')),
    last_validated_at DATETIME,
    created_by        TEXT NOT NULL REFERENCES users(id),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, label)
);
CREATE INDEX IF NOT EXISTS idx_cloud_credentials_org ON cloud_credentials(organization_id);
