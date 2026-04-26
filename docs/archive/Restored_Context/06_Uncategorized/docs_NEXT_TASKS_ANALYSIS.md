# Next Tasks Analysis

## Current State (Post P5.x Completion)

### ✅ Completed
1. **P5.x Browser Runtime** - 25 tests passing
   - Receipts schema (P5.1.2)
   - Policy tier gating (P5.1.3)
   - ShellUI integration (P5.2.1)
   - DAG/WIH browser_run node (P5.4)
   - Prompt injection resistance (P5.5)

2. **MCP Client Infrastructure** - 4 tests passing
   - JSON-RPC 2.0 stdio transport (N10 - mostly complete)
   - HTTP/SSE transport with reconnection (N11 - mostly complete)
   - Health monitoring basics (N14 - started)

### 🔄 In Progress / Partial
1. **MCP Tool Bridge** (N12) - Need to integrate with tools-gateway
2. **MCP Server Registry** (N13) - Need SQLite persistence
3. **OpenClaw Parity** (N20-N27) - Native chat, channels, sessions

---

## Recommended Next Task Priority

### Priority 1: N12 - MCP Tool Bridge for tools-gateway
**Why first:** The MCP client is ready but not connected to the Allternit tool system.

**Deliverables:**
- MCP tool registration in tools-gateway
- Tool name prefixing (`mcp__{server}__{tool}`)
- Policy enforcement for MCP calls
- Result sanitization

**Files to modify:**
- `services/io-service/src/lib.rs` - Add MCP tool type handling
- `services/io-service/src/mcp_bridge.rs` - New module for MCP bridge

---

### Priority 2: N13 - MCP Server Registry Persistence
**Why second:** Need to persist MCP server configurations.

**Deliverables:**
- SQLite schema for MCP servers
- CRUD operations
- OAuth token storage
- Health status tracking

**Files to create:**
- `crates/mcp-client/src/registry/mod.rs` - Registry module
- `crates/mcp-client/src/registry/db.rs` - Database operations

---

### Priority 3: N20 - Native Chat (OpenClaw Parity N5)
**Why third:** Completes the chat UI parity with OpenClaw.

**Deliverables:**
- Native chat streaming
- Abort/cancel operations
- Message injection
- Replace quarantine iframe

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Allternit Platform UI                          │
│                   (React/Next.js)                            │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼────────────────────────────────────────┐
│                 Tools Gateway (IO Service)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MCP Bridge (N12) ←── You are here                   │  │
│  │  - Tool registration                                 │  │
│  │  - Policy enforcement                                │  │
│  │  - Result sanitization                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬────────────────────────────────────────┘
                      │ MCP Protocol
┌─────────────────────▼────────────────────────────────────────┐
│                    MCP Client                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Stdio     │  │    SSE      │  │      Registry       │  │
│  │  Transport  │  │  Transport  │  │     (N13)           │  │
│  │   (N10)     │  │   (N11)     │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                  MCP Servers                                 │
│         (Filesystem, GitHub, Slack, etc.)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Estimates

| Task | Estimate | Dependencies |
|------|----------|--------------|
| N12: MCP Tool Bridge | 2-3 days | mcp-client |
| N13: MCP Registry | 2 days | N12 |
| N14: Health Monitoring | 1-2 days | N13 |
| N20: Native Chat | 3-4 days | None |

**Total: 8-11 days of work**
