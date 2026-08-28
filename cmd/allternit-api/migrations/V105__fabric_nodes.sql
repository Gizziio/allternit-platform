-- Private Fabric nodes (BYOC / customer-owned capacity).
-- A node enrolls with the control plane, is approved by an admin, then
-- heartbeats capacity and accepts execution assignments.

CREATE TABLE IF NOT EXISTS fabric_nodes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'inactive', 'draining')),
    region TEXT,
    -- Public identity fingerprint derived from the node's mTLS client cert.
    identity_fingerprint TEXT UNIQUE,
    -- Enrollment token presented by the node before approval. Hashed.
    enrollment_token_hash TEXT,
    labels TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    last_heartbeat_at TIMESTAMP,
    CONSTRAINT fk_fabric_nodes_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_nodes_org_status
    ON fabric_nodes(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_fabric_nodes_identity
    ON fabric_nodes(identity_fingerprint);

-- Latest capacity snapshot reported by a node heartbeat.
CREATE TABLE IF NOT EXISTS fabric_node_capacity (
    node_id TEXT PRIMARY KEY,
    total_vcpu INTEGER NOT NULL DEFAULT 0,
    total_memory_mib INTEGER NOT NULL DEFAULT 0,
    total_gpu_vram_mib INTEGER NOT NULL DEFAULT 0,
    gpu_model TEXT,
    free_vcpu INTEGER NOT NULL DEFAULT 0,
    free_memory_mib INTEGER NOT NULL DEFAULT 0,
    free_gpu_vram_mib INTEGER NOT NULL DEFAULT 0,
    -- JSON array of active workload IDs currently running on the node.
    active_workloads TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fabric_node_capacity_node
        FOREIGN KEY (node_id) REFERENCES fabric_nodes(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_node_capacity_free
    ON fabric_node_capacity(free_memory_mib, free_gpu_vram_mib);

-- Assignments sent to a node by the control plane.
CREATE TABLE IF NOT EXISTS fabric_node_assignments (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    class TEXT NOT NULL,
    requested_vcpu INTEGER NOT NULL DEFAULT 0,
    requested_memory_mib INTEGER NOT NULL DEFAULT 0,
    requested_gpu_vram_mib INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'running', 'failed', 'completed')),
    payload TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fabric_node_assignments_node
        FOREIGN KEY (node_id) REFERENCES fabric_nodes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_fabric_node_assignments_resource
        FOREIGN KEY (resource_id) REFERENCES fabric_resources(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_node_assignments_node_status
    ON fabric_node_assignments(node_id, status);
