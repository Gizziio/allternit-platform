# Allternit Gateway Protocol v1

## Overview

The Allternit Gateway Protocol defines a **transport-agnostic** messaging protocol for the Allternit platform. The protocol supports multiple transports while maintaining a stable core contract.

**Version:** 1.0.0  
**Status:** Stable  
**Compatibility:** MCP-compatible (stdio + streamable HTTP)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UI Client Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   allternit-platform  │  │   shell-ui      │  │   electron      │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                     │                       │
│           └────────────────────┼─────────────────────┘                       │
│                                │                                             │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    Allternit Gateway Core                                     ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   ││
│  │  │   Routing   │  │  Event Bus  │  │   Session   │  │    Tool     │   ││
│  │  │   Engine    │  │   (SSE)     │  │    Store    │  │   Runner    │   ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │              Allternit Kernel Adapter (Authority)                      │   ││
│  │  │  - DAG Runner  - Tool Registry  - Policy Gating  - Memory       │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                │                                             │
│           ┌────────────────────┼─────────────────────┐                      │
│           ▼                    ▼                     ▼                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  stdio Transport│  │ HTTP Transport  │  │  SSE Transport  │             │
│  │  (JSON-RPC 2.0) │  │ (REST + Stream) │  │  (compat only)  │             │
│  │  MCP-compatible │  │ MCP-compatible  │  │  deprecate Q3   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Operations

All operations are transport-agnostic. Each transport maps operations to its native format.

### Operation Categories

| Category | Operations |
|----------|------------|
| **System** | `health/check`, `discovery/get` |
| **Session** | `session/create`, `session/get`, `session/list`, `session/update`, `session/delete` |
| **Chat** | `chat/completions`, `chat/messages` |
| **Agent** | `agents/list`, `agents/get`, `agents/create`, `agents/update`, `agents/delete`, `agents/execute` |
| **Tool** | `tools/list`, `tools/get`, `tools/execute` |
| **Skill** | `skills/list`, `skills/get`, `skills/exec` |
| **Workflow** | `workflows/list`, `workflows/get`, `workflows/run`, `workflows/validate` |
| **Voice** | `voice/tts`, `voice/clone`, `voice/voices`, `voice/models` |
| **Operator** | `operator/browser/*`, `operator/vision/*`, `operator/parallel/*` |
| **Rails** | `rails/plan/*`, `rails/dags/*`, `rails/wih/*`, `rails/lease/*`, `rails/ledger/*`, `rails/mail/*` |

---

## Data Models

### Message Model

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  session_id: string;
  created_at: string;  // ISO 8601
  metadata?: Record<string, unknown>;
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; reasoning: string }
  | { type: 'file'; file: FileAttachment }
  | { type: 'source'; source: SourceCitation }
  | { type: 'code'; code: string; language: string }
  | { type: 'image'; image: ImageAttachment }
  | { type: 'audio'; audio: AudioAttachment }
  | { type: 'tool'; tool_call_id: string; tool_name: string; state: ToolState; input?: unknown; output?: unknown; error?: string }
  | { type: 'data'; data_type: string; data: unknown };

interface FileAttachment {
  id: string;
  name: string;
  content_type: string;
  size: number;
  url?: string;
}

interface SourceCitation {
  id: string;
  url: string;
  title: string;
  excerpt?: string;
}

interface ImageAttachment {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface AudioAttachment {
  url: string;
  duration?: number;
  format?: string;
}

type ToolState = 'loading' | 'result' | 'error';
```

### Session Model

```typescript
interface Session {
  id: string;
  profile_id: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  created_at: string;
  updated_at?: string;
  expires_at?: string;
  capsules: string[];
  metadata?: Record<string, unknown>;
}
```

### Token Usage

```typescript
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
```

---

## Event Bus

### Core Event Types

All events are published to the internal event bus and transported via transport-specific mechanisms.

```typescript
interface CoreEvents {
  // Session lifecycle
  'session.created': { 
    session_id: string; 
    profile_id: string; 
    capsules: string[];
    created_at: string;
  };
  
