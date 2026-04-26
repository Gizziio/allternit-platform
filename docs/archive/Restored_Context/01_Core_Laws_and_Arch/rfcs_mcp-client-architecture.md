# RFC: MCP Client Architecture for Allternit

**Status**: Draft  
**Date**: 2026-02-13  
**Author**: AI Code Assistant  
**Issue**: allternit-ceg (N01)  

---

## Summary

Design a Rust MCP (Model Context Protocol) client that integrates with Allternit's tools-gateway, matching the capabilities of the existing TypeScript implementation while adding stdio transport support.

---

## Background

### Existing TypeScript Implementation
The Allternit platform has a production-ready MCP client using `@ai-sdk/mcp` with:
- OAuth 2.1 + PKCE authentication
- HTTP/SSE transports
- PostgreSQL session persistence
- Tool namespacing

### Goals for Rust Implementation
1. **Parity**: Match TypeScript capabilities
2. **Addition**: Add stdio transport (not in TS)
3. **Integration**: Connect to Allternit policy engine
4. **Performance**: Native Rust efficiency

---

## Architecture

### Crate Structure

```
services/mcp/
├── Cargo.toml
├── src/
│   ├── lib.rs                 # Public API
│   ├── client.rs              # Core MCP client
│   ├── transport/
│   │   ├── mod.rs             # Transport trait
│   │   ├── stdio.rs           # Stdio transport
│   │   └── sse.rs             # HTTP/SSE transport
│   ├── auth/
│   │   ├── mod.rs             # Auth trait
│   │   └── oauth.rs           # OAuth 2.1 + PKCE
│   ├── types.rs               # Protocol types
│   └── error.rs               # Error types
└── tests/
```

### Core Traits

```rust
// Transport abstraction
#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn connect(&mut self) -> Result<(), McpError>;
    async fn send(&mut self, message: JsonRpcMessage) -> Result<(), McpError>;
    async fn receive(&mut self) -> Result<Option<JsonRpcMessage>, McpError>;
    async fn close(&mut self) -> Result<(), McpError>;
    fn is_connected(&self) -> bool;
}

// Auth abstraction
#[async_trait]
pub trait McpAuth: Send + Sync {
    async fn authenticate(&self, transport: &mut dyn McpTransport) -> Result<(), McpError>;
    async fn refresh_token(&self) -> Result<(), McpError>;
    fn is_authenticated(&self) -> bool;
}
```

### Client Structure

```rust
pub struct McpClient {
    transport: Box<dyn McpTransport>,
    auth: Option<Box<dyn McpAuth>>,
    state: ClientState,
    request_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>>,
}

impl McpClient {
    pub async fn connect(&mut self) -> Result<InitializeResult, McpError>;
    pub async fn list_tools(&self) -> Result<Vec<Tool>, McpError>;
    pub async fn call_tool(&self, name: &str, args: Value) -> Result<ToolResult, McpError>;
    pub async fn list_resources(&self) -> Result<Vec<Resource>, McpError>;
    pub async fn read_resource(&self, uri: &str) -> Result<ResourceContent, McpError>;
    pub async fn close(&mut self) -> Result<(), McpError>;
}
```

### Transport Implementations

#### Stdio Transport
```rust
pub struct StdioTransport {
    process: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    stderr: Option<ChildStderr>,
}

impl StdioTransport {
    pub fn new(command: &str, args: &[String]) -> Result<Self, McpError>;
}
```

#### SSE Transport
```rust
pub struct SseTransport {
    client: reqwest::Client,
    endpoint: Url,
    event_source: Option<EventSource>,
    message_tx: mpsc::Sender<JsonRpcMessage>,
    message_rx: mpsc::Receiver<JsonRpcMessage>,
}
```

### OAuth 2.1 + PKCE

```rust
pub struct OAuthClient {
    client_id: String,
    redirect_uri: Url,
    token_store: Arc<dyn TokenStore>,
    pkce_verifier: Option<String>,
}

impl McpAuth for OAuthClient {
    async fn authenticate(&self, transport: &mut dyn McpTransport) -> Result<(), McpError> {
        // 1. Generate PKCE verifier
        // 2. Build authorization URL
        // 3. Open browser or return URL
        // 4. Exchange code for token
        // 5. Store token
    }
}
```

### Integration with Allternit Tools Gateway

