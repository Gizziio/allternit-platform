-- Desktop Cloud fleet: cloud-provisioned Incus hosts and sandbox placements.

CREATE TABLE IF NOT EXISTS desktop_hosts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    cloud_instance_id TEXT,
    region TEXT,
    instance_type TEXT,
    tailscale_ip TEXT,
    incus_url TEXT NOT NULL,
    incus_ca_cert TEXT,
    status TEXT NOT NULL,
    total_memory_mb INTEGER NOT NULL DEFAULT 0,
    used_memory_mb INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME,
    decommission_after DATETIME
);

CREATE TABLE IF NOT EXISTS desktop_host_placements (
    sandbox_id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES desktop_hosts(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_desktop_hosts_status ON desktop_hosts(status);
CREATE INDEX IF NOT EXISTS idx_desktop_hosts_provider ON desktop_hosts(provider);
CREATE INDEX IF NOT EXISTS idx_desktop_host_placements_host_id ON desktop_host_placements(host_id);
