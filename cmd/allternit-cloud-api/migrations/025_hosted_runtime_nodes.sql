-- Multi-node workload scheduling: docker hosts that hosted runtime
-- containers can be placed on, and the node assignment per instance.
--
-- docker_host is 'local' for the control-plane daemon or a docker CLI -H
-- target (e.g. ssh://root@allternit-standby). Instances with node_id NULL
-- predate placement and count against the node whose docker_host is 'local'.

CREATE TABLE IF NOT EXISTS hosted_runtime_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    docker_host TEXT NOT NULL,
    tailnet_ip TEXT,
    total_memory_mb INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE hosted_runtime_instances
    ADD COLUMN node_id TEXT REFERENCES hosted_runtime_nodes(id);

-- The standby node is 'draining' on purpose: it is the HA reserve and is
-- only flipped to 'active' manually during failover.
INSERT OR IGNORE INTO hosted_runtime_nodes (id, name, docker_host, tailnet_ip, total_memory_mb, status) VALUES
    ('node-mail', 'mail (control plane)', 'local', '100.108.37.126', 17408, 'active'),
    ('node-standby', 'allternit-standby (HA reserve)', 'ssh://root@allternit-standby', '100.83.199.24', 17408, 'draining');
