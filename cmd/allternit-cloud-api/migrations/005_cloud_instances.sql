-- Cloud Instances table for A2R Cloud API
-- Stores cloud provider instances (Hetzner, AWS, etc.) with their metadata

CREATE TABLE IF NOT EXISTS cloud_instances (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,           -- Provider's server ID (e.g., Hetzner server ID)
    provider TEXT NOT NULL             -- Provider type: hetzner, aws
        CHECK (provider IN ('hetzner', 'aws')),
    name TEXT NOT NULL,                -- Human-readable instance name
    region TEXT NOT NULL,              -- Region/location (e.g., fsn1, us-east-1)
    instance_type TEXT NOT NULL,       -- Instance type/size (e.g., cx11, t3.micro)
    status TEXT NOT NULL               -- Instance status
        CHECK (status IN ('running', 'stopped', 'creating', 'destroying', 'error')),
    public_ip TEXT,                    -- Public IP address
    private_ip TEXT,                   -- Private/internal IP address
    ssh_key TEXT,                      -- SSH key name or fingerprint used
    run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,  -- Associated run (if any)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cloud_instances_provider ON cloud_instances(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_instances_status ON cloud_instances(status);
CREATE INDEX IF NOT EXISTS idx_cloud_instances_run_id ON cloud_instances(run_id);
CREATE INDEX IF NOT EXISTS idx_cloud_instances_region ON cloud_instances(region);
CREATE INDEX IF NOT EXISTS idx_cloud_instances_created_at ON cloud_instances(created_at DESC);

-- Index for finding instances by server_id (used when syncing with provider)
CREATE INDEX IF NOT EXISTS idx_cloud_instances_server_id ON cloud_instances(server_id);

-- Trigger for updating updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_cloud_instances_timestamp 
AFTER UPDATE ON cloud_instances
BEGIN
    UPDATE cloud_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