```rust
// Adapter: MCP tool -> Allternit tool
pub struct McpToolAdapter {
    client: Arc<McpClient>,
    server_id: String,
}

impl Tool for McpToolAdapter {
    fn definition(&self) -> ToolDefinition {
        // Convert MCP tool to Allternit tool definition
    }
    
    async fn execute(&self, args: Value) -> Result<ToolResult, ToolError> {
        // Execute via MCP client
        // Apply Allternit policy checks
        // Sanitize results
    }
}

// Registry integration
pub struct McpToolRegistry {
    clients: HashMap<String, Arc<McpClient>>,
    adapters: HashMap<String, McpToolAdapter>,
}

impl McpToolRegistry {
    pub async fn register_server(&mut self, config: ServerConfig) -> Result<(), McpError>;
    pub async fn unregister_server(&mut self, id: &str) -> Result<(), McpError>;
    pub fn list_tools(&self) -> Vec<ToolDefinition>;
}
```

### Health Monitoring

```rust
pub struct McpHealthMonitor {
    clients: Arc<RwLock<HashMap<String, Arc<McpClient>>>>,
    check_interval: Duration,
    backoff: ExponentialBackoff,
}

impl McpHealthMonitor {
    pub async fn start(&self) {
        loop {
            for (id, client) in self.clients.read().await.iter() {
                if let Err(e) = self.check_health(client).await {
                    tracing::warn!("MCP server {} unhealthy: {}", id, e);
                    self.restart_server(id).await;
                }
            }
            tokio::time::sleep(self.check_interval).await;
        }
    }
}
```

---

## Protocol Types

```rust
// JSON-RPC 2.0
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum JsonRpcMessage {
    Request(JsonRpcRequest),
    Response(JsonRpcResponse),
    Notification(JsonRpcNotification),
}

// MCP Initialize
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeRequest {
    pub protocol_version: String,
    pub capabilities: ClientCapabilities,
    pub client_info: Implementation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    pub protocol_version: String,
    pub capabilities: ServerCapabilities,
    pub server_info: Implementation,
}

// MCP Tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: Vec<ToolContent>,
    pub is_error: Option<bool>,
}
```

---

## Error Handling

```rust
#[derive(Debug, thiserror::Error)]
pub enum McpError {
    #[error("transport error: {0}")]
    Transport(String),
    
    #[error("protocol error: {0}")]
    Protocol(String),
    
    #[error("authentication error: {0}")]
    Auth(String),
    
    #[error("server error: {code} - {message}")]
    Server { code: i32, message: String },
    
    #[error("timeout")]
    Timeout,
    
    #[error("not connected")]
    NotConnected,
}
```

---

## Database Schema

```sql
-- MCP servers
CREATE TABLE mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    transport_type TEXT NOT NULL, -- 'stdio', 'sse'
    transport_config TEXT NOT NULL, -- JSON
    auth_type TEXT, -- 'oauth', 'api_key', null
    auth_config TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enabled BOOLEAN DEFAULT TRUE
);

-- OAuth sessions
CREATE TABLE mcp_oauth_sessions (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES mcp_servers(id),
    state TEXT NOT NULL,
    code_verifier TEXT,
    client_info TEXT, -- JSON
    tokens TEXT, -- JSON (encrypted)
    is_authenticated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Health status
CREATE TABLE mcp_health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES mcp_servers(id),
    status TEXT NOT NULL, -- 'healthy', 'unhealthy', 'unknown'
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Implementation Phases

### Phase 1: Core Client (Week 1)
- [ ] JSON-RPC types
- [ ] Transport trait
- [ ] Stdio transport
- [ ] Basic client

### Phase 2: HTTP/SSE (Week 1)
- [ ] SSE transport
- [ ] OAuth 2.1 + PKCE
- [ ] Token storage

### Phase 3: Tools Integration (Week 2)
- [ ] Tool adapter
- [ ] Registry integration
- [ ] Policy hooks

### Phase 4: Health & Monitoring (Week 2)
- [ ] Health checks
- [ ] Auto-restart
- [ ] Metrics

---

## Acceptance Criteria

- [ ] Stdio transport works with reference MCP servers
- [ ] HTTP/SSE transport matches TypeScript implementation
- [ ] OAuth 2.1 + PKCE authentication
- [ ] Tools appear in Allternit registry
- [ ] Policy engine integration
- [ ] Health monitoring with auto-restart
- [ ] Database persistence
- [ ] End-to-end tests pass

---

## References

- TypeScript implementation: `surfaces/allternit-platform/src/lib/ai/mcp/`
- Moltis MCP: https://github.com/moltis-org/moltis/tree/main/crates/mcp
- MCP Spec: https://spec.modelcontextprotocol.io/
