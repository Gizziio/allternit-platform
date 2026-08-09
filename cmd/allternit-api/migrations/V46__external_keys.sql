-- BYO KMS scaffold: organization-owned registrations of cloud-provider KMS
-- keys (ARN or key ID) used to prove ownership before allternit encrypts
-- customer data with them. `validation_status` starts 'pending'; the
-- validate endpoint is a scaffold that flips it without making a real
-- cloud API call (see external_keys_routes.rs).

CREATE TABLE IF NOT EXISTS external_keys (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider           TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp')),
    key_ref            TEXT NOT NULL, -- ARN (aws) or key resource ID (azure/gcp)
    name               TEXT NOT NULL,
    validation_status  TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    last_validated_at  DATETIME,
    created_by         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_external_keys_org ON external_keys(organization_id, created_at);
