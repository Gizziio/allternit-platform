# MCP TypeScript Implementation Audit

**Date**: 2026-02-13  
**Auditor**: AI Code Assistant  
**Scope**: A2R TypeScript MCP Client vs Moltis Rust Reference Implementation  

---

## 1. Executive Summary

The A2R platform implements a production-ready MCP (Model Context Protocol) client using the Vercel AI SDK (`@ai-sdk/mcp`), supporting OAuth 2.1 + PKCE authentication, HTTP/SSE transports, and PostgreSQL-backed session persistence. The implementation is approximately 850 lines of TypeScript across 5 core files, leveraging higher-level SDK abstractions. The Moltis Rust implementation provides a lower-level alternative with native JSON-RPC handling, supporting both stdio and HTTP transports but lacking built-in OAuth support.

**Key Gap**: The TypeScript implementation relies heavily on the AI SDK's internal OAuth and transport handling, which would require significant reimplementation in Rust to achieve feature parity.

---

## 2. Architecture Overview

### 2.1 A2R TypeScript Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              A2R Platform UI                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                     │
│  │   Chat UI    │   │  Tool Exec   │   │ OAuth Flow   │                     │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                     │
│         │                  │                  │                             │
│  ┌──────▼──────────────────▼──────────────────▼───────┐                     │
│  │              tools.ts (Tool Aggregation)           │                     │
│  └──────┬──────────────────────────────────────┬──────┘                     │
│         │                                      │                             │
│  ┌──────▼──────────────┐           ┌───────────▼────────┐                   │
│  │   MCPClient         │           │   Native Tools     │                   │
│  │   (mcp-client.ts)   │           │   (weather, etc)   │                   │
│  └──────┬──────────────┘           └────────────────────┘                   │
│         │                                                                   │
│  ┌──────▼──────────────┐                                                    │
│  │McpOAuthClientProvider│ ←─────────────────────┐                          │
│  │(mcp-oauth-provider.ts)│                      │                          │
│  └──────┬──────────────┘                        │                          │
│         │                                        │                          │
│  ┌──────▼──────────────┐     ┌───────────────────▼──────────┐              │
│  │   @ai-sdk/mcp       │     │      PostgreSQL              │              │
│  │   (external SDK)    │     │  ┌──────────────────────┐    │              │
│  │                     │     │  │ mcpOAuthSession      │    │              │
│  │  ┌───────────────┐  │     │  │ - state (PK)         │    │              │
│  │  │  HTTP/SSE     │  │     │  │ - codeVerifier       │    │              │
│  │  │  Transport    │  │     │  │ - clientInfo         │    │              │
│  │  └───────────────┘  │     │  │ - tokens             │    │              │
│  │  ┌───────────────┐  │     │  │ - isAuthenticated    │    │              │
│  │  │  OAuth 2.1    │  │     │  └──────────────────────┘    │              │
│  │  │  + PKCE       │  │     │                              │              │
│  │  └───────────────┘  │     │  ┌──────────────────────┐    │              │
│  └─────────────────────┘     │  │ mcpConnector         │    │              │
│                              │  │ - nameId (namespace) │    │              │
│  ┌─────────────────────┐     │  │ - url, type          │    │              │
│  │   Next.js Cache     │     │  │ - enabled            │    │              │
│  │  ┌───────────────┐  │     │  └──────────────────────┘    │              │
│  │  │  5-min TTL    │  │     └──────────────────────────────┘              │
│  │  │  connection   │  │                                                   │
│  │  │  discovery    │  │                                                   │
│  │  └───────────────┘  │                                                   │
│  └─────────────────────┘                                                   │
│                                                                            │
│  ┌─────────────────────┐     ┌──────────────────────────┐                 │
│  │   mcp-name-id.ts    │     │  Kernel Integration      │                 │
│  │  (Tool namespacing) │     │  (mcp.ts - stub)         │                 │
│  └─────────────────────┘     └──────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Moltis Rust Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Moltis Agent System                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        McpManager                                   │   │
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
│  │  │  │  │             │        │                         │   │ │    │   │
│  │  │  │  │- spawn()    │        │- HTTP POST (requests)   │   │ │    │   │
│  │  │  │  │- request()  │        │- HTTP GET (SSE events)  │   │ │    │   │
│  │  │  │  │- notify()   │        │- request()              │   │ │    │   │
│  │  │  │  │- kill()     │        │- notify()               │   │ │    │   │
│  │  │  │  │             │        │                         │   │ │    │   │
│  │  │  │  └─────────────┘        └─────────────────────────┘   │ │    │   │
│  │  │  └────────────────────────────────────────────────────────┘ │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     McpToolBridge                                   │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  McpAgentTool trait (adapter to AgentTool system)             │  │   │
│  │  │  - prefixed_name: "mcp__{server}__{tool}"                     │  │   │
│  │  │  - execute() → call_tool() → JSON-RPC                         │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    McpRegistry                                      │   │
│  │  - JSON file persistence                                            │   │
│  │  - Server configs: command, args, env, enabled, transport type      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Protocol Layer (types.rs)                        │   │
│  │  - JSON-RPC 2.0: Request, Response, Notification, Error             │   │
│  │  - MCP Protocol: Initialize, Tools/List, Tools/Call                 │   │
│  │  - Protocol Version: "2024-11-05"                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Matrix

