# N20 API Compatibility Report

**Date:** 2026-02-22  
**Frontend:** `/6-ui/a2r-platform/src/lib/agents/`  
**Backend:** `/1-kernel/infrastructure/a2r-openclaw-host/src/api/`

---

## Executive Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Session API | ✅ Compatible | Minor field name mapping needed |
| Chat Streaming | ⚠️ Partial | Backend stub returns minimal SSE; frontend expects rich events |
| Tools API | ✅ Compatible | Field mapping needed (`tool` → `tool_id`) |
| Canvas API | ⚠️ Mismatch | Different data models between frontend and backend |

**Overall Status:** ⚠️ **NEEDS ATTENTION** - API layer requires updates for full compatibility

---

## Detailed Analysis

### 1. Session API ✅

**Routes Match:** Yes

| Method | Route | Status |
|--------|-------|--------|
| GET | `/v1/agent/sessions` | ✅ |
| POST | `/v1/agent/sessions` | ⚠️ Field name mismatch |
| GET | `/v1/agent/sessions/:id` | ✅ |
| PATCH | `/v1/agent/sessions/:id` | ⚠️ Field name mismatch |
| DELETE | `/v1/agent/sessions/:id` | ✅ |

**Field Mapping Required:**

| Frontend | Backend | Transform |
|----------|---------|-----------|
| `name` | `title` | `name` → `title` |
| `description` | `metadata.description` | `description` → `metadata.description` |
| `createdAt` | `created_at` | camelCase → snake_case |
| `updatedAt` | `updated_at` | camelCase → snake_case |
| `messageCount` | `message_count` | camelCase → snake_case |
| `isActive` | (not present) | Add to backend or remove from frontend |
| `tags` | (not present) | Add to backend or remove from frontend |

**Backend Response Shape:**
```rust
pub struct SessionResponse {
    pub id: String,
    pub title: String,              // ← frontend uses `name`
    pub created_at: String,         // ← frontend uses `createdAt`
    pub updated_at: String,         // ← frontend uses `updatedAt`
    pub message_count: u32,         // ← frontend uses `messageCount`
    pub metadata: Option<HashMap<String, serde_json::Value>>,  // ← store description here
}
```

**Frontend Store Shape:**
```typescript
interface NativeSession {
  id: string;
  name?: string;                  // ← backend uses `title`
  description?: string;           // ← should go in metadata
  createdAt: string;              // ← backend uses `created_at`
  updatedAt: string;              // ← backend uses `updated_at`
  lastAccessedAt: string;         // ← not in backend
  messageCount: number;           // ← backend uses `message_count`
  isActive: boolean;              // ← not in backend
  tags: string[];                 // ← not in backend
  metadata?: Record<string, unknown>;
}
```

**Resolution:**
- ✅ Created `native-agent-api.ts` with transformation layer
- Frontend `name` → Backend `title`
- Frontend `description` → Backend `metadata.description`

---

### 2. Chat Streaming ⚠️

**Routes Match:** Yes

| Method | Route | Status |
|--------|-------|--------|
| POST | `/v1/agent/sessions/:id/chat/stream` | ⚠️ Event format mismatch |
| POST | `/v1/agent/sessions/:id/abort` | ✅ |
| POST | `/v1/agent/sessions/:id/inject` | ✅ |

**Event Format Mismatch:**

Backend sends:
```json
{
  "chunk": "Hello",
  "chunk_type": "text",
  "session_id": "sess_123"
}
```

Frontend expects:
```typescript
interface StreamEvent {
  type: 'message_start' | 'message_delta' | 'message_complete' | 
        'tool_call' | 'tool_result' | 'tool_error' | 
        'canvas_update' | 'error' | 'done';
  sessionId?: string;
  messageId?: string;
  delta?: { content?: string; reasoning?: string };
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  canvas?: Canvas;
  error?: string;
  timestamp: string;
}
```

**Issues:**
1. Backend uses flat `chunk` string; frontend expects `delta.content`
2. Backend uses `chunk_type` enum values: `text`, `tool_call`, `tool_result`, `error`, `done`
3. Frontend expects `type` with values: `message_start`, `message_delta`, etc.
4. Frontend expects `messageId` for tracking; backend doesn't send it
5. Frontend expects `toolCall` object; backend sends tool calls in `chunk`

**Resolution:**
- ✅ Created mapping layer in `native-agent-api.ts`
- Need to update backend to send richer events OR
- Update frontend to handle simpler `chunk`-based format

**Recommendation:**
Update backend SSE to send structured events that match frontend expectations:

```rust
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    MessageStart { message_id: String, timestamp: String },
    MessageDelta { message_id: String, delta: Delta },
    MessageComplete { message_id: String, timestamp: String },
    ToolCall { tool_call: ToolCall },
    ToolResult { tool_result: ToolResult },
    CanvasUpdate { canvas: Canvas },
    Error { error: String },
    Done,
}
```

---

### 3. Tools API ✅

**Routes Match:** Yes

