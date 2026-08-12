-- Admin-managed MCP tunnels: organization-scoped tunnels for connecting to
-- externally hosted MCP servers with optional mTLS/OAuth auth policies.
CREATE TABLE IF NOT EXISTS admin_mcp_tunnels (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL,
    name               TEXT NOT NULL,
    description        TEXT,
    endpoint_url       TEXT NOT NULL,
    client_cert_pem    TEXT,
    oauth_issuer       TEXT,
    audience           TEXT,
    tunnel_token       TEXT NOT NULL,
    created_by         TEXT NOT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_mcp_tunnels_org
    ON admin_mcp_tunnels(organization_id);

CREATE INDEX IF NOT EXISTS idx_admin_mcp_tunnels_name
    ON admin_mcp_tunnels(organization_id, name);
