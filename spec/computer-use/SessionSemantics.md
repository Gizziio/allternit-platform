# Browser Tool Session Semantics

## Overview

This document defines how browser actions behave across sessions and how the tool manages state between calls.

## Session Model

### Session ID = Browser Instance

- Each `session_id` maps to an isolated browser context (Playwright)
- Context persists for the lifetime of the gateway process
- Context is lazily created on first action
- Multiple calls with same `session_id` reuse the same browser context

### Page Lifecycle

```
First call with session_id:
  Create browser context → Create new page → Execute action

Subsequent calls with same session_id:
  Reuse existing context → Use current page → Execute action
```

## Action Semantics

### `goto`

- Creates new page if none exists
- Navigates to target URL
- Sets this as the "current page" for the session
- Returns page title and final URL

```
session_id: "sess_123"
action: "goto"
target: "https://example.com"
→ Creates context + page
→ Navigates to example.com
→ Returns: {url: "https://example.com/", title: "Example Domain"}
```

### `screenshot`

**With `target` parameter:**
- Navigates to target URL first (optional shortcut)
- Captures screenshot of current page
- Returns base64 PNG data URL

**Without `target` parameter:**
- Captures screenshot of current page
- Requires previous `goto` to have established a page
- Returns base64 PNG data URL

```
# Option 1: Navigate then capture
action: "screenshot"
target: "https://example.com"
→ Navigates to example.com
→ Captures screenshot

# Option 2: Capture current page
action: "screenshot"
(no target)
→ Captures screenshot of current page
→ Error if no current page exists
```

### `click`, `fill`, `extract` (Future)

- Operate on current page
- Require previous `goto` to have established page state
- Fail if no current page exists

## Error Handling

### Validation Errors (400)

| Error | Condition |
|-------|-----------|
| `target is required for goto` | goto without target |
| `target is required for click` | click without target |
| `target is required for fill` | fill without target |
| `parameters.text is required for fill` | fill without text parameter |
| `goal is required for execute` | execute without goal |

### Runtime Errors (500)

| Error | Condition | Response |
|-------|-----------|----------|
| `NAVIGATION_ERROR` | Page failed to load | status: "failed", error.code: "NAVIGATION_ERROR" |
| `SCREENSHOT_ERROR` | Screenshot capture failed | status: "failed", error.code: "SCREENSHOT_ERROR" |
| `TIMEOUT` | Action exceeded timeout | status: "failed", error.code: "TIMEOUT" |
| `ADAPTER_ERROR` | Playwright crashed/unavailable | status: "failed", error.code: "ADAPTER_ERROR" |

### Error Response Format

```json
{
  "status": "failed",
  "error": {
    "code": "NAVIGATION_ERROR",
    "message": "net::ERR_NAME_NOT_RESOLVED at https://invalid-domain.example"
  },
  "receipts": [{
    "action": "goto",
    "success": false,
    "details": {"error": "..."}
  }]
}
```

## Artifact Policy

### Screenshots

- Format: PNG
- Encoding: Base64 data URL
- Size limit: 5MB (gateway may downsample)
- Prefix: `data:image/png;base64,`
- Inline: Always returned in response (for now)
- Future: Large screenshots may be persisted to file/URL

### Downloads

- Not yet implemented
- Future: Will support file downloads
- Large files will be persisted, not inlined

## Timeout Behavior

| Action | Default | Max | Configurable |
|--------|---------|-----|--------------|
| Navigation | 30s | 60s | `parameters.timeout` |
| Screenshot | 10s | 30s | `parameters.timeout` |
| Other | 30s | 60s | `parameters.timeout` |

Timeouts return `status: "failed"` with `error.code: "TIMEOUT"`.

## State Isolation

### Between Sessions

```
session_id: "sess_A" → Browser Context A
session_id: "sess_B" → Browser Context B

Contexts are isolated:
- Different cookies
- Different localStorage
- Different sessionStorage
- No shared state
```

### Within Session

```
session_id: "sess_A"
  → goto https://site1.com
  → click "#button"  // operates on site1.com
  → goto https://site2.com  // new page or navigation
  → screenshot  // captures site2.com
```

## Cleanup

### Automatic

- Browser contexts remain open for reuse
- No automatic cleanup during gateway lifetime
- Process exit cleans up all contexts

### Future: Session Expiry

- Sessions may expire after 30min inactivity
- Explicit `close` action may be added
- Resource limits may force cleanup

## Examples

### Basic Flow

```bash
# 1. Navigate
curl -X POST http://localhost:8080/v1/execute \
  -d '{
    "action": "goto",
    "session_id": "my_session",
    "run_id": "my_run",
    "target": "https://example.com"
  }'
# → {status: "completed", summary: "Navigated to https://example.com/"}

# 2. Screenshot (same session)
curl -X POST http://localhost:8080/v1/execute \
  -d '{
    "action": "screenshot",
    "session_id": "my_session",
    "run_id": "my_run"
  }'
# → {status: "completed", artifacts: [{type: "screenshot", url: "data:image/png;base64,..."}]}
```

### Error Handling

```bash
# Invalid domain
curl -X POST http://localhost:8080/v1/execute \
  -d '{
    "action": "goto",
    "session_id": "error_test",
    "run_id": "error_run",
    "target": "https://invalid-domain-that-does-not-exist.example"
  }'
# → {status: "failed", error: {code: "NAVIGATION_ERROR", message: "..."}}
```

## GIZZI Integration

### Tool Parameters

```typescript
{
  action: "goto" | "screenshot" | "click" | "fill" | "extract" | "execute" | "inspect",
  target?: string,  // URL or selector
  goal?: string,    // For "execute" action
  text?: string,    // For "fill" action (in parameters)
  adapter_preference?: "playwright" | "browser-use" | "cdp" | "desktop"
}
```

### Permission Hook

All browser actions require user approval via `ctx.ask()`:

```typescript
await ctx.ask({
  permission: "browser",
  patterns: [params.target || actionDescription],
  always: ["browser *"],
  metadata: { action, target, goal }
})
```

### Result Normalization

Gateway response → GIZZI format:
- `summary` → displayed to user
- `artifacts[]` with `type: "screenshot"` → file attachments
- `metadata` → session context (adapter_id, family, mode, receipts)

## Implementation Notes

### Current (v0.2.0)

- Simplified: new browser + page per action
- No persistent session state between actions
- Session semantics documented for future implementation

### Future (v0.3.0+)

- Persistent browser contexts keyed by session_id
- Current page tracking per session
- Session expiry/cleanup
- Connection pooling
