# Rust MCP Client Architecture Design

**Issue**: N01: Design Rust MCP client architecture  
**Date**: 2026-02-13  
**Status**: In Progress  

---

## 1. Executive Summary

This document defines the architecture for a Rust MCP (Model Context Protocol) client implementation that achieves parity with the TypeScript implementation while adding native stdio transport support.

### Goals
- Support HTTP/SSE transports (matching TypeScript implementation)
- Support stdio transport (new capability)
- OAuth 2.1 + PKCE authentication
- Tool bridge to A2R tool registry
- Health monitoring with auto-restart
- Policy engine integration

### Reference
- TypeScript Audit: `docs/analysis/mcp-typescript-audit.md`
- TypeScript Implementation: `6-ui/a2r-platform/src/lib/ai/mcp/`

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         A2R Kernel / Tools Gateway                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      McpClientManager                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   Server A  │  │   Server B  │  │   Server C  │  │   ...      │  │   │
│  │  │  (stdio)    │  │   (SSE)     │  │  (stdio)    │  │            │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────────┘  │   │
│  │         │                │                │                        │   │
│  └─────────┼────────────────┼────────────────┼────────────────────────┘   │
│            │                │                │                             │
│  ┌─────────▼────────────────┼────────────────┼────────────────────────┐   │
│  │         McpClient        │                │                        │   │
│  │  ┌───────────────────────┘                │                        │   │
│  │  │  ┌─────────────┐    ┌─────────────┐    │                        │   │
│  │  │  │McpClientState│    │McpTransport │◄───┼──────────────────┐    │   │
│  │  │  │- Connected  │    │ (trait)     │    │                  │    │   │
│  │  │  │- Ready      │    └──────┬──────┘    │                  │    │   │
│  │  │  │- Closed     │           │           │                  │    │   │
│  │  │  └─────────────┘           │           │                  │    │   │
│  │  │                            ▼           │                  │    │   │
│  │  │  ┌─────────────────────────────────────┴────────────────┐ │    │   │
│  │  │  │              Transport Implementations                │ │    │   │
│  │  │  │  ┌─────────────┐        ┌─────────────────────────┐   │ │    │   │
│  │  │  │  │StdioTransport│        │    SseTransport         │   │ │    │   │
│  │  │  │  └─────────────┘        └─────────────────────────┘   │ │    │   │
│  │  │  └────────────────────────────────────────────────────────┘ │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     McpToolBridge                                   │   │
│  │  - prefixed_name: "mcp__{server}__{tool}"                           │   │
│  │  - execute() → call_tool() → JSON-RPC                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Health Monitor                                   │   │
│  │  - Connection health checks                                         │   │
│  │  - Auto-restart with backoff                                        │   │
│  │  - Metrics collection                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Traits

### 3.1 Transport Trait

```rust
#[async_trait]
pub trait McpTransport: Send + Sync + std::fmt::Debug {
    /// Send a JSON-RPC request and wait for response
    async fn request(&self, method: &str, params: Option<Value>) -> Result<Value, McpError>;
    
    /// Send a JSON-RPC notification (no response expected)
    async fn notify(&self, method: &str, params: Option<Value>) -> Result<(), McpError>;
    
    /// Check if transport is healthy
    async fn is_healthy(&self) -> bool;
    
    /// Close the transport connection
    async fn close(&self) -> Result<(), McpError>;
    
    /// Get transport type
    fn transport_type(&self) -> TransportType;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportType {
    Stdio,
    Sse,
}
```

### 3.2 Client Trait

```rust
#[async_trait]
pub trait McpClient: Send + Sync {
    /// Initialize the MCP connection
    async fn initialize(&mut self) -> Result<InitializeResult, McpError>;
    
    /// List available tools
    async fn list_tools(&self) -> Result<Vec<Tool>, McpError>;
    
    /// Call a tool
    async fn call_tool(&self, name: &str, arguments: Value) -> Result<ToolResult, McpError>;
    
    /// Get client connection state
    fn state(&self) -> McpClientState;
    
    /// Shutdown the client
    async fn shutdown(&mut self) -> Result<(), McpError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpClientState {
    Disconnected,
    Connecting,
    Connected,
    Authenticating,
    Ready,
    Closed,
}
```

### 3.3 OAuth Provider Trait

```rust
#[async_trait]
pub trait OAuthProvider: Send + Sync {
    async fn client_information(&self) -> Result<Option<ClientRegistration>, OAuthError>;
    async fn save_client_information(&self, client: ClientRegistration) -> Result<(), OAuthError>;
    async fn tokens(&self) -> Result<Option<OAuthTokens>, OAuthError>;
    async fn save_tokens(&self, tokens: OAuthTokens) -> Result<(), OAuthError>;
    async fn redirect_to_authorization(&self, url: Url) -> Result<(), OAuthError>;
}
```

---

## 4. Transport Implementations

### 4.1 Stdio Transport
- Spawn MCP server as subprocess
- Line-delimited JSON-RPC over stdin/stdout
- Separate stderr reader for logging
- 30-second default request timeout
- Process cleanup on drop

### 4.2 SSE Transport
- HTTP POST for JSON-RPC requests
- HTTP GET with SSE for server→client messages
- Automatic reconnection with backoff
- OAuth Bearer token injection
- 60-second default timeout

---

## 5. OAuth 2.1 + PKCE Implementation

### 5.1 PKCE
- 128-byte random verifier
- S256 challenge computation
- Secure storage via OAuthProvider trait

### 5.2 Token Management
- Automatic refresh at 50% TTL
- Encrypted storage
- Session cleanup

---

## 6. Tool Bridge Integration

```rust
pub struct McpToolBridge {
    client: Arc<dyn McpClient>,
    server_name: String,
}

/// Format: "mcp__{server_name}__{tool_name}"
pub fn format_tool_name(server_name: &str, tool_name: &str) -> String {
    format!("mcp__{}__{}", sanitize_name(server_name), sanitize_name(tool_name))
}
```

---

## 7. Health Monitoring

- Connection health checks
- Auto-restart with exponential backoff
- Metrics collection (tool_calls, duration, connections)

---

## 8. Error Types

```rust
pub enum McpError {
    Transport(TransportError),
    JsonRpc { code: i32, message: String },
    OAuth(OAuthError),
    Timeout(Duration),
    ConnectionClosed,
}
```

---

## 9. Module Structure

```
crates/mcp-client/
├── src/
│   ├── lib.rs                    # Public exports
│   ├── client.rs                 # McpClient implementation
│   ├── manager.rs                # Multi-server manager
│   ├── transport/
│   │   ├── mod.rs
│   │   ├── stdio.rs
│   │   └── sse.rs
│   ├── oauth/
│   │   ├── mod.rs
│   │   ├── provider.rs
│   │   ├── flow.rs
│   │   └── pkce.rs
│   ├── protocol/
│   │   └── types.rs
│   ├── bridge/
│   │   └── tool_bridge.rs
│   └── health/
│       └── monitor.rs
```

---

## 10. Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Define MCP transport trait | ✅ |
| Define MCP client trait | ✅ |
| Design tool bridge integration | ✅ |
| Plan OAuth token storage | ✅ |
| Design health monitoring interface | ✅ |
| Define error types | ✅ |
| Review with team | ⏳ |

---

## 11. Next Steps

1. Create mcp-client crate
2. Implement transport layer (stdio + SSE)
3. Implement OAuth module
4. Implement client protocol
5. Implement tool bridge
6. Add health monitoring
7. Write tests
8. Integrate with tools-gateway
