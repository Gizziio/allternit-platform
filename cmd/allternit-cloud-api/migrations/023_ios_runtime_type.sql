-- iOS runtime pairing support.
--
-- The mobile app pairs as runtime_type 'ios'. The CHECK constraints in
-- 011_runtime_pairing / 013_hosted_runtimes only allowed 'desktop', 'vps',
-- and 'hosted'. We recreate both tables to add 'ios' while preserving all
-- existing data and foreign keys.

PRAGMA foreign_keys=OFF;

-- Recreate runtime_pairings with 'ios' allowed and all columns added by
-- later migrations (hosted_instance_id, byo_bootstrap_token_id).
CREATE TABLE runtime_pairings_new (
    id TEXT PRIMARY KEY,
    device_code_hash TEXT NOT NULL UNIQUE,
    user_code TEXT NOT NULL UNIQUE,
    challenge TEXT NOT NULL,
    public_key TEXT NOT NULL,
    public_key_fingerprint TEXT NOT NULL,
    name TEXT NOT NULL,
    runtime_type TEXT NOT NULL CHECK (runtime_type IN ('desktop', 'vps', 'hosted', 'ios')),
    hostname TEXT,
    platform TEXT,
    version TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'denied', 'expired')),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    runtime_id TEXT REFERENCES runtime_devices(id) ON DELETE SET NULL,
    hosted_instance_id TEXT REFERENCES hosted_runtime_instances(id) ON DELETE SET NULL,
    byo_bootstrap_token_id TEXT REFERENCES byo_bootstrap_tokens(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    approved_at TIMESTAMP,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO runtime_pairings_new SELECT
    id, device_code_hash, user_code, challenge, public_key, public_key_fingerprint,
    name, runtime_type, hostname, platform, version, capabilities, status, user_id,
    organization_id, runtime_id, hosted_instance_id, byo_bootstrap_token_id,
    expires_at, approved_at, consumed_at, created_at
FROM runtime_pairings;

DROP TABLE runtime_pairings;
ALTER TABLE runtime_pairings_new RENAME TO runtime_pairings;

CREATE INDEX idx_runtime_pairings_code ON runtime_pairings(user_code);
CREATE INDEX idx_runtime_pairings_status ON runtime_pairings(status, expires_at);
CREATE INDEX idx_runtime_pairings_user ON runtime_pairings(user_id);
CREATE INDEX idx_runtime_pairings_hosted ON runtime_pairings(hosted_instance_id);
CREATE INDEX idx_runtime_pairings_byo_bootstrap ON runtime_pairings(byo_bootstrap_token_id);

-- Recreate runtime_devices with 'ios' allowed and rotation-grace columns.
CREATE TABLE runtime_devices_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    name TEXT NOT NULL,
    runtime_type TEXT NOT NULL CHECK (runtime_type IN ('desktop', 'vps', 'hosted', 'ios')),
    hostname TEXT,
    platform TEXT,
    version TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]',
    public_key TEXT NOT NULL,
    public_key_fingerprint TEXT NOT NULL,
    credential_hash TEXT NOT NULL UNIQUE,
    credential_expires_at TIMESTAMP NOT NULL,
    previous_credential_hash TEXT,
    previous_credential_expires_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'revoked')),
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

INSERT INTO runtime_devices_new SELECT
    id, user_id, organization_id, name, runtime_type, hostname, platform, version,
    capabilities, public_key, public_key_fingerprint, credential_hash,
    credential_expires_at, previous_credential_hash, previous_credential_expires_at,
    status, last_seen_at, created_at, updated_at, revoked_at
FROM runtime_devices;

DROP TABLE runtime_devices;
ALTER TABLE runtime_devices_new RENAME TO runtime_devices;

CREATE INDEX idx_runtime_devices_user ON runtime_devices(user_id);
CREATE INDEX idx_runtime_devices_org ON runtime_devices(organization_id);
CREATE INDEX idx_runtime_devices_credential ON runtime_devices(credential_hash);
CREATE INDEX idx_runtime_devices_status ON runtime_devices(status);

CREATE TRIGGER IF NOT EXISTS update_runtime_devices_timestamp
AFTER UPDATE ON runtime_devices
BEGIN
    UPDATE runtime_devices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

PRAGMA foreign_keys=ON;