| Feature | A2R TypeScript | Moltis Rust | Notes |
|---------|---------------|-------------|-------|
| **Core Protocol** | | | |
| JSON-RPC 2.0 | ✅ (SDK internal) | ✅ (native impl) | TS: hidden in SDK; Rust: explicit types |
| MCP Protocol Version | "2024-11-05" (via SDK) | "2024-11-05" (explicit) | Same protocol version |
| Initialize Handshake | ✅ (SDK internal) | ✅ (explicit) | Rust: manual initialize + notify |
| **Transports** | | | |
| HTTP Transport | ✅ (SDK internal) | ✅ (SseTransport) | Both support HTTP POST |
| SSE Transport | ✅ (SDK internal) | ✅ (SseTransport) | Rust: SSE events via HTTP GET |
| Stdio Transport | ❌ | ✅ (StdioTransport) | **Gap**: TS lacks local process support |
| WebSocket Transport | ❌ | ❌ | Neither implements |
| **Authentication** | | | |
| OAuth 2.1 + PKCE | ✅ (full impl) | ❌ | **Major Gap**: Rust has no OAuth |
| Basic Auth | ✅ (headers) | ❌ | TS: via connector headers |
| Bearer Token | ✅ (SDK internal) | ❌ | TS: handled by SDK |
| Token Refresh | ✅ (SDK internal) | ❌ | TS: automatic refresh |
| Dynamic Client Registration | ✅ (SDK internal) | ❌ | MCP OAuth spec feature |
| **Capabilities** | | | |
| Tools/List | ✅ | ✅ | Both supported |
| Tools/Call | ✅ | ✅ | Both supported |
| Resources/List | ✅ | ❌ | **Gap**: Rust missing |
| Resources/Read | ✅ | ❌ | **Gap**: Rust missing |
| Prompts/List | ✅ (partial) | ❌ | TS: experimental, may fail silently |
| Sampling | ❌ | ❌ | Neither implements |
| Roots | ❌ | ❌ | Neither implements |
| **Tool Management** | | | |
| Tool Namespacing | ✅ (mcp-name-id.ts) | ✅ (tool_bridge.rs) | Different separators: TS=`__`, Rust=`__` |
| Global Tools | ✅ (userId=null) | ❌ | **Gap**: Rust no global concept |
| Tool Caching | ✅ (Next.js cache) | ❌ | TS: 5-min TTL on discovery |
| Connection Pooling | ✅ (client map) | ✅ (McpManager) | Both maintain client collections |
| **Persistence** | | | |
| Session Storage | ✅ (PostgreSQL) | ❌ (in-memory only) | TS: full OAuth session persistence |
| Server Registry | ✅ (PostgreSQL) | ✅ (JSON file) | Different approaches |
| Token Storage | ✅ (encrypted JSON in DB) | ❌ | **Gap**: Rust has no tokens |
| **Observability** | | | |
| Metrics | ❌ | ✅ (prometheus) | Rust: tool_call_duration, server_connections |
| Logging | ✅ (pino) | ✅ (tracing) | Both have structured logging |
| Error Handling | ✅ (custom errors) | ✅ (anyhow) | TS: OAuthAuthorizationRequiredError |
| **Lifecycle** | | | |
| Connection States | 5 states | 3 states | TS: disconnected/connecting/connected/authorizing/incompatible |
| Health Checks | ✅ (attemptConnection) | ✅ (is_alive) | Similar functionality |
| Auto-reconnect | ❌ | ❌ | Neither implements |
| Graceful Shutdown | ✅ (close method) | ✅ (shutdown method) | Both supported |

