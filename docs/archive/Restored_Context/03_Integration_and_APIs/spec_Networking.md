# Allternit Shell Protocol v1

## Overview

The Allternit Shell Protocol defines the networking architecture for the Allternit platform. All UI clients communicate with a single Gateway endpoint, which routes requests to internal services and provides real-time event streaming via SSE.

**Version:** 1.0.0  
**Base URL:** `http://allternit-shell.local:3210` (or `http://127.0.0.1:3210`)  
**API Version:** `/v1/*`

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────────────┐
│   UI Client │────▶│  Allternit Gateway     │────▶│  Internal Services              │
│   (React)   │     │  (Fastify)       │     │                                 │
│             │◀────│  Port: 3210      │◀────│  - API Service (3000)           │
│  ALLTERNIT_BASE   │ SSE │                  │     │  - Operator (3010)              │
│  _URL       │◀────│  REST + SSE      │     │  - Rails (3011)                 │
└─────────────┘     │  /v1/*           │     │  - Voice (8001)                 │
                    └──────────────────┘     │  - WebVM (8002)                 │
                                             └─────────────────────────────────┘
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLTERNIT_BASE_URL` | Single source of truth for all API calls | `http://127.0.0.1:3210` |
| `ALLTERNIT_GATEWAY_HOST` | Gateway bind host | `0.0.0.0` |
| `ALLTERNIT_GATEWAY_PORT` | Gateway port | `3210` |

### UI Configuration

All UI clients MUST use `ALLTERNIT_BASE_URL` as the single source of truth:

```typescript
// ✅ Correct
const API_BASE = import.meta.env.VITE_ALLTERNIT_BASE_URL || 'http://127.0.0.1:3210';

// ❌ Incorrect - do not use scattered ports
const VOICE_URL = 'http://127.0.0.1:8001';
const OPERATOR_URL = 'http://127.0.0.1:3010';
```

---

## REST Endpoints

### Health & Discovery

#### `GET /health`

Gateway health check.

**Response:**
```json
{
  "status": "healthy",
  "service": "allternit-gateway",
  "version": "1.0.0",
  "timestamp": 1708617600000,
  "backends": {
    "api": "healthy",
    "operator": "healthy",
    "rails": "healthy"
  }
}
```

#### `GET /v1/discovery`

Service discovery endpoint returning available services and their capabilities.

**Response:**
```json
{
  "gateway": {
    "version": "1.0.0",
    "baseUrl": "http://127.0.0.1:3210"
  },
  "services": [
    { "name": "api", "status": "healthy", "endpoints": ["/v1/chat", "/v1/agents"] },
    { "name": "operator", "status": "healthy", "endpoints": ["/v1/operator/browser", "/v1/operator/vision"] },
    { "name": "rails", "status": "healthy", "endpoints": ["/v1/rails/plan", "/v1/rails/dags"] }
  ]
}
```

---

### Chat & Messaging

#### `POST /v1/chat/completions`

Send a chat message and receive streaming response via SSE.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello, how can I use Allternit?" }
  ],
  "stream": true,
  "model": "default",
  "options": {
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

**Response (streaming via SSE):**
```
event: message
data: {"id":"msg_123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello!"}}]}

event: message
data: {"id":"msg_123","object":"chat.completion.chunk","choices":[{"delta":{"content":" How can I help?"}}]}

event: done
data: {"id":"msg_123","usage":{"prompt_tokens":10,"completion_tokens":20}}
```

**Error Response:**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Messages array is required",
    "details": {}
  }
}
```

---

### Agent Operations

#### `GET /v1/agents`

List all registered agents.

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_001",
      "name": "Research Agent",
      "description": "Performs web research and summarization",
      "status": "active",
      "capabilities": ["search", "summarize", "cite"]
    }
  ]
}
```

#### `POST /v1/agents/{agentId}/execute`

Execute an agent with given input.

**Request:**
```json
{
  "input": "Research quantum computing trends in 2024",
  "parameters": {
    "depth": "comprehensive",
    "sources": ["web", "academic"]
  }
}
```

**Response (streaming):**
SSE events with progress updates and final result.

---

### Operator (Browser Automation)

#### `POST /v1/operator/browser/navigate`

Navigate browser to URL.

**Request:**
```json
{
  "url": "https://example.com",
  "options": {
    "waitUntil": "networkidle",
    "timeout": 30000
  }
}
```

**Response:**
```json
{
  "sessionId": "browser_001",
  "status": "success",
  "title": "Example Domain",
  "screenshot": "data:image/png;base64,..."
}
```

#### `POST /v1/operator/browser/screenshot`

Capture browser screenshot.

**Request:**
```json
{
  "sessionId": "browser_001",
  "options": {
    "fullPage": true,
    "format": "png"
  }
}
```

---

### Vision

#### `POST /v1/vision/analyze`

Analyze an image with vision model.

**Request:**
```json
{
  "image": "data:image/png;base64,...",
  "prompt": "Describe what you see in this image",
  "options": {
    "detail": "high"
  }
}
```

**Response:**
```json
{
  "analysis": "The image shows a modern office space with...",
  "confidence": 0.95,
  "objects": [
    { "label": "desk", "confidence": 0.98 },
    { "label": "chair", "confidence": 0.92 }
  ]
}
```

---

### Rails (Workflow Engine)

#### `GET /v1/rails/plan`

Get current execution plan.

**Response:**
```json
{
  "planId": "plan_001",
  "status": "running",
  "steps": [
    { "id": "step_1", "name": "Fetch Data", "status": "completed" },
    { "id": "step_2", "name": "Process", "status": "running" },
    { "id": "step_3", "name": "Store Results", "status": "pending" }
  ]
}
```

#### `POST /v1/rails/dags`

Create a new DAG workflow.

**Request:**
```json
{
  "name": "Data Pipeline",
  "nodes": [
    { "id": "extract", "type": "extractor", "config": {...} },
    { "id": "transform", "type": "transformer", "dependsOn": ["extract"] },
    { "id": "load", "type": "loader", "dependsOn": ["transform"] }
  ]
}
```

---

### Voice

#### `POST /v1/voice/tts`

Text-to-speech conversion.

**Request:**
```json
{
  "text": "Hello, this is a test",
  "voice": "default",
  "format": "wav",
  "use_paralinguistic": true
}
```

**Response:**
```json
{
  "audio_url": "http://127.0.0.1:3210/v1/voice/audio/tts_001.wav",
  "duration": 2.5,
  "format": "wav"
}
```

#### `GET /v1/voice/voices`

List available voices.

**Response:**
```json
{
  "voices": [
    { "id": "default", "name": "Default Voice", "language": "en-US" },
    { "id": "professional", "name": "Professional", "language": "en-US" }
  ]
}
```

---

### Sessions

#### `GET /v1/sessions`

List active sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "sess_001",
      "userId": "user_123",
      "createdAt": "2024-02-22T10:00:00Z",
      "lastActivity": "2024-02-22T10:30:00Z",
      "capsules": ["browser", "terminal"]
    }
  ]
}
```

#### `POST /v1/sessions`

Create a new session.

**Request:**
```json
{
  "capsules": ["browser", "terminal"],
  "options": {
    "timeout": 3600
  }
}
```

---

### Ledger (Audit Trail)

#### `GET /v1/ledger`

Query audit ledger entries.

**Query Parameters:**
- `from`: Start timestamp (ISO 8601)
- `to`: End timestamp (ISO 8601)
- `agent`: Filter by agent ID
- `action`: Filter by action type

**Response:**
```json
{
  "entries": [
    {
      "id": "entry_001",
      "timestamp": "2024-02-22T10:00:00Z",
      "agent": "agent_001",
      "action": "execute",
      "input": {"query": "..."},
      "output": {"result": "..."},
      "hash": "sha256:abc123..."
    }
  ],
  "total": 1,
  "hasMore": false
}
```

---

## SSE Event Taxonomy

### Connection

**Endpoint:** `GET /v1/events`

Establishes an SSE connection for real-time events.

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Event Types

#### `connected`

Sent when SSE connection is established.

```
event: connected
data: {"sessionId":"sess_001","timestamp":1708617600000}
```

#### `message`

Chat completion chunk or agent response.

```
event: message
data: {"id":"msg_123","type":"chunk","content":"Hello!","metadata":{}}
```

#### `progress`

Long-running operation progress update.

```
event: progress
data: {"operationId":"op_001","progress":0.5,"stage":"processing","message":"Analyzing data..."}
```

#### `tool_call`

Agent tool execution notification.

```
event: tool_call
data: {"toolId":"search","name":"WebSearch","input":{"query":"..."},"status":"started"}
```

#### `tool_result`

Tool execution result.

```
event: tool_result
data: {"toolId":"search","name":"WebSearch","status":"completed","result":{"items":[...]}}
```

#### `error`

Error event (connection-level or operation-level).

```
event: error
data: {"code":"RATE_LIMITED","message":"Too many requests","retryAfter":60}
```

#### `done`

Operation completed successfully.

```
event: done
data: {"operationId":"op_001","status":"success","summary":{"duration":2.5,"tokens":100}}
```

#### `heartbeat`

Keep-alive heartbeat (sent every 30 seconds).

```
event: heartbeat
data: {"timestamp":1708617600000}
```

---

## Event Ordering Guarantees

For any single operation:

1. `connected` (once per SSE session)
2. Zero or more: `progress`, `tool_call`, `tool_result`, `message`
3. Exactly one terminal event: `done` or `error`
4. Zero or more: `heartbeat` (interspersed during long operations)

**Example Sequence:**
```
connected → progress → tool_call → tool_result → message → progress → done
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
    "traceId": "trace_abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request body validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `BACKEND_UNAVAILABLE` | 503 | Internal service unavailable |
| `BACKEND_TIMEOUT` | 504 | Internal service timeout |
| `GATEWAY_ERROR` | 500 | Internal gateway error |

---

## Authentication

### Supported Methods

1. **Bearer Token (JWT)**
   ```
   Authorization: Bearer <token>
   ```

2. **API Key**
   ```
   Authorization: ApiKey <key>
   ```

3. **Anonymous** (limited access)
   - Health endpoints
   - Discovery endpoint

### Headers Added by Gateway

The gateway adds context headers to proxied requests:

| Header | Description |
|--------|-------------|
| `X-User-ID` | Authenticated user ID |
| `X-User-Email` | Authenticated user email |
| `X-Tenant-ID` | Tenant/organization ID |
| `X-Auth-Method` | Authentication method used |
| `X-Request-ID` | Unique request trace ID |
| `X-Gateway-Version` | Gateway version |

---

## Rate Limiting

| Tier | Requests/Minute | Burst |
|------|-----------------|-------|
| Anonymous | 30 | 10 |
| Authenticated | 120 | 30 |
| Premium | 600 | 100 |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 115
X-RateLimit-Reset: 1708617660
Retry-After: 60
```

---

## CORS

**Allowed Origins:**
- `http://localhost:*` (development)
- `http://allternit-shell.local:*` (development)
- Configured origins (production)

**Allowed Methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`

**Allowed Headers:** `*`

**Exposed Headers:** `X-Request-ID`, `X-Trace-ID`, `X-RateLimit-*`

**Credentials:** Supported

---

## Implementation Notes

### Gateway Shutdown

The gateway MUST handle graceful shutdown:

1. Stop accepting new connections
2. Wait for in-flight requests to complete (max 30s)
3. Close SSE connections with proper `done` events
4. Release resources

### Request Tracing

Every request receives a unique `X-Request-ID` for distributed tracing.

### Health Checks

Backend health is checked:
- On gateway startup
- Every 30 seconds during operation
- Before routing (cached for 5 seconds)

---

## Migration Guide

### From Scattered Ports to Gateway

**Before:**
```typescript
const API_URL = 'http://localhost:3000';
const VOICE_URL = 'http://localhost:8001';
const OPERATOR_URL = 'http://localhost:3010';
```

**After:**
```typescript
const ALLTERNIT_BASE_URL = import.meta.env.VITE_ALLTERNIT_BASE_URL || 'http://127.0.0.1:3210';

// All requests go through gateway
fetch(`${ALLTERNIT_BASE_URL}/v1/voice/tts`, {...});
fetch(`${ALLTERNIT_BASE_URL}/v1/operator/browser/navigate`, {...});
```

### SSE Connection

**Before:**
```typescript
const eventSource = new EventSource('http://localhost:3000/events');
```

**After:**
```typescript
const eventSource = new EventSource(`${ALLTERNIT_BASE_URL}/v1/events`);
```

---

## Appendix: OpenAPI Specification

Full OpenAPI 3.0 specification available at:
- `/docs` (Swagger UI, development only)
- `/openapi.json` (JSON specification)

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-02-22  
**Maintainer:** Allternit Platform Team