  'session.resumed': { 
    session_id: string; 
    last_activity: string;
  };
  
  'session.paused': { 
    session_id: string; 
    reason: string;
  };
  
  'session.completed': { 
    session_id: string; 
    duration_ms: number;
    message_count: number;
  };
  
  'session.error': { 
    session_id: string; 
    error: string;
    code: string;
  };
  
  // Chat streaming
  'chat.started': {
    chat_id: string;
    session_id: string;
    model: string;
  };
  
  'chat.delta': {
    chat_id: string;
    content: string;
    index: number;
    reasoning?: string;
  };
  
  'chat.completed': {
    chat_id: string;
    content: string;
    usage: TokenUsage;
  };
  
  // Tool execution
  'tool.call.started': {
    tool_call_id: string;
    tool_name: string;
    arguments: unknown;
    session_id?: string;
  };
  
  'tool.call.completed': {
    tool_call_id: string;
    result: unknown;
    duration_ms?: number;
  };
  
  'tool.call.error': {
    tool_call_id: string;
    error: string;
    code: string;
  };
  
  // Artifacts
  'artifact.created': {
    artifact_id: string;
    type: string;
    metadata: unknown;
    session_id?: string;
  };
  
  // System
  'health.check': {
    services: Record<string, ServiceHealth>;
  };
  
  'error': {
    code: string;
    message: string;
    details?: unknown;
    trace_id?: string;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  last_check: string;
  latency_ms?: number;
  error?: string;
}
```

### Event Ordering Guarantees

For any chat completion operation:

```
chat.started → (chat.delta)* → (tool.call.started → tool.call.completed)* → chat.completed → done
                                              ↓
                                        (artifact.created)*
```

For any session lifecycle:

```
session.created → (session.resumed)* → session.completed
              ↓                           ↓
        (chat operations)          session.error (on failure)
```

---

## Transport A: stdio (JSON-RPC 2.0)

### Protocol

- **Format:** JSON-RPC 2.0
- **Transport:** stdin/stdout
- **Delimiter:** Newline (`\n`)
- **Streaming:** Notifications (no `id` field)

### Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "<operation_name>",
  "params": {
    // Operation-specific parameters
  },
  "id": "<request_id>"
}
```

### Response Format (Success)

```json
{
  "jsonrpc": "2.0",
  "result": {
    // Operation-specific result
  },
  "id": "<request_id>"
}
```

### Response Format (Error)

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": <error_code>,
    "message": "<error_message>",
    "data": {}
  },
  "id": "<request_id>"
}
```

### Streaming Response (Notifications)

```json
{"jsonrpc":"2.0","method":"chat.delta","params":{"chat_id":"c1","content":"Hello","index":0}}
{"jsonrpc":"2.0","method":"chat.delta","params":{"chat_id":"c1","content":" world","index":1}}
{"jsonrpc":"2.0","method":"chat.completed","params":{"chat_id":"c1","content":"Hello world","usage":{"prompt_tokens":5,"completion_tokens":10}}}
{"jsonrpc":"2.0","result":{"streamed":true},"id":"req_001"}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Missing required fields |
| -32601 | Method not found | Unknown operation |
| -32602 | Invalid params | Parameter validation failed |
| -32603 | Internal error | Gateway internal error |
| -32000 | Backend unavailable | Target service unavailable |
| -32001 | Rate limited | Too many requests |
| -32002 | Unauthorized | Authentication required |
| -32003 | Forbidden | Insufficient permissions |
| -32004 | Timeout | Backend timeout |

### Examples

**Health Check:**
```json
// Request
{"jsonrpc":"2.0","method":"health/check","params":{},"id":"1"}

// Response
{"jsonrpc":"2.0","result":{"status":"healthy","service":"allternit-gateway","version":"1.0.0","timestamp":1708617600000,"backends":{"api":"healthy","kernel":"healthy"}},"id":"1"}
```

