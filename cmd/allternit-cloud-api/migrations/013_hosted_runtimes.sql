-- Hosted runtime support: Fly.io machines managed by the cloud API on behalf
-- of paying users.

-- 1. Hosted runtime instances table. Created first because runtime_pairings
-- gains a foreign key to it.
CREATE TABLE IF NOT EXISTS hosted_runtime_instances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    runtime_device_id TEXT REFERENCES runtime_devices(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'fly',
    billing_mode TEXT NOT NULL DEFAULT 'allternit' CHECK (billing_mode IN ('allternit', 'user_account')),
    fly_app TEXT,
    fly_machine_id TEXT,
    fly_volume_id TEXT,
    bootstrap_token_hash TEXT UNIQUE,
    region TEXT NOT NULL,
    cpu_kind TEXT NOT NULL,
    cpus INTEGER NOT NULL,
    memory_mb INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'starting', 'running', 'stopping', 'stopped', 'destroying', 'destroyed', 'error')),
    started_at TIMESTAMP,
    stopped_at TIMESTAMP,
    destroyed_at TIMESTAMP,
    monthly_cost_cap REAL,
    cost_rate_provider TEXT,
    cost_rate_region TEXT,
    cost_rate_instance_type TEXT,
    last_synced_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hosted_instances_user ON hosted_runtime_instances(user_id);
CREATE INDEX idx_hosted_instances_status ON hosted_runtime_instances(status);
CREATE INDEX idx_hosted_instances_device ON hosted_runtime_instances(runtime_device_id);

CREATE TRIGGER IF NOT EXISTS update_hosted_runtime_instances_timestamp
AFTER UPDATE ON hosted_runtime_instances
BEGIN
    UPDATE hosted_runtime_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 2. Expand runtime_type to include 'hosted'. SQLite does not support altering
-- CHECK constraints, so we recreate both tables that reference runtime_type.

-- 2a. runtime_pairings
CREATE TABLE runtime_pairings_new (
    id TEXT PRIMARY KEY,
    device_code_hash TEXT NOT NULL UNIQUE,
    user_code TEXT NOT NULL UNIQUE,
    challenge TEXT NOT NULL,
    public_key TEXT NOT NULL,
    public_key_fingerprint TEXT NOT NULL,
    name TEXT NOT NULL,
    runtime_type TEXT NOT NULL CHECK (runtime_type IN ('desktop', 'vps', 'hosted')),
    hostname TEXT,
    platform TEXT,
    version TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'denied', 'expired')),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    runtime_id TEXT REFERENCES runtime_devices(id) ON DELETE SET NULL,
    hosted_instance_id TEXT REFERENCES hosted_runtime_instances(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    approved_at TIMESTAMP,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO runtime_pairings_new SELECT
    id, device_code_hash, user_code, challenge, public_key, public_key_fingerprint,
    name, runtime_type, hostname, platform, version, capabilities, status, user_id,
    organization_id, runtime_id, NULL, expires_at, approved_at, consumed_at, created_at
FROM runtime_pairings;

DROP TABLE runtime_pairings;
ALTER TABLE runtime_pairings_new RENAME TO runtime_pairings;

CREATE INDEX idx_runtime_pairings_code ON runtime_pairings(user_code);
CREATE INDEX idx_runtime_pairings_status ON runtime_pairings(status, expires_at);
CREATE INDEX idx_runtime_pairings_user ON runtime_pairings(user_id);
CREATE INDEX idx_runtime_pairings_hosted ON runtime_pairings(hosted_instance_id);

-- 2b. runtime_devices
CREATE TABLE runtime_devices_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    name TEXT NOT NULL,
    runtime_type TEXT NOT NULL CHECK (runtime_type IN ('desktop', 'vps', 'hosted')),
    hostname TEXT,
    platform TEXT,
    version TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]',
    public_key TEXT NOT NULL,
    public_key_fingerprint TEXT NOT NULL,
    credential_hash TEXT NOT NULL UNIQUE,
    credential_expires_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'revoked')),
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

INSERT INTO runtime_devices_new SELECT
    id, user_id, organization_id, name, runtime_type, hostname, platform, version,
    capabilities, public_key, public_key_fingerprint, credential_hash,
    credential_expires_at, status, last_seen_at, created_at, updated_at, revoked_at
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

-- 3. Default Fly cost rates so cost_service can track hosted runtimes.
INSERT OR IGNORE INTO cost_rates (provider, region, instance_type, cost_per_hour, storage_cost_per_gb_month, transfer_cost_per_gb) VALUES
    ('fly', 'lax', 'shared-cpu-1x-256mb', 0.0027, 0.15, 0.02),
    ('fly', 'lax', 'shared-cpu-1x-512mb', 0.0044, 0.15, 0.02),
    ('fly', 'lax', 'shared-cpu-1x-1024mb', 0.0079, 0.15, 0.02),
    ('fly', 'lax', 'shared-cpu-1x-2048mb', 0.0149, 0.15, 0.02);
