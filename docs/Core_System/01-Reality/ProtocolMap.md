# Allternit Gateway Protocol Map

## Overview

This document maps the existing Gizzi Code/Allternit UI contracts to the Allternit Gateway Protocol v1, ensuring backward compatibility while establishing a clean transport-agnostic foundation.

**Version:** 1.0.0  
**Date:** 2024-02-23

---

## Contract Extraction Summary

### REST Endpoints by Category

| Category | Endpoint Count | Primary Services |
|----------|---------------|------------------|
| Sessions | 8 | API (3000), Kernel (3004) |
| Chat | 1 (streaming) | API (3000) |
| Agents | 7 | API (3000) |
| Tools | 3 | API (3000), Kernel (3004) |
| Skills | 7 | API (3000) |
| Workflows | 7 | API (3000) |
| Voice | 6 | Voice (8001) |
| Models/Providers | 5 | API (3000) |
| Operator | 11 | Operator (3010) |
| Rails | 16 | Rails (3011) |
| **Total** | **71** | - |

### SSE/Streaming Endpoints

| Endpoint | Event Types | Usage |
|----------|-------------|-------|
| `POST /api/chat` | 8 | Chat completions |
| `GET /api/v1/sessions/{id}/messages/stream` | 4 | Session message streaming |
| `GET /v1/events` | 5 | Gateway events |
| `GET /api/events/stream` | 5 | API system events |

### Data Models

| Model | Variants | Key Fields |
|-------|----------|------------|
| Message | 3 (Chat, OpenClaw, Native) | id, role, content, parts, metadata |
| Session | 3 (Allternit, OpenClaw, Native) | id, status, created_at, metadata |
| Event | 4 (Stream, Gateway, API, Session) | type, data, timestamp |
| ToolCall | 1 | id, tool, arguments, status, result |
| Agent | 1 | id, name, model, capabilities, tools |

---

## Protocol Mapping

### Layer Architecture

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
│  │                    COMPAT LAYER (if needed)                             ││
│  │  - Legacy REST endpoint aliases                                         ││
│  │  - SSE event type translations                                          ││
│  │  - Request/response shape adapters                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                │                                             │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    Allternit GATEWAY PROTOCOL v1                              ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │                      CORE OPERATIONS                             │   ││
│  │  │  - session.create/get/update/delete                              │   ││
│  │  │  - chat.completions (streaming)                                  │   ││
│  │  │  - agents.list/get/execute                                       │   ││
│  │  │  - tools.list/get/execute                                        │   ││
│  │  │  - skills.list/get/exec                                          │   ││
│  │  │  - workflows.list/get/run/validate                               │   ││
│  │  │  - voice.tts/clone/upload                                        │   ││
│  │  │  - operator.browser/vision/parallel                              │   ││
│  │  │  - rails.plan/dags/wih/leases/ledger/mail                        │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                │                                             │
│           ┌────────────────────┼─────────────────────┐                      │
│           ▼                    ▼                     ▼                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  stdio Transport│  │ HTTP Transport  │  │  SSE Transport  │             │
│  │  (JSON-RPC 2.0) │  │ (REST + Stream) │  │  (compat only)  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Operations Mapping

### 1. Session Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `POST /api/v1/sessions` | `session.create` | `session/create` | `POST /v1/sessions` |
| `GET /api/v1/sessions` | `session.list` | `session/list` | `GET /v1/sessions` |
| `GET /api/v1/sessions/{id}` | `session.get` | `session/get` | `GET /v1/sessions/{id}` |
| `PATCH /api/v1/sessions/{id}` | `session.update` | `session/update` | `PATCH /v1/sessions/{id}` |
| `DELETE /api/v1/sessions/{id}` | `session.delete` | `session/delete` | `DELETE /v1/sessions/{id}` |

**Request Shape (Core):**
```json
{
  "profile_id": "string",
  "capsules": ["string"],
  "metadata": {},
  "timeout": 3600000
}
```