**Chat Completion (Streaming):**
```json
// Request
{"jsonrpc":"2.0","method":"chat/completions","params":{"messages":[{"role":"user","content":"Hello"}],"stream":true},"id":"2"}

// Streaming responses
{"jsonrpc":"2.0","method":"chat.started","params":{"chat_id":"c1","session_id":"s1","model":"default"}}
{"jsonrpc":"2.0","method":"chat.delta","params":{"chat_id":"c1","content":"Hello!","index":0}}
{"jsonrpc":"2.0","method":"chat.delta","params":{"chat_id":"c1","content":" How can I help?","index":1}}
{"jsonrpc":"2.0","method":"chat.completed","params":{"chat_id":"c1","content":"Hello! How can I help?","usage":{"prompt_tokens":5,"completion_tokens":10}}}
{"jsonrpc":"2.0","result":{"streamed":true},"id":"2"}
```

**Session Create:**
```json
// Request
{"jsonrpc":"2.0","method":"session/create","params":{"profile_id":"p1","capsules":["browser"]},"id":"3"}

// Response
{"jsonrpc":"2.0","result":{"id":"s1","profile_id":"p1","status":"active","created_at":"2024-02-23T10:00:00Z","capsules":["browser"]},"id":"3"}
```

---

## Transport B: HTTP (REST + Streaming)

### Protocol

- **Format:** HTTP/1.1 or HTTP/2
- **Content-Type:** `application/json` (REST), `text/event-stream` (streaming)
- **Authentication:** Bearer token or API key

### Endpoints

| Method | Path | Operation | Streaming |
|--------|------|-----------|-----------|
| GET | `/health` | `health/check` | No |
| GET | `/v1/discovery` | `discovery/get` | No |
| POST | `/v1/sessions` | `session/create` | No |
| GET | `/v1/sessions` | `session/list` | No |
| GET | `/v1/sessions/{id}` | `session/get` | No |
| PATCH | `/v1/sessions/{id}` | `session/update` | No |
| DELETE | `/v1/sessions/{id}` | `session/delete` | No |
| POST | `/v1/chat/completions` | `chat/completions` | Yes |
| GET | `/v1/sessions/{id}/messages` | `chat/messages` | No |
| GET | `/v1/agents` | `agents/list` | No |
| GET | `/v1/agents/{id}` | `agents/get` | No |
| POST | `/v1/agents/{id}/execute` | `agents/execute` | Yes |
| GET | `/v1/tools` | `tools/list` | No |
| POST | `/v1/tools/{id}/execute` | `tools/execute` | No |
| GET | `/v1/voice/voices` | `voice/voices` | No |
| POST | `/v1/voice/tts` | `voice/tts` | No |
| GET | `/v1/events` | (SSE subscription) | Yes |

### SSE Event Format

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: chat.started
data: {"chat_id":"c1","session_id":"s1","model":"default"}

event: chat.delta
data: {"chat_id":"c1","content":"Hello!","index":0}

event: chat.completed
data: {"chat_id":"c1","content":"Hello!","usage":{"prompt_tokens":5,"completion_tokens":10}}

event: done
data: {"chat_id":"c1"}
```

### Request/Response Examples

**Health Check:**
```bash
# Request
GET /health HTTP/1.1
Host: localhost:3210

# Response
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-ID: req_abc123
X-Gateway-Version: 1.0.0

{
  "status": "healthy",
  "service": "allternit-gateway",
  "version": "1.0.0",
  "timestamp": 1708617600000,
  "backends": {
    "api": "healthy",
    "kernel": "healthy"
  }
}
```

**Chat Completion (Streaming):**
```bash
# Request
POST /v1/chat/completions HTTP/1.1
Host: localhost:3210
Content-Type: application/json
Accept: text/event-stream

