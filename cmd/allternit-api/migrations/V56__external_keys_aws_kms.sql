-- Extend external_keys to support AWS KMS CMEK provider.
-- SQLite does not support ALTER TABLE to change a CHECK constraint, so the
-- table is recreated with the expanded provider enum and data is migrated.

PRAGMA foreign_keys = OFF;

CREATE TABLE external_keys_new (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider           TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp', 'aws_kms')),
    key_ref            TEXT NOT NULL, -- ARN (aws/aws_kms) or key resource ID (azure/gcp)
    name               TEXT NOT NULL,
    validation_status  TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    last_validated_at  DATETIME,
    created_by         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO external_keys_new SELECT * FROM external_keys;

DROP TABLE external_keys;
ALTER TABLE external_keys_new RENAME TO external_keys;

CREATE INDEX IF NOT EXISTS idx_external_keys_org ON external_keys(organization_id, created_at);

PRAGMA foreign_keys = ON;
