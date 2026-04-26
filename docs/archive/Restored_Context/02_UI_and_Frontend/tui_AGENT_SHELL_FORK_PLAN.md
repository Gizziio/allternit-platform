# Agent-Shell Fork Plan

**Document:** Allternit-TUI-001  
**Status:** ACTIVE  
**Date:** 2026-02-18  
**Source:** https://github.com/xenodium/agent-shell  
**Pinned Commit:** `0d7c8c374b4e15f8e7a9c25acc7c5f06fbd40943`

---

## Executive Summary

This document outlines the complete fork strategy for adapting [agent-shell](https://github.com/xenodium/agent-shell) (an Emacs-based ACP client) into the Allternit Rust TUI. The goal is to replicate agent-shell's production-quality UX while maintaining strict architectural boundaries.

**Core Principle:** Agent-shell is UI-only. It delegates all execution to ACP agents via stdio. Our TUI must do the same - delegate to kernel-service HTTP API, which delegates to allternit-runtime.

---

## Part 1: What We Fork (Keep)

### UI Behaviors to Replicate

| Feature | Agent-Shell Location | User Value |
|---------|---------------------|------------|
| **Comint Shell Experience** | `agent-shell.el` (lines 601+) | Familiar terminal interaction |
| **Session Management** | `agent-shell.el` (lines 441-461) | New/resume/defer session strategies |
| **Stream Rendering** | `agent-shell-ui.el` | Real-time token display with markdown |
| **Tool Permission Dialogs** | `agent-shell.el` (lines 1365-1394) | Allow/deny tool execution |
| **Tool Call Visualization** | `agent-shell.el` (lines 1102-1142) | Show tool execution status |
| **Diff Rendering** | `agent-shell-diff.el` | Visualize code changes |
| **Transcript Save/Load** | Persistence layer | Conversation history |
| **Multi-Agent Support** | `agent-shell-*.el` files | Claude, Gemini, Cursor, etc. |
| **Heartbeat/Keepalive** | `agent-shell-heartbeat.el` | Connection health |
| **Viewport Management** | `agent-shell-viewport.el` | Scroll/follow behavior |

### ACP Behaviors to Replicate

| Behavior | Agent-Shell Function | Allternit Mapping |
|----------|---------------------|-------------|
| Initialize Handshake | `agent-shell--make-acp-client` | `allternit-acp-driver/src/driver.rs` |
| Session Create | ACP `session/new` | POST `/v1/sessions` → kernel-service → allternit-runtime |
| Prompt Submit | ACP `session/prompt` | POST `/v1/sessions/{id}/prompt` |
| Stream Updates | ACP `session/update` notifications | SSE/WebSocket from kernel-service |
| Tool Calls | `session/request_permission` | Runtime emits event → UI shows dialog |
| Tool Results | ACP `session/prompt` with tool_result | POST back to kernel-service |
| Session Close | ACP `session/close` | DELETE `/v1/sessions/{id}` |
| Transcript Save | `agent-shell--save-session` | POST `/v1/transcripts` |
| Transcript Load | `agent-shell--load-session` | GET `/v1/transcripts/{id}` |

---

## Part 2: What We DON'T Fork (Rejection List)

| Agent-Shell Feature | Why Not | Allternit Replacement |
|--------------------|---------|-----------------|
| Direct process spawn | Violates boundary | Kernel-service spawns via allternit-acp-driver |
| Provider-specific code | Belongs in domains/kernel | `allternit-providers/src/runtime/adapters/` |
| State machine logic | Belongs in runtime | `allternit-runtime/src/session/state_machine.rs` |
| Tool execution | Belongs in runtime | `allternit-runtime/src/tool_loop/` |
| ACP protocol parsing | Belongs in driver | `allternit-acp-driver/src/protocol.rs` |
| Session persistence | Belongs in kernel-service | `kernel-service/src/brain/store.rs` |

---

## Part 3: File Mapping (Agent-Shell → Allternit)

### Core UI (Emacs Lisp → Rust/Ratatui)

| Agent-Shell File | Lines | Allternit Destination | Responsibility |
|-----------------|-------|----------------|----------------|
| `agent-shell.el` | ~2000 | `cmd/agent-shell/src/main.rs` | Entry point, CLI args |
| `agent-shell.el` (shell creation) | 601-700 | `cmd/agent-shell/src/app.rs` | App state, event loop |
| `agent-shell-ui.el` | ~800 | `cmd/agent-shell/src/ui/` | Widgets, rendering |
| `agent-shell-viewport.el` | ~200 | `cmd/agent-shell/src/ui/scroll.rs` | Scroll/follow logic |
| `agent-shell-completion.el` | ~300 | `cmd/agent-shell/src/ui/completion.rs` | Command completion |
| `agent-shell-diff.el` | ~400 | `cmd/agent-shell/src/ui/diff.rs` | Diff visualization |

### Session Management

| Agent-Shell Function | Allternit API Endpoint | HTTP Method |
|---------------------|------------------|-------------|
| `agent-shell-new-shell` | `/v1/sessions` | POST |
| `agent-shell-prompt-compose` | `/v1/sessions/{id}/prompt` | POST |
| `agent-shell-interrupt` | `/v1/sessions/{id}/cancel` | POST |
| Session persistence | `/v1/transcripts` | GET/POST |

### Provider Integrations (ACP-based only)

Agent-shell has separate files for each provider. Our TUI does NOT need these - we call kernel-service which handles all providers through `allternit-providers`.

| Agent-Shell Provider File | Allternit Approach |
|--------------------------|--------------|
| `agent-shell-anthropic.el` | Via kernel-service → allternit-providers |
| `agent-shell-google.el` | Via kernel-service → allternit-providers |
| `agent-shell-cursor.el` | Via kernel-service → allternit-providers |
| `agent-shell-opencode.el` | Via kernel-service → allternit-providers |
| `agent-shell-qwen.el` | Via kernel-service → allternit-providers |

---

## Part 4: Architecture Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ cmd/agent-shell/ (Rust TUI)                                   │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│ │  App State  │  │  UI Widgets │  │ HTTP Client │              │
│ └──────┬──────┘  └─────────────┘  └──────┬──────┘              │
└────────┼──────────────────────────────────┼────────────────────┘
         │ HTTP API calls only              │
         ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ services/orchestration/kernel-service/ (Thin HTTP Wiring)     │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│ │   Router    │  │  Handlers   │  │  Validation │              │
│ └──────┬──────┘  └──────┬──────┘  └─────────────┘              │
└────────┼────────────────┼──────────────────────────────────────┘
         │ delegates to     │ delegates to
         ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ domains/kernel/infrastructure/allternit-runtime/ (Runtime Brain)            │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│ │   Session   │  │  Tool Loop  │  │   Stream    │              │
│ │   State     │  │   Arbiter   │  │  Supervisor │              │
│ │  Machine    │  │             │  │             │              │
│ └──────┬──────┘  └──────┬──────┘  └─────────────┘              │
└────────┼────────────────┼──────────────────────────────────────┘
         │ uses             │ uses
         ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ domains/kernel/infrastructure/allternit-acp-driver/ (Transport Layer)       │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│ │  Transport  │  │   Protocol  │  │   Parser    │              │
│ │  (stdio)    │  │  (ACP JSON) │  │ (JSON-RPC)  │              │
│ └──────┬──────┘  └─────────────┘  └─────────────┘              │
└────────┼────────────────────────────────────────────────────────┘
         │ spawns
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ACP Agent Process (external: Claude Code, Gemini CLI, etc.)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Critical Implementation Rules

### Rule 1: UI Layer (cmd/agent-shell)
- ✓ HTTP client only (reqwest)
- ✓ User interaction (dialogs, input, rendering)
- ✓ Event streaming (SSE/WebSocket)
- ✗ NO direct allternit-runtime imports
- ✗ NO provider-specific code
- ✗ NO business logic

### Rule 2: Service Layer (services/kernel-service)
- ✓ HTTP routing (< 100 lines per handler)
- ✓ Request validation
- ✓ Delegate to allternit-runtime
- ✗ NO provider logic (must be in domains/kernel/)
- ✗ NO state machine (must be in allternit-runtime)
- ✗ NO tool execution (must be in allternit-runtime)

### Rule 3: Runtime Layer (domains/kernel/allternit-runtime)
- ✓ State machine with guarded transitions
- ✓ Tool loop arbitration
- ✓ Streaming supervision
- ✓ Session lifecycle management
- ✗ NO HTTP-specific code
- ✗ NO UI code

---

## Part 6: ACP Protocol Reference

### Initialize
```json
// → Agent
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}}
// ← Agent
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26","capabilities":{"tools":{}}}}
// → Agent
{"jsonrpc":"2.0","method":"initialized"}
```

### Session Create
```json
// → Agent
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/home/user"}}
// ← Agent
{"jsonrpc":"2.0","id":2,"result":{"sessionId":"sess_123"}}
```

### Prompt with Tool Call
```json
// → Agent
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"sess_123","content":"Hello"}}

// ← Agent (streaming notification)
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_123","kind":"agent_message_chunk","content":"Hi"}}

// ← Agent (tool call request)
{"jsonrpc":"2.0","method":"session/update","params":{"kind":"tool_call","toolCall":{"id":"call_1","name":"read_file","arguments":{"path":"main.rs"}}}}

// → Agent (after user permission + execution)
{"jsonrpc":"2.0","id":4,"method":"session/prompt","params":{"sessionId":"sess_123","content":[{"type":"tool_result","toolCallId":"call_1","content":"..."}]}}

// ← Agent (final response)
{"jsonrpc":"2.0","id":3,"result":{"content":"I read the file..."}}
```

### Permission Request
```json
// ← Agent
{"jsonrpc":"2.0","id":5,"method":"session/request_permission","params":{"toolCall":{"toolCallId":"call_1","name":"bash","arguments":{"command":"rm -rf /"}}}}

// → Agent (user approves)
{"jsonrpc":"2.0","id":5,"result":{"approved":true}}

// → Agent (user denies)
{"jsonrpc":"2.0","id":5,"result":{"approved":false,"reason":"Too dangerous"}}
```

---

## Part 7: Kernel API Endpoints for TUI

The TUI will call these kernel-service endpoints:

### Sessions
```
POST   /v1/sessions              # Create new session
GET    /v1/sessions              # List sessions
GET    /v1/sessions/{id}         # Get session status
DELETE /v1/sessions/{id}         # Close session
POST   /v1/sessions/{id}/cancel  # Cancel in-progress prompt
```

### Prompts
```
POST   /v1/sessions/{id}/prompt  # Submit prompt (non-streaming)
POST   /v1/sessions/{id}/stream  # Submit prompt (SSE streaming)
POST   /v1/sessions/{id}/tool-result  # Return tool execution result
```

### Permissions
```
POST   /v1/permissions/{request_id}/respond  # Approve/deny tool
```

### Models & Providers
```
GET    /v1/providers             # List available providers
GET    /v1/providers/{id}/models # List models for provider
GET    /v1/auth-status           # Check authentication status
```

### Transcripts
```
GET    /v1/transcripts           # List saved transcripts
POST   /v1/transcripts           # Save transcript
GET    /v1/transcripts/{id}      # Load transcript
```

---

## Part 8: Testing Strategy

### Unit Tests
- Each UI widget in isolation
- HTTP client mock responses
- Event parsing from SSE stream

### Integration Tests
- Full flow: Create → Prompt → Tool Call → Respond → Complete
- Provider switching
- Session resume after disconnect
- Error handling (rate limits, auth failures)

### Conformance Tests
- ACP protocol compliance (run against reference agents)
- JSON-RPC validation
- Session lifecycle adherence

---

## References

- Agent-shell source: https://github.com/xenodium/agent-shell (commit: `0d7c8c374b4e15f8e7a9c25acc7c5f06fbd40943`)
- ACP Specification: https://agentclientprotocol.com
- Allternit Runtime: `domains/kernel/infrastructure/allternit-runtime/`
- Allternit ACP Driver: `domains/kernel/infrastructure/allternit-acp-driver/`
