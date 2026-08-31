-- Private Fabric node API token.
-- After enrollment, the control plane issues a dedicated node token. The
-- enrollment token is only used for the initial enroll request; all later
-- daemon calls authenticate with the node token.
ALTER TABLE fabric_nodes ADD COLUMN node_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fabric_nodes_node_token
    ON fabric_nodes(node_token_hash);
