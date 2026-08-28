-- Organization-scoped enrollment tokens for Private Fabric nodes.
-- Admins create these in the Cloud Console; daemons present the token once
-- during enrollment and receive a dedicated node token in return.

CREATE TABLE IF NOT EXISTS fabric_enrollment_tokens (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    display_name TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    node_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    CONSTRAINT fk_fabric_enrollment_tokens_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_fabric_enrollment_tokens_node
        FOREIGN KEY (node_id) REFERENCES fabric_nodes(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_fabric_enrollment_tokens_status
        CHECK (status IN ('pending', 'used', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_fabric_enrollment_tokens_org_status
    ON fabric_enrollment_tokens(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_fabric_enrollment_tokens_hash
    ON fabric_enrollment_tokens(token_hash);