---

## 4. OAuth Implementation

### 4.1 A2R TypeScript OAuth Flow

```
┌──────────┐                    ┌──────────────┐                    ┌──────────────┐
│   User   │                    │  A2R Server  │                    │  MCP Server  │
└────┬─────┘                    └──────┬───────┘                    └──────┬───────┘
     │                                 │                                   │
     │  1. Configure connector         │                                   │
     │ ───────────────────────────────>│                                   │
     │                                 │                                   │
     │  2. Connect (need auth)         │                                   │
     │ <───────────────────────────────│                                   │
     │                                 │                                   │
     │  3. Redirect to /authorize      │                                   │
     │ <───────────────────────────────│                                   │
     │                                 │  4. Dynamic Client Registration   │
     │                                 │ ──────────────────────────────────>│
     │                                 │                                   │
     │                                 │  5. client_id, client_secret      │
     │                                 │ <──────────────────────────────────│
     │                                 │                                   │
     │                                 │  6. Authorization URL (PKCE)      │
     │                                 │ <──────────────────────────────────│
     │                                 │                                   │
     │  7. Redirect browser to IdP     │                                   │
     │ <───────────────────────────────│                                   │
     │                                 │                                   │
     │  8. User authenticates          │                                   │
     │ ────────────────────────────────────────────────────────────────────>│
     │                                 │                                   │
     │  9. Callback with code + state  │                                   │
     │ ───────────────────────────────>│                                   │
     │                                 │                                   │
     │                                 │  10. Token exchange (PKCE)        │
     │                                 │ ──────────────────────────────────>│
     │                                 │                                   │
     │                                 │  11. access_token, refresh_token  │
     │                                 │ <──────────────────────────────────│
     │                                 │                                   │
     │  12. Connection ready           │                                   │
     │ <───────────────────────────────│                                   │
     │                                 │                                   │
```

### 4.2 OAuth Components

| Component | A2R Implementation | Rust Equivalent |
|-----------|-------------------|-----------------|
| **OAuthClientProvider** | `McpOAuthClientProvider` | ❌ Not implemented |
| **State Management** | PostgreSQL + `mcpOAuthSession` table | Would need custom impl |
| **PKCE Verifier** | 128-byte random, S256 challenge | Standard OAuth 2.1 PKCE |
| **Token Storage** | Encrypted JSON in `tokens` column | Would need secure storage |
| **Token Refresh** | Automatic via SDK | Would need background task |
| **Session Cleanup** | `saveTokensAndCleanup()` - deletes old sessions | Would need cleanup job |
| **Redirect URI** | `${baseUrl}/api/mcp/oauth/callback` | Configurable |
| **Scope** | `mcp:tools` | Standard MCP scope |

### 4.3 Database Schema (OAuth)

```sql
-- A2R PostgreSQL Schema
CREATE TABLE "McpOAuthSession" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mcpConnectorId TEXT NOT NULL,
    state TEXT UNIQUE NOT NULL,
    codeVerifier TEXT,
    clientInfo JSONB,
    tokens JSONB,           -- { access_token, refresh_token, expires_at }
    metadata JSONB,         -- { serverUrl }
    isAuthenticated BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON "McpOAuthSession"(state);
CREATE INDEX ON "McpOAuthSession"(mcpConnectorId);
```

---

## 5. Transport Analysis

### 5.1 TypeScript Transport (SDK-Internal)

The A2R implementation delegates transport handling to `@ai-sdk/mcp`:

