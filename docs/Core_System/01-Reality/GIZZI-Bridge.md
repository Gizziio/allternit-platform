# GIZZI-Computer Use Bridge Contract

Version: 0.1.0  
Status: Active (Phase 1 - Stub)  

This document defines the exact contract between GIZZI Code (TypeScript) and Allternit Computer Use Gateway (Python). Both sides must implement this contract precisely to prevent silent drift.

---

## Endpoint

```
POST /v1/execute
```

### Base URL

Environment variable: `Allternit_COMPUTER_USE_URL`  
Default: `http://localhost:8080`

---

## Request Schema

### HTTP Headers

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>  # Optional, from Allternit_COMPUTER_USE_TOKEN
```

### Body

```typescript
{
  // Required
  action: "execute" | "goto" | "click" | "fill" | "extract" | "screenshot" | "inspect",
  session_id: string,  // Persists browser state across calls
  run_id: string,      // Logical run identifier

  // Optional (action-dependent)
  target?: string,     // URL for "goto", selector for "click"/"fill", query for "extract"
  goal?: string,       // High-level goal for "execute" action
  
  // Optional
  parameters?: {
    text?: string,           // For "fill" action
    timeout?: number,        // Milliseconds, default 30000
    message_id?: string,     // GIZZI message ID (for tracing)
    call_id?: string,        // Tool call ID (for tracing)
    [key: string]: any,      // Action-specific extras
  },
  
  // Optional hint - gateway may override
  adapter_preference?: "playwright" | "browser-use" | "cdp" | "desktop"
}
```

### Validation Rules

| Action | Required Fields | Error if Missing |
|--------|-----------------|------------------|
| `goto` | `target` (URL) | 400 `target is required for goto` |
| `click` | `target` (selector) | 400 `target is required for click` |
| `fill` | `target`, `parameters.text` | 400 `target is required` / `parameters.text is required` |
| `execute` | `goal` | 400 `goal is required for execute` |
| `screenshot` | none | - |
| `inspect` | none | - |
| `extract` | `target` or `goal` | 400 `target or goal required` |

---

## Response Schema

### Success (200)

```typescript
{
  // Identity
  run_id: string,           // Echo of request.run_id
  session_id: string,       // Echo of request.session_id
  trace_id: string,         // UUID for distributed tracing

  // Execution metadata
  adapter_id: string,       // e.g., "browser.playwright", "browser.browser-use"
  family: "browser" | "desktop" | "retrieval" | "hybrid",
  mode: "assist" | "execute" | "inspect" | "parallel" | "desktop" | "hybrid" | "crawl",
  status: "completed" | "failed" | "cancelled",

  // Content
  summary: string,          // Human-readable result description
  extracted_content?: any,  // Structured data (for extract action)

  // Attachments
  artifacts: Array<{
    type: "screenshot" | "download" | "json" | "text" | "html",
    path?: string,          // Server-side path (if persisted)
    url?: string,           // Base64 data URL or accessible URL
    mime?: string,          // MIME type
    content?: string,       // Inline content (small text only)
  }>,

  // Audit trail
  receipts: Array<{
    action: string,
    timestamp: string,      // ISO 8601 UTC
    success: boolean,
    details?: Record<string, any>
  }>,

  // Error (only if status === "failed")
  error?: {
    code: string,           // Machine-readable error code
    message: string         // Human-readable description
  }
}
```

### Error (4xx/5xx)

```typescript
{
  detail: string  // FastAPI default error format
}
```

---

## Timeout Behavior

| Timeout | Default | Max | Behavior |
|---------|---------|-----|----------|
| Request | 30000ms | 120000ms | Gateway returns `status: "failed"`, `error.code: "TIMEOUT"` |
| Navigation | 30000ms | 60000ms | Playwright `page.goto()` timeout |
| Screenshot | 10000ms | 30000ms | Playwright `page.screenshot()` timeout |

Override via `parameters.timeout`.

---

## Error Codes

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `VALIDATION_ERROR` | Request schema invalid | 400 |
| `TARGET_REQUIRED` | Action needs target, none provided | 400 |
| `GOAL_REQUIRED` | Action needs goal, none provided | 400 |
| `TIMEOUT` | Action exceeded timeout | 504 |
| `NAVIGATION_ERROR` | Page failed to load | 500 |
| `ADAPTER_ERROR` | Adapter crashed/unavailable | 500 |
| `ADAPTER_NOT_FOUND` | Requested adapter unavailable | 501 |
| `SESSION_ERROR` | Browser session failed | 500 |
| `INTERNAL_ERROR` | Unknown gateway error | 500 |

---

## Artifact Rules

### Screenshots

```typescript
{
  type: "screenshot",
  mime: "image/png",
  url: "data:image/png;base64,iVBORw0KGgo..."  // Always base64 data URL
}
```

- Format: PNG
- Encoding: Base64
- Data URL prefix: `data:image/png;base64,`
- Max size: 5MB (gateway may downsample)

### Downloads

```typescript
{
  type: "download",
  mime: "application/octet-stream",  // Or actual MIME
  url: "data:application/octet-stream;base64,..."  // Or persisted file URL
}
```

### JSON/Text/HTML

```typescript
{
  type: "json" | "text" | "html",
  mime: "application/json" | "text/plain" | "text/html",
  content: "..."  // Inline for small content (<100KB)
}
```

---

## Session/Run ID Rules

### Session Persistence

- `session_id` maps to browser context (Playwright) or agent instance (browser-use)
- Gateway maintains session cache: `Dict[session_id, BrowserContext]`
- Sessions expire after 30 minutes of inactivity
- Sessions are not shared between gateway restarts

### Run Identity

- `run_id` is logical identifier for the GIZZI run
- One run may have multiple sessions (if session expires/recreates)
- Receipts include both `session_id` and `run_id` for audit

### Adapter Selection

Gateway logic (in order):
1. If `adapter_preference` specified and available → use it
2. If `action === "execute"` → `browser.browser-use`
3. If `action in ["goto", "click", "fill", "screenshot", "inspect"]` → `browser.playwright`
4. If `adapter_preference === "desktop"` → `desktop.pyautogui`
5. Fallback → `browser.playwright`

---

## Example Flows

### goto + screenshot

**Request:**
```json
{
  "action": "goto",
  "session_id": "sess_abc123",
  "run_id": "run_xyz789",
  "target": "https://example.com",
  "parameters": {
    "timeout": 30000,
    "message_id": "msg_001",
    "call_id": "call_001"
  }
}
```

**Response:**
```json
{
  "run_id": "run_xyz789",
  "session_id": "sess_abc123",
  "trace_id": "uuid-trace-123",
  "adapter_id": "browser.playwright",
  "family": "browser",
  "mode": "execute",
  "status": "completed",
  "summary": "Navigated to https://example.com",
  "artifacts": [],
  "receipts": [
    {
      "action": "goto",
      "timestamp": "2026-03-15T12:00:00Z",
      "success": true,
      "details": {
        "target": "https://example.com",
        "load_time_ms": 450
      }
    }
  ]
}
```

### screenshot (after goto)

**Request:**
```json
{
  "action": "screenshot",
  "session_id": "sess_abc123",
  "run_id": "run_xyz789"
}
```

**Response:**
```json
{
  "run_id": "run_xyz789",
  "session_id": "sess_abc123",
  "trace_id": "uuid-trace-124",
  "adapter_id": "browser.playwright",
  "family": "browser",
  "mode": "inspect",
  "status": "completed",
  "summary": "Captured viewport screenshot",
  "artifacts": [
    {
      "type": "screenshot",
      "mime": "image/png",
      "url": "data:image/png;base64,iVBORw0KGgo..."
    }
  ],
  "receipts": [
    {
      "action": "screenshot",
      "timestamp": "2026-03-15T12:00:05Z",
      "success": true
    }
  ]
}
```

---

## Versioning

Contract version is independent of gateway version.

| Contract Version | Gateway Version | Changes |
|-----------------|-----------------|---------|
| 0.1.0 | 0.1.0 | Initial stub contract |
| 0.2.0 | 0.2.0 | Add artifact persistence |
| 0.3.0 | 0.3.0 | Add WebSocket streaming |

Breaking changes require major version bump.

---

## Changelog

### 0.1.0 (Current)
- Initial contract for stub gateway
- Defined request/response schemas
- Defined error codes and timeout behavior
- Specified artifact rules (base64 screenshots)
- Defined session/run ID rules