{
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true
}

# Response
HTTP/1.1 200 OK
Content-Type: text/event-stream

event: chat.started
data: {"chat_id":"c1","session_id":"s1","model":"default"}

event: chat.delta
data: {"chat_id":"c1","content":"Hello!","index":0}

event: chat.completed
data: {"chat_id":"c1","content":"Hello!","usage":{"prompt_tokens":5,"completion_tokens":10}}

event: done
data: {"chat_id":"c1"}
```

---

## Transport C: SSE (Compat Only)

**Status:** Deprecated (remove Q3 2025)  
**Purpose:** Backward compatibility with existing UI code

### Legacy Event Type Mapping

| Core Event | Legacy SSE Type |
|------------|-----------------|
| `session.created` | `session.started` |
| `chat.delta` | `message.delta` |
| `chat.completed` | `message.completed` |
| `tool.call.started` | `tool.call` |
| `tool.call.completed` | `tool.result` |
| `artifact.created` | `artifact.created` |
| `error` | `error` |
| - | `done` (synthetic) |

---

## Security

### Authentication

**Bearer Token:**
```
Authorization: Bearer <jwt_token>
```

**API Key:**
```
Authorization: ApiKey <api_key>
```

### Authorization

All operations pass through the policy gating layer:

```typescript
interface PolicyDecision {
  effect: 'allow' | 'deny';
  reason?: string;
  conditions?: Record<string, unknown>;
}
```

### Rate Limiting

| Tier | Requests/Minute | Burst |
|------|-----------------|-------|
| Anonymous | 30 | 10 |
| Authenticated | 120 | 30 |
| Premium | 600 | 100 |

**Headers:**
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 115
X-RateLimit-Reset: 1708617660
Retry-After: 60
```

---

## Error Handling

### Error Response Schema

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "trace_id": "trace_abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `BACKEND_UNAVAILABLE` | 503 | Service unavailable |
| `BACKEND_TIMEOUT` | 504 | Service timeout |
| `GATEWAY_ERROR` | 500 | Internal gateway error |

---

## Implementation Requirements

### Core Module

Must provide:
- [ ] Request routing (logical operations)
- [ ] Event bus (server-side pub/sub)
- [ ] Session store interface
- [ ] Tool invocation interface
- [ ] Message/parts model
- [ ] Receipt generation

### Transport Modules

Must provide:
- [ ] stdio: JSON-RPC 2.0 parser
- [ ] stdio: Notification streaming
- [ ] HTTP: REST endpoint handlers
- [ ] HTTP: SSE streaming
- [ ] HTTP: Authentication hooks
- [ ] SSE: Legacy event translation (compat only)

### Allternit Kernel Adapter

Must provide:
- [ ] Session management
- [ ] Chat execution with streaming
- [ ] Tool execution
- [ ] Agent execution
- [ ] Policy gating
- [ ] Memory writes (if enabled)

---

## Testing Requirements

### Contract Tests

- [ ] All operations have schema validation tests
- [ ] Error responses match specification
- [ ] Event ordering is verified
- [ ] Session lifecycle is correct

### Smoke Tests

- [ ] stdio: Spawn subprocess, send prompt, receive stream
- [ ] HTTP: Start server, call endpoint, receive stream
- [ ] SSE: Connect, receive events (if compat layer exists)

### Integration Tests

- [ ] End-to-end chat flow
- [ ] Tool execution flow
- [ ] Agent execution flow
- [ ] Session persistence

---

## Versioning

Protocol versions follow semantic versioning:

- **MAJOR:** Breaking changes to core operations or data models
- **MINOR:** New operations or optional fields
- **PATCH:** Bug fixes and clarifications

**Current Version:** 1.0.0

**Deprecation Policy:**
- Minor versions: 6 months support
- Major versions: 12 months support
- Compat layer: Removed after migration period

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-02-23  
**Maintainer:** Allternit Platform Team
