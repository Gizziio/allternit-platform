-- First-party desktop/VPS runtime identity and device-code pairing.
-- Human approval is performed with a Clerk session; runtimes receive their own
-- revocable credential and never persist the human's Clerk token.

CREATE TABLE IF NOT EXISTS runtime_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    name TEXT NOT NULL,
    runtime_type TEXT NOT NULL CHECK (runtime_type IN ('desktop', 'vps')),
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

CREATE INDEX IF NOT EXISTS idx_runtime_devices_user ON runtime_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_runtime_devices_org ON runtime_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_runtime_devices_credential ON runtime_devices(credential_hash);
CREATE INDEX IF NOT EXISTS idx_runtime_devices_status ON runtime_devices(status);

CREATE TABLE IF NOT EXISTS runtime_pairings (
    id TEXT PRIMARY KEY,
    device_code_hash TEXT NOT NULL UNIQUE,
    user_code TEXT NOT NULL UNIQUE,
    challenge TEXT NOT NULL,
    public_key TEXT NOT NULL,
    public_key_fingerprint TEXT NOT NULL,
    name TEXT NOT NULL,
    runtime_type TEXT NOT NULL CHECK (runtime_type IN ('desktop', 'vps')),
    hostname TEXT,
    platform TEXT,
    version TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'denied', 'expired')),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT,
    runtime_id TEXT REFERENCES runtime_devices(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    approved_at TIMESTAMP,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_runtime_pairings_code ON runtime_pairings(user_code);
CREATE INDEX IF NOT EXISTS idx_runtime_pairings_status ON runtime_pairings(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_runtime_pairings_user ON runtime_pairings(user_id);

CREATE TRIGGER IF NOT EXISTS update_runtime_devices_timestamp
AFTER UPDATE ON runtime_devices
BEGIN
    UPDATE runtime_devices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