```typescript
// mcp-client.ts
this.client = await createMCPClient({
  transport: {
    type: this.serverConfig.type,  // "http" | "sse"
    url: this.serverConfig.url,
    headers: this.serverConfig.headers,
    authProvider: this.oauthProvider,
  },
});
```

**Characteristics**:
- Transport implementation is opaque (closed source in SDK)
- Supports HTTP and SSE types
- Handles OAuth token injection automatically
- No stdio support for local MCP servers

### 5.2 Rust Transport Implementations

#### StdioTransport
```rust
// Spawns child process, communicates via stdin/stdout
pub async fn spawn(
    command: &str,
    args: &[String],
    env: &HashMap<String, String>,
) -> Result<Arc<Self>>
```

**Features**:
- Spawns MCP server as subprocess
- Line-delimited JSON-RPC over stdin/stdout
- Stderr reader task (logs server errors)
- 30-second request timeout
- Automatic process cleanup (`kill_on_drop`)

#### SseTransport
```rust
// HTTP-based transport for remote MCP servers
pub fn new(url: &str) -> Result<Arc<Self>>
```

**Features**:
- HTTP POST for JSON-RPC requests
- 60-second timeout
- HEAD request for health checks
- No persistent SSE stream (request/response only)

### 5.3 Transport Comparison

| Feature | TS (SDK) | Rust Stdio | Rust SSE |
|---------|----------|------------|----------|
| Local Process | ❌ | ✅ | ❌ |
| Remote HTTP | ✅ | ❌ | ✅ |
| Connection Pooling | Unknown | ❌ | ❌ |
| Request Timeouts | Unknown | 30s | 60s |
| Streaming | Unknown | ❌ | ❌ |
| Health Checks | Manual | Process check | HEAD request |
| Error Recovery | Limited | Kill + respawn | Manual |

---

## 6. Gap Analysis

### 6.1 Critical Gaps for Rust Port

| Gap | Severity | Effort | Description |
|-----|----------|--------|-------------|
| **OAuth 2.1 + PKCE** | 🔴 Critical | 2-3 weeks | Full OAuth flow implementation |
| **Token Management** | 🔴 Critical | 1 week | Token storage, refresh, expiration |
| **Dynamic Client Registration** | 🟠 High | 3-5 days | MCP OAuth spec feature |
| **Resources Support** | 🟠 High | 2-3 days | resources/list, resources/read |
| **Stdio in TypeScript** | 🟡 Medium | 2-3 days | For local MCP servers in TS |
| **PostgreSQL Persistence** | 🟡 Medium | 2-3 days | OAuth session storage |
| **Global Connectors** | 🟡 Medium | 1-2 days | userId=null concept |
| **Prompts Support** | 🟢 Low | 1-2 days | prompts/list (partial in TS) |
| **Next.js Caching** | 🟢 Low | 1-2 days | Equivalent caching layer |

### 6.2 Detailed Gap Descriptions

#### OAuth 2.1 + PKCE (Critical)

The TypeScript implementation has comprehensive OAuth support via `McpOAuthClientProvider`:

```typescript
export class McpOAuthClientProvider implements OAuthClientProvider {
  async clientInformation(): Promise<OAuthClientInformationFull | undefined>
  async saveClientInformation(clientCredentials: OAuthClientInformationFull): Promise<void>
  async tokens(): Promise<OAuthTokens | undefined>
  async saveTokens(tokens: OAuthTokens): Promise<void>
  async saveCodeVerifier(pkceVerifier: string): Promise<void>
  async codeVerifier(): Promise<string>
  async redirectToAuthorization(authorizationUrl: URL): Promise<void>
  async adoptState(state: string): Promise<void>
}
```

**Rust Requirements**:
- Implement OAuth 2.1 flow with PKCE
- State machine for authorization process
- Secure code verifier generation (S256)
- Token refresh logic
- Session reconciliation for callbacks

#### Resource Support (High)

TypeScript supports resources but Rust only implements tools:

```typescript
// A2R
async listResources(): Promise<ListResourcesResult>
// Missing in Rust: resources/list, resources/read
```