**Response Shape (Core):**
```json
{
  "id": "string",
  "profile_id": "string",
  "status": "active|paused|completed|error",
  "created_at": "ISO8601",
  "expires_at": "ISO8601",
  "capsules": ["string"],
  "metadata": {}
}
```

### 2. Chat Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `POST /api/chat` | `chat.completions` | `chat/completions` | `POST /v1/chat/completions` |
| `GET /sessions/{id}/messages` | `chat.messages` | `chat/messages` | `GET /v1/sessions/{id}/messages` |

**Request Shape (Core):**
```json
{
  "session_id": "string",
  "messages": [
    { "role": "user|assistant|system", "content": "string|MessagePart[]" }
  ],
  "stream": true,
  "model": "string",
  "options": {
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

**Streaming Events (Core → Transport):**
```typescript
type ChatEvent =
  | { type: 'session.started', data: { session_id: string, kernel_session_id: string } }
  | { type: 'message.delta', data: { content: string, reasoning?: string, index: number } }
  | { type: 'message.completed', data: { content: string } }
  | { type: 'tool.call', data: { tool_call_id: string, tool_name: string, arguments: unknown } }
  | { type: 'tool.result', data: { tool_call_id: string, result: unknown, error?: string } }
  | { type: 'artifact.created', data: { id: string, type: string, content: string } }
  | { type: 'done', data: { usage: { prompt_tokens: number, completion_tokens: number } } }
  | { type: 'error', data: { code: string, message: string } };
```

### 3. Agent Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `GET /api/v1/agents` | `agents.list` | `agents/list` | `GET /v1/agents` |
| `GET /api/v1/agents/{id}` | `agents.get` | `agents/get` | `GET /v1/agents/{id}` |
| `POST /api/v1/agents` | `agents.create` | `agents/create` | `POST /v1/agents` |
| `POST /api/v1/agents/{id}/runs` | `agents.execute` | `agents/execute` | `POST /v1/agents/{id}/execute` |

### 4. Tool Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `GET /api/v1/tools` | `tools.list` | `tools/list` | `GET /v1/tools` |
| `GET /api/v1/tools/{id}` | `tools.get` | `tools/get` | `GET /v1/tools/{id}` |
| `POST /api/v1/tools/{id}/execute` | `tools.execute` | `tools/execute` | `POST /v1/tools/{id}/execute` |

### 5. Voice Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `GET /api/v1/voice/voices` | `voice.voices` | `voice/voices` | `GET /v1/voice/voices` |
| `GET /api/v1/voice/models` | `voice.models` | `voice/models` | `GET /v1/voice/models` |
| `POST /api/v1/voice/tts` | `voice.tts` | `voice/tts` | `POST /v1/voice/tts` |
| `POST /api/v1/voice/clone` | `voice.clone` | `voice/clone` | `POST /v1/voice/clone` |

### 6. Operator Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `POST /api/v1/operator/browser/tasks` | `operator.browser.create_task` | `operator/browser/create_task` | `POST /v1/operator/browser/tasks` |
| `POST /api/v1/operator/vision/propose` | `operator.vision.propose` | `operator/vision/propose` | `POST /v1/operator/vision/propose` |
| `POST /api/v1/operator/parallel/runs` | `operator.parallel.run` | `operator/parallel/run` | `POST /v1/operator/parallel/runs` |

### 7. Rails Operations

| Legacy Endpoint | Core Operation | stdio Method | HTTP Method/Path |
|-----------------|----------------|--------------|------------------|
| `POST /api/v1/rails/plan` | `rails.plan` | `rails/plan` | `POST /v1/rails/plan` |
| `POST /api/v1/rails/wihs` | `rails.wih.create` | `rails/wih/create` | `POST /v1/rails/wihs` |
| `POST /api/v1/rails/leases` | `rails.lease.create` | `rails/lease/create` | `POST /v1/rails/leases` |
| `POST /api/v1/rails/ledger/tail` | `rails.ledger.tail` | `rails/ledger/tail` | `POST /v1/rails/ledger/tail` |
| `POST /api/v1/rails/mail/threads` | `rails.mail.threads` | `rails/mail/threads` | `POST /v1/rails/mail/threads` |

---

## Event Bus Mapping

### Core Events (Transport-Agnostic)

```typescript
interface CoreEvents {
  // Session lifecycle
  'session.created': { session_id: string, profile_id: string, capsules: string[] };
  'session.resumed': { session_id: string, last_activity: string };
  'session.paused': { session_id: string, reason: string };
  'session.completed': { session_id: string, duration_ms: number };
  'session.error': { session_id: string, error: string };
  
