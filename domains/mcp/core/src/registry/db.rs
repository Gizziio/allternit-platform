//! Database schema and queries for MCP registry

use sqlx::FromRow;

// ============================================================================
// Schema Definitions
// ============================================================================

/// Schema for MCP servers table
pub const SCHEMA_SERVERS: &str = r#"
CREATE TABLE IF NOT EXISTS mcp_servers (
    server_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    transport_type TEXT NOT NULL CHECK(transport_type IN ('stdio', 'sse')),
    stdio_config TEXT,
    sse_config TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    auto_connect INTEGER NOT NULL DEFAULT 0,
    tool_prefix TEXT,
    safety_tier INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_auto_connect ON mcp_servers(auto_connect);
"#;

/// Schema for server status table
pub const SCHEMA_STATUS: &str = r#"
CREATE TABLE IF NOT EXISTS mcp_server_status (
    server_id TEXT PRIMARY KEY,
    connection_state TEXT NOT NULL DEFAULT 'disconnected' 
        CHECK(connection_state IN ('disconnected', 'connecting', 'connected', 'failed')),
    last_connected_at INTEGER,
    last_disconnected_at INTEGER,
    last_error TEXT,
    connection_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    health_check_failures INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (server_id) REFERENCES mcp_servers(server_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_status_state ON mcp_server_status(connection_state);
"#;

/// Schema for OAuth tokens table
pub const SCHEMA_OAUTH: &str = r#"
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    server_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at INTEGER,
    scope TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (server_id) REFERENCES mcp_servers(server_id) ON DELETE CASCADE
);
"#;

// ============================================================================
// Server Queries
// ============================================================================

/// Upsert server configuration
pub const UPSERT_SERVER: &str = r#"
INSERT INTO mcp_servers (
    server_id, name, description, transport_type, stdio_config, sse_config,
    enabled, auto_connect, tool_prefix, safety_tier, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
ON CONFLICT(server_id) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    transport_type = excluded.transport_type,
    stdio_config = excluded.stdio_config,
    sse_config = excluded.sse_config,
    enabled = excluded.enabled,
    auto_connect = excluded.auto_connect,
    tool_prefix = excluded.tool_prefix,
    safety_tier = excluded.safety_tier,
    updated_at = strftime('%s', 'now')
"#;

/// Select server by ID
pub const SELECT_SERVER: &str = r#"
SELECT 
    server_id, name, description, transport_type, stdio_config, sse_config,
    enabled, auto_connect, tool_prefix, safety_tier,
    created_at, updated_at
FROM mcp_servers
WHERE server_id = ?
"#;

/// Select all servers
pub const SELECT_ALL_SERVERS: &str = r#"
SELECT 
    server_id, name, description, transport_type, stdio_config, sse_config,
    enabled, auto_connect, tool_prefix, safety_tier,
    created_at, updated_at
FROM mcp_servers
ORDER BY name
"#;

/// Select enabled servers
pub const SELECT_ENABLED_SERVERS: &str = r#"
SELECT 
    server_id, name, description, transport_type, stdio_config, sse_config,
    enabled, auto_connect, tool_prefix, safety_tier,
    created_at, updated_at
FROM mcp_servers
WHERE enabled = 1
ORDER BY name
"#;

/// Select auto-connect servers
pub const SELECT_AUTO_CONNECT_SERVERS: &str = r#"
SELECT 
    server_id, name, description, transport_type, stdio_config, sse_config,
    enabled, auto_connect, tool_prefix, safety_tier,
    created_at, updated_at
FROM mcp_servers
WHERE enabled = 1 AND auto_connect = 1
ORDER BY name
"#;

/// Delete server
pub const DELETE_SERVER: &str = r#"
DELETE FROM mcp_servers WHERE server_id = ?
"#;

// ============================================================================
// Status Queries
// ============================================================================

/// Initialize status record (insert if not exists)
pub const INIT_STATUS: &str = r#"
INSERT OR IGNORE INTO mcp_server_status (server_id)
VALUES (?)
"#;

/// Upsert status
pub const UPSERT_STATUS: &str = r#"
INSERT INTO mcp_server_status (
    server_id, connection_state, last_connected_at, last_disconnected_at,
    last_error, connection_count, failure_count, health_check_failures, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
ON CONFLICT(server_id) DO UPDATE SET
    connection_state = excluded.connection_state,
    last_connected_at = COALESCE(excluded.last_connected_at, last_connected_at),
    last_disconnected_at = COALESCE(excluded.last_disconnected_at, last_disconnected_at),
    last_error = excluded.last_error,
    connection_count = excluded.connection_count,
    failure_count = excluded.failure_count,
    health_check_failures = excluded.health_check_failures,
    updated_at = strftime('%s', 'now')
"#;

/// Select status by server ID
pub const SELECT_STATUS: &str = r#"
SELECT 
    server_id, connection_state, last_connected_at, last_disconnected_at,
    last_error, connection_count, failure_count, health_check_failures, updated_at
FROM mcp_server_status
WHERE server_id = ?
"#;

/// Record connection success
pub const RECORD_CONNECTION_SUCCESS: &str = r#"
UPDATE mcp_server_status SET
    connection_state = 'connected',
    last_connected_at = ?,
    connection_count = connection_count + 1,
    health_check_failures = 0,
    updated_at = strftime('%s', 'now')
WHERE server_id = ?
"#;

/// Record connection failure
pub const RECORD_CONNECTION_FAILURE: &str = r#"
UPDATE mcp_server_status SET
    connection_state = 'failed',
    last_error = ?,
    failure_count = failure_count + 1,
    updated_at = strftime('%s', 'now')
WHERE server_id = ?
"#;

/// Record health check failure
pub const RECORD_HEALTH_FAILURE: &str = r#"
UPDATE mcp_server_status SET
    health_check_failures = health_check_failures + 1,
    updated_at = strftime('%s', 'now')
WHERE server_id = ?
"#;

/// Reset health check failures
pub const RESET_HEALTH_FAILURES: &str = r#"
UPDATE mcp_server_status SET
    health_check_failures = 0,
    updated_at = strftime('%s', 'now')
WHERE server_id = ?
"#;

/// Delete status
pub const DELETE_STATUS: &str = r#"
DELETE FROM mcp_server_status WHERE server_id = ?
"#;

// ============================================================================
// OAuth Queries
// ============================================================================

/// Upsert OAuth token
pub const UPSERT_OAUTH: &str = r#"
INSERT INTO mcp_oauth_tokens (
    server_id, access_token, refresh_token, token_type, expires_at, scope, updated_at
) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
ON CONFLICT(server_id) DO UPDATE SET
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    token_type = excluded.token_type,
    expires_at = excluded.expires_at,
    scope = excluded.scope,
    updated_at = strftime('%s', 'now')
"#;

/// Select OAuth token
pub const SELECT_OAUTH: &str = r#"
SELECT 
    server_id, access_token, refresh_token, token_type, expires_at, scope, updated_at
FROM mcp_oauth_tokens
WHERE server_id = ?
"#;

/// Delete OAuth token
pub const DELETE_OAUTH: &str = r#"
DELETE FROM mcp_oauth_tokens WHERE server_id = ?
"#;

// ============================================================================
// Row Types
// ============================================================================

/// Row type for server queries
#[derive(Debug, FromRow)]
pub struct ServerRow {
    pub server_id: String,
    pub name: String,
    pub description: String,
    pub transport_type: String,
    pub stdio_config: Option<String>,
    pub sse_config: Option<String>,
    pub enabled: bool,
    pub auto_connect: bool,
    pub tool_prefix: Option<String>,
    pub safety_tier: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Row type for status queries
#[derive(Debug, FromRow)]
pub struct StatusRow {
    pub server_id: String,
    pub connection_state: String,
    pub last_connected_at: Option<i64>,
    pub last_disconnected_at: Option<i64>,
    pub last_error: Option<String>,
    pub connection_count: i64,
    pub failure_count: i64,
    pub health_check_failures: i64,
    pub updated_at: i64,
}

/// Row type for OAuth queries
#[derive(Debug, FromRow)]
pub struct OAuthRow {
    pub server_id: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_at: Option<i64>,
    pub scope: Option<String>,
    pub updated_at: i64,
}