**Rust Additions Needed**:
```rust
// New types in types.rs
pub struct ResourcesListResult { pub resources: Vec<Resource> }
pub struct Resource { pub uri: String, pub name: String, ... }

// New trait methods in traits.rs
async fn list_resources(&mut self) -> Result<&[Resource]>;
async fn read_resource(&self, uri: &str) -> Result<ResourceContent>;
```

#### PostgreSQL Persistence (Medium)

TypeScript uses Drizzle ORM with PostgreSQL. Rust needs:

```rust
// New module: mcp_db.rs or use existing persistence layer
pub struct McpSessionRepository {
    pool: PgPool,
}

impl McpSessionRepository {
    pub async fn create_session(&self, connector_id: &str, state: &str) -> Result<McpSession>
    pub async fn get_by_state(&self, state: &str) -> Result<Option<McpSession>>
    pub async fn save_tokens(&self, state: &str, tokens: OAuthTokens) -> Result<()>
    pub async fn get_authenticated(&self, connector_id: &str) -> Result<Option<McpSession>>
}
```

---

## 7. Rust Type Mapping

### 7.1 Core Type Mappings

| TypeScript Type | Rust Type | Notes |
|----------------|-----------|-------|
| `MCPClient` | `McpClient` | Expand to include OAuth state |
| `McpOAuthClientProvider` | `OAuthClientProvider` trait + `PgOAuthProvider` impl | New module |
| `McpClientStatus` | `McpClientState` + `OAuthState` | Combine enums |
| `ListResourcesResult` | `ResourcesListResult` | Add to types.rs |
| `ListPromptsResult` | `PromptsListResult` | Add to types.rs |
| `ConnectionStatusResult` | `ConnectionStatus` | New struct |
| `DiscoveryResult` | `DiscoverySnapshot` | New struct |

### 7.2 OAuth-Specific Type Mappings

| TypeScript | Rust | File |
|------------|------|------|
| `OAuthClientMetadata` | `oauth2::ClientMetadata` or custom | `oauth/types.rs` |
| `OAuthTokens` | `OAuthTokens { access_token, refresh_token, expires_at }` | `oauth/types.rs` |
| `OAuthClientInformationFull` | `ClientRegistration { client_id, client_secret, ... }` | `oauth/types.rs` |
| `McpOAuthSession` (DB) | `McpSession { id, connector_id, state, code_verifier, ... }` | `db/models.rs` |
| `OAuthAuthorizationRequiredError` | `oauth2::AuthorizationRequired` | `oauth/error.rs` |

### 7.3 Proposed Rust Module Structure

```
crates/mcp/
├── Cargo.toml
├── src/
│   ├── lib.rs                    # Public exports
│   ├── client.rs                 # McpClient (extend existing)
│   ├── transport.rs              # StdioTransport
│   ├── sse_transport.rs          # SseTransport
│   ├── types.rs                  # JSON-RPC + MCP types
│   ├── traits.rs                 # McpTransport, McpClientTrait
│   ├── tool_bridge.rs            # McpToolBridge, McpAgentTool
│   ├── manager.rs                # McpManager (multi-server)
│   ├── registry.rs               # McpRegistry (config persistence)
│   │
│   ├── oauth/                    # NEW: OAuth 2.1 implementation
│   │   ├── mod.rs
│   │   ├── provider.rs           # OAuthClientProvider trait
│   │   ├── flow.rs               # Authorization flow state machine
│   │   ├── pkce.rs               # PKCE verifier generation
│   │   ├── types.rs              # OAuth types
│   │   └── error.rs              # OAuth errors
│   │
│   ├── db/                       # NEW: Database persistence
│   │   ├── mod.rs
│   │   ├── models.rs             # McpSession, McpConnector
│   │   └── repository.rs         # CRUD operations
│   │
│   └── resources/                # NEW: Resource support
│       ├── mod.rs
│       ├── types.rs              # Resource, ResourceContent
│       └── client_ext.rs         # Trait extensions for resources
```

---

## 8. Recommendations

### 8.1 Priority Order for Implementation

#### Phase 1: Core OAuth (Weeks 1-3)
1. **OAuth Types & Traits** (`oauth/types.rs`, `oauth/provider.rs`)
   - Define `OAuthClientProvider` trait matching TS interface
   - Implement `OAuthTokens`, `ClientMetadata`, `ClientRegistration`
   