  // Message streaming
  'message.started': { message_id: string, session_id: string };
  'message.delta': { message_id: string, content: string, index: number };
  'message.completed': { message_id: string, content: string, usage: TokenUsage };
  
  // Tool execution
  'tool.call.started': { tool_call_id: string, tool_name: string, arguments: unknown };
  'tool.call.completed': { tool_call_id: string, result: unknown };
  'tool.call.error': { tool_call_id: string, error: string };
  
  // Artifacts
  'artifact.created': { artifact_id: string, type: string, metadata: unknown };
  
  // System
  'health.check': { services: Record<string, ServiceHealth> };
  'error': { code: string, message: string, details?: unknown };
}
```

### Legacy SSE Event Translation (Compat Layer)

| Core Event | Legacy SSE Type | Notes |
|------------|-----------------|-------|
| `session.created` | `session.started` | Add kernel_session_id mapping |
| `message.delta` | `message.delta` | Direct mapping |
| `message.completed` | `message.completed` | Direct mapping |
| `tool.call.started` | `tool.call` | Rename type |
| `tool.call.completed` | `tool.result` | Rename type |
| `artifact.created` | `artifact.created` | Direct mapping |
| `error` | `error` | Direct mapping |
| - | `done` | Generated from message.completed |

---

## Message Parts Model

### Core Message Part Types

```typescript
type MessagePart =
  // Text content
  | { type: 'text'; text: string }
  
  // Reasoning/thinking content
  | { type: 'reasoning'; reasoning: string }
  
  // File attachments
  | { type: 'file'; file: { id: string; name: string; content_type: string; size: number } }
  
  // Source citations
  | { type: 'source'; source: { id: string; url: string; title: string } }
  
  // Code blocks
  | { type: 'code'; code: string; language: string }
  
  // Images
  | { type: 'image'; image: { url: string; alt?: string; width?: number; height?: number } }
  
  // Audio
  | { type: 'audio'; audio: { url: string; duration?: number } }
  
  // Tool invocations
  | { 
      type: 'tool'; 
      tool_call_id: string; 
      tool_name: string; 
      state: 'loading' | 'result' | 'error';
      input?: unknown;
      output?: unknown;
      error?: string;
    }
  
  // Structured data
  | { type: 'data'; data_type: string; data: unknown };
```

### Legacy Message Shape Adapter

```typescript
// Legacy ChatMessage (from 6-ui/allternit-platform)
interface LegacyChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string | MessagePart[];
  parts?: MessagePart[];
  metadata?: {
    parentMessageId?: string;
    createdAt?: string;
    usage?: TokenUsage;
  };
  experimental_attachments?: Attachment[];
}

