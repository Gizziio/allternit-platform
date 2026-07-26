-- BYO-VPS: cloud_instances gains DigitalOcean as a provider. SQLite cannot
-- ALTER a CHECK constraint, so the table is rebuilt with the expanded set
-- (plus 'other' for boxes adopted over universal SSH that are tracked for
-- lifecycle only).
--
-- No other table references cloud_instances (verified across migrations), so
-- legacy_alter_table is safe here: it keeps RENAME from reparsing every
-- trigger in the schema (which trips over the 019 triggers under sqlx's
-- pragmas) — there are no foreign references that need rewriting.

PRAGMA legacy_alter_table=ON;

CREATE TABLE IF NOT EXISTS cloud_instances_new (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,           -- Provider's server ID (e.g., Hetzner server ID, DO droplet ID)
    provider TEXT NOT NULL             -- Provider type: hetzner, digitalocean, aws, other
        CHECK (provider IN ('hetzner', 'digitalocean', 'aws', 'other')),
    name TEXT NOT NULL,                -- Human-readable instance name
    region TEXT NOT NULL,              -- Region/location (e.g., fsn1, nyc3, us-east-1)
    instance_type TEXT NOT NULL,       -- Instance type/size (e.g., cx21, s-1vcpu-2gb)
    status TEXT NOT NULL               -- Instance status
        CHECK (status IN ('running', 'stopped', 'creating', 'destroying', 'error')),
    public_ip TEXT,                    -- Public IP address
    private_ip TEXT,                   -- Private/internal IP address (mesh IPv4 for BYO-VPS)
    ssh_key TEXT,                      -- SSH key name or fingerprint used
    run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,  -- Associated run (if any)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cloud_instances_new (
    id, server_id, provider, name, region, instance_type, status,
    public_ip, private_ip, ssh_key, run_id, created_at, updated_at
)
SELECT
    id, server_id, provider, name, region, instance_type, status,
    public_ip, private_ip, ssh_key, run_id, created_at, updated_at
FROM cloud_instances;

DROP TABLE cloud_instances;
ALTER TABLE cloud_instances_new RENAME TO cloud_instances;

CREATE INDEX IF NOT EXISTS idx_cloud_instances_provider ON cloud_instances(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_instances_status ON cloud_instances(status);

PRAGMA legacy_alter_table=OFF;