2. **PKCE Implementation** (`oauth/pkce.rs`)
   - Code verifier generation (128 bytes)
   - S256 challenge computation
   
3. **OAuth Flow State Machine** (`oauth/flow.rs`)
   - Authorization URL generation
   - Token exchange
   - Token refresh logic
   
4. **PostgreSQL Repository** (`db/repository.rs`)
   - Port all queries from `mcp-queries.ts`
   - Session lifecycle management

#### Phase 2: Transport & Client Integration (Week 4)
5. **Extend McpClient with OAuth**
   - Add OAuth state to `McpClient`
   - Token injection in requests
   - Automatic refresh on 401
   
6. **HTTP Transport Enhancement**
   - Add Bearer token header support
   - OAuth-aware error handling

#### Phase 3: Feature Parity (Week 5-6)
7. **Resources Support**
   - Add `resources/list` and `resources/read`
   - Extend `McpClientTrait`
   
8. **Prompts Support**
   - Add `prompts/list` (experimental)
   
9. **Caching Layer**
   - Implement discovery caching
   - Connection status caching
   
10. **Global Connectors**
    - Add user_id=null support to registry

#### Phase 4: Testing & Polish (Week 7)
11. **Integration Tests**
    - OAuth flow end-to-end
    - Token refresh scenarios
    - Session cleanup
    
12. **Documentation & Examples**

### 8.2 Key Design Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| OAuth Library | `oauth2` crate + custom PKCE | Most mature, flexible |
| Database | Use existing moltis-db pool | Consistency with codebase |
| Transport Auth | Middleware pattern | Clean separation of concerns |
| Token Storage | Encrypted at rest | Security best practice |
| Session Cleanup | Background tokio task | Don't block requests |
| OAuth State | Separate enum from ConnectionState | Clear separation of concerns |

### 8.3 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OAuth complexity | Start with `oauth2` crate, avoid custom crypto |
| Session security | Use existing encryption from moltis-secrets |
| Token expiration | Implement proactive refresh (50% TTL) |
| Callback reconciliation | Match TS `adoptState()` behavior exactly |
| Database migrations | Version schema from start |

### 8.4 Testing Strategy

```rust
// Example test patterns to port from TS

#[tokio::test]
async fn test_oauth_flow_state_machine() {
    // Port from McpOAuthClientProvider tests
}

#[tokio::test]
async fn test_pkce_verifier_immutable() {
    // Verifier can only be set once per state
}

#[tokio::test]
async fn test_token_refresh() {
    // Simulate expiring token, verify automatic refresh
}

#[tokio::test]
async fn test_session_cleanup() {
    // Verify old sessions deleted on new auth
}
```

---

## Appendix A: File Size Comparison

| Component | TypeScript | Rust | Notes |
|-----------|-----------|------|-------|
| MCP Client | 367 lines | ~280 lines | TS includes OAuth handling |
| OAuth Provider | 387 lines | N/A | Not in Rust |
| DB Queries | 348 lines | N/A | PostgreSQL in TS |
| Name ID Utils | 98 lines | N/A | Simple utility |
| Cache | 110 lines | N/A | Next.js specific |
| Kernel Integration | 38 lines | N/A | Stub only |
| **Total** | **~1,350 lines** | **~1,100 lines** | Rust needs +OAuth (~500 lines) |

## Appendix B: Dependencies

### TypeScript Dependencies
```json
{
  "@ai-sdk/mcp": "^1.0.18",
  "@modelcontextprotocol/sdk": "(transitive)"
}
```

### Proposed Rust Dependencies
```toml
[dependencies]
# Existing
tokio = { version = "1", features = ["process", "io-util"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
tracing = "0.1"
async-trait = "0.1"
reqwest = { version = "0.12", features = ["json"] }

# New for OAuth
oauth2 = "4"
sha2 = "0.10"  # For PKCE S256
base64 = "0.22"
rand = "0.8"   # For code verifier

# New for DB
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio"] }

# New for crypto
aes-gcm = "0.10"  # For token encryption
```

---

**End of Audit Document**

*This audit should be updated as the Rust implementation progresses to track feature parity.*