// Core Message
interface CoreMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  session_id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// Adapter function
function legacyToCore(legacy: LegacyChatMessage, session_id: string): CoreMessage {
  const parts: MessagePart[] = [];
  
  // Convert content
  if (typeof legacy.content === 'string') {
    parts.push({ type: 'text', text: legacy.content });
  } else {
    parts.push(...legacy.content);
  }
  
  // Convert attachments
  if (legacy.experimental_attachments) {
    for (const attachment of legacy.experimental_attachments) {
      parts.push({
        type: 'file',
        file: {
          id: attachment.id,
          name: attachment.name,
          content_type: attachment.contentType,
          size: attachment.size || 0,
        }
      });
    }
  }
  
  return {
    id: legacy.id,
    role: legacy.role,
    parts,
    session_id,
    created_at: legacy.metadata?.createdAt || new Date().toISOString(),
    metadata: legacy.metadata,
  };
}
```

---

## Compatibility Layer Requirements

### When to Use Compat Layer

The compat layer (`/gateway/compat/gizzi/`) is required if:

1. **Existing UI code** directly calls legacy endpoint paths that differ from core paths
2. **SSE event types** in UI don't match core event types
3. **Request/response shapes** have incompatible differences

### Compat Layer Structure

```
/gateway/compat/gizzi/
├── routes/
│   ├── sessions.ts      # Legacy /api/v1/sessions/* routes
│   ├── chat.ts          # Legacy /api/chat route
│   ├── agents.ts        # Legacy /api/v1/agents/* routes
│   ├── tools.ts         # Legacy /api/v1/tools/* routes
│   ├── voice.ts         # Legacy /api/v1/voice/* routes
│   ├── operator.ts      # Legacy /api/v1/operator/* routes
│   └── rails.ts         # Legacy /api/v1/rails/* routes
├── events/
│   └── sse-adapter.ts   # Core events → Legacy SSE types
└── schemas/
    ├── session.ts       # Legacy session schema
    ├── message.ts       # Legacy message schema
    └── events.ts        # Legacy event schema
```

### Deprecation Strategy

```typescript
// Mark compat routes with deprecation headers
response.header('X-Route-Deprecation', 'legacy');
response.header('X-Route-Sunset', '2025-06-01');
response.header('X-Route-Migration', '/v1/sessions');
```

---

## Allternit Kernel Integration

### Kernel Adapter Interface

```typescript
interface AllternitKernelAdapter {
  // Session management
  createSession(profile_id: string, capsules: string[]): Promise<Session>;
  getSession(session_id: string): Promise<Session | null>;
  
  // Chat execution
  executeChat(session_id: string, messages: CoreMessage[]): AsyncIterable<ChatEvent>;
  
  // Tool execution
  executeTool(tool_name: string, arguments: unknown, session_id?: string): Promise<unknown>;
  
  // Agent execution
  executeAgent(agent_id: string, input: string, options: AgentOptions): AsyncIterable<AgentEvent>;
  
  // Policy gating
  checkPolicy(action: string, context: unknown): Promise<PolicyDecision>;
}
```

### Kernel Service URLs

| Service | Port | Core Operations |
|---------|------|-----------------|
| API Service | 3000 | chat, sessions, agents, tools, skills, workflows |
| Kernel | 3004 | session state, tool registry, policy |
| Voice | 8001 | tts, clone, upload |
| Operator | 3010 | browser, vision, parallel |
| Rails | 3011 | plan, dags, wih, leases, ledger, mail |

---

## Migration Path

### Phase 1: Dual-Stack (Current)

- Gateway runs with both core protocol and compat layer
- UI code uses existing endpoints
- New code uses core protocol

### Phase 2: Gradual Migration

- Update UI components to use core protocol paths
- Add deprecation warnings to compat routes
- Monitor usage metrics

### Phase 3: Compat Removal

- Remove compat layer
- All traffic uses core protocol
- Update documentation

---

## Testing Strategy

### Contract Tests

```typescript
// Test core operation
describe('session.create', () => {
  it('creates session with valid profile_id', async () => {
    const response = await client.request('session/create', {
      profile_id: 'test_profile',
      capsules: ['browser'],
    });
    
    expect(response.result).toMatchObject({
      status: 'active',
      capsules: ['browser'],
    });
  });
});

// Test legacy compat
describe('POST /api/v1/sessions (compat)', () => {
  it('creates session via legacy endpoint', async () => {
    const response = await httpRequest({
      path: '/compat/api/v1/sessions',
      method: 'POST',
      body: { profile_id: 'test_profile' },
    });
    
    expect(response.statusCode).toBe(200);
  });
});
```

### Smoke Tests

1. **stdio transport**: Spawn subprocess, send JSON-RPC, verify streaming
2. **HTTP transport**: Start server, call REST endpoints, verify SSE
3. **Compat layer**: Call legacy endpoints, verify translation to core

---

**Document Version:** 1.0.0  
**Maintainer:** Allternit Platform Team
