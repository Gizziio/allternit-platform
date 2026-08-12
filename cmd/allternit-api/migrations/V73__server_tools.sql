-- Server-side tool registry.
--
-- Server tools are user-defined scripts that run inside the platform sandbox
-- (WebVM / WASM / VM driver) instead of on the caller's machine. They are
-- scoped to an organization and can be invoked through the same `/tools/execute`
-- and MCP surfaces as native tools.

CREATE TABLE IF NOT EXISTS server_tools (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    runtime         TEXT NOT NULL,
    source          TEXT NOT NULL,
    entrypoint      TEXT,
    env             TEXT NOT NULL DEFAULT '{}',
    network_enabled INTEGER NOT NULL DEFAULT 0,
    timeout_secs    INTEGER NOT NULL DEFAULT 30,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_server_tools_org
    ON server_tools(org_id, name);
