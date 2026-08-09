-- MCP tunnel security scaffold: mTLS + OAuth binding for a tunnel.
-- A row optionally locks a tunnel to one client certificate (SHA-256 thumbprint
-- computed from the PEM) and/or one OAuth issuer + audience pair. When no row
-- exists for a tunnel_id, the tunnel remains unenforced (fail-open) so existing
-- MCP server attachments keep working until an admin opts in.
CREATE TABLE IF NOT EXISTS mcp_tunnel_auth (
    tunnel_id          TEXT PRIMARY KEY,
    client_cert_pem    TEXT,
    oauth_issuer       TEXT,
    audience           TEXT,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcp_tunnel_auth_issuer
    ON mcp_tunnel_auth(oauth_issuer);