| Method | Route | Status |
|--------|-------|--------|
| GET | `/v1/agent/tools` | ✅ |
| POST | `/v1/agent/sessions/:id/tools/execute` | ⚠️ Field name mismatch |
| POST | `/v1/agent/sessions/:id/tools/stream` | ⚠️ Field name mismatch |

**Field Mapping Required:**

| Frontend | Backend | Transform |
|----------|---------|-----------|
| `tool` | `tool_id` | `tool` → `tool_id` |
| `parameters` | `arguments` | `parameters` → `arguments` |

**Backend Request Shape:**
```rust
pub struct ToolExecuteRequest {
    pub tool_id: String,            // ← frontend uses `tool`
    pub arguments: HashMap<String, Value>,  // ← frontend uses `parameters`
}
```

**Frontend Store Shape:**
```typescript
async executeTool(
  sessionId: string,
  toolName: string,               // ← backend uses `tool_id`
  parameters: Record<string, unknown>  // ← backend uses `arguments`
): Promise<ToolResult>
```

**Resolution:**
- ✅ Created mapping layer in `native-agent-api.ts`
- Frontend `tool` → Backend `tool_id`
- Frontend `parameters` → Backend `arguments`

---

### 4. Canvas API ⚠️

**Routes Match:** Yes

| Method | Route | Status |
|--------|-------|--------|
| POST | `/v1/agent/canvas` | ⚠️ Data model mismatch |
| GET | `/v1/agent/canvas/:id` | ⚠️ Data model mismatch |
| POST | `/v1/agent/canvas/:id` | ⚠️ Different operation model |
| DELETE | `/v1/agent/canvas/:id` | ✅ |

**Major Data Model Mismatch:**

Backend Canvas Model (A2UI-centric):
```rust
pub struct CanvasResponse {
    pub id: String,
    pub session_id: String,
    pub components: Vec<Value>,     // A2UI components
    pub layout: Value,              // A2UI layout
    pub created_at: String,
    pub updated_at: String,
}
```

Frontend Canvas Model (Document-centric):
```typescript
interface Canvas {
  id: string;
  sessionId: string;
  content: string;                // ← Not in backend model
  type: 'code' | 'markdown' | 'json' | 'text';  // ← Not in backend model
  language?: string;              // ← Not in backend model
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
```

**Issues:**
1. Backend is designed for A2UI component system
2. Frontend expects a document/content model (like a code editor)
3. Backend has `components` and `layout`; frontend has `content` and `type`
4. Backend `POST /canvas/:id` expects operations; frontend expects content updates

**Resolution Options:**

**Option A: Extend Backend** (Recommended)
Add content-based canvas type to backend:

```rust
pub enum CanvasType {
    A2UI { components: Vec<Value>, layout: Value },
    Document { content: String, language: String, doc_type: String },
}
```

**Option B: Adapt Frontend**
Change NativeAgentView to work with A2UI components instead of documents.

**Option C: Separate API**
Create `/v1/agent/documents` endpoint for document-based canvases.

---

## API Client Layer

Created `/6-ui/a2r-platform/src/lib/agents/native-agent-api.ts`:

- ✅ Handles all field name transformations
- ✅ Provides typed request/response interfaces
- ✅ Includes SSE streaming with proper parsing
- ✅ Error handling with `NativeAgentApiError`
- ✅ Export `nativeAgentApi` with all 4 namespaces:
  - `nativeAgentApi.sessions`
  - `nativeAgentApi.chat`
  - `nativeAgentApi.tools`
  - `nativeAgentApi.canvas`

---

## Required Backend Updates

### 1. Session API (Minor)
- Add `is_active` field (optional)
- Add `tags` field (optional)

### 2. Chat Streaming (Major)
Update `chat_stream` to send structured events:

```rust
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message_id: String, timestamp: String },
    
    #[serde(rename = "message_delta")]
    MessageDelta { message_id: String, delta: Delta },
    
    #[serde(rename = "tool_call")]
    ToolCall { tool_call: ToolCall },
    
    #[serde(rename = "tool_result")]
    ToolResult { tool_result: ToolResult },
    
    #[serde(rename = "done")]
    Done,
}
```

### 3. Canvas API (Major)
Either:
- Add document/content mode to CanvasService
- Or create separate Document/Artifact API

---

## Frontend Store Updates Needed

Update `native-agent.store.ts` to use `native-agent-api.ts`:

```typescript
// Instead of direct fetch calls:
const response = await fetch(`${AGENT_API_BASE}/sessions`);

// Use the API layer:
const sessions = await nativeAgentApi.sessions.listSessions();
```

This ensures proper field mapping and type safety.

---

## Testing Checklist

- [ ] Session CRUD operations
- [ ] Chat streaming with SSE
- [ ] Tool execution
- [ ] Canvas operations (pending backend update)
- [ ] Error handling
- [ ] Abort functionality
- [ ] Message injection (PI Agent)

---

## Next Steps

1. **Update Backend Chat Streaming** - Implement rich SSE events
2. **Decide Canvas Strategy** - A2UI vs Document model
3. **Update Frontend Store** - Use `native-agent-api.ts` layer
4. **Run E2E Tests** - Verify full flow works
5. **Performance Testing** - SSE streaming under load
