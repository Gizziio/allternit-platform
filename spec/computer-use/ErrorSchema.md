# Error Schema Specification

Version: 1.0  
Status: Active

---

## Overview

This document defines standard error codes and response formats for A2R Computer Use Gateway.

All errors must be normalized to ensure consistent handling between Python gateway and TypeScript GIZZI runtime.

---

## Error Categories

### 1. Validation Errors (HTTP 400)

Client provided invalid request parameters.

| Code | Message | Condition |
|------|---------|-----------|
| `MISSING_ACTION` | "action is required" | No action field |
| `MISSING_SESSION_ID` | "session_id is required" | No session_id |
| `MISSING_RUN_ID` | "run_id is required" | No run_id |
| `INVALID_ACTION` | "action {X} is not valid" | Unknown action |
| `MISSING_TARGET` | "target is required for {action}" | Action needs target |
| `MISSING_GOAL` | "goal is required for execute" | Execute without goal |
| `MISSING_TEXT` | "parameters.text is required for fill" | Fill without text |
| `INVALID_SELECTOR` | "selector is invalid: {reason}" | Malformed CSS selector |
| `INVALID_URL` | "target is not a valid URL: {url}" | Malformed URL |

**Response Format (400):**
```json
{
  "detail": "target is required for goto"
}
```

---

### 2. Session Errors (HTTP 500)

Session management failures.

| Code | Message | Condition |
|------|---------|-----------|
| `SESSION_NOT_FOUND` | "No active session for {session_id}" | Action requires session, none exists |
| `SESSION_EXPIRED` | "Session {session_id} has expired" | Session idle timeout |
| `SESSION_LIMIT_REACHED` | "Maximum sessions ({max}) reached" | Too many active sessions |
| `SESSION_CREATE_FAILED` | "Failed to create browser session" | Playwright launch failed |
| `PAGE_CLOSED` | "Current page was closed" | Page crashed or closed |

**Response Format (ExecuteResponse with status: failed):**
```json
{
  "status": "failed",
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No active session for sess_abc123. Use 'goto' first."
  },
  "receipts": [{
    "action": "screenshot",
    "timestamp": "2026-03-14T12:00:00Z",
    "success": false,
    "details": {"session_id": "sess_abc123"}
  }]
}
```

---

### 3. Navigation Errors (HTTP 500)

Page navigation failures.

| Code | Message | Condition |
|------|---------|-----------|
| `NAVIGATION_ERROR` | "Failed to navigate to {url}" | Generic navigation failure |
| `NAVIGATION_TIMEOUT` | "Navigation to {url} timed out" | Timeout during navigation |
| `DNS_ERROR` | "Could not resolve {hostname}" | DNS lookup failed |
| `CONNECTION_ERROR` | "Could not connect to {hostname}" | Connection refused/reset |
| `SSL_ERROR` | "SSL certificate error for {hostname}" | TLS handshake failed |
| `HTTP_ERROR` | "HTTP {status} from {url}" | 4xx/5xx response |
| `ABORTED_NAVIGATION` | "Navigation was aborted" | Page closed during navigation |

**Response Format:**
```json
{
  "status": "failed",
  "error": {
    "code": "NAVIGATION_ERROR",
    "message": "net::ERR_NAME_NOT_RESOLVED at https://invalid.example/"
  },
  "receipts": [{
    "action": "goto",
    "success": false,
    "details": {
      "target": "https://invalid.example/",
      "error": "net::ERR_NAME_NOT_RESOLVED"
    }
  }]
}
```

---

### 4. Selector Errors (HTTP 500)

Element selection/interaction failures.

| Code | Message | Condition |
|------|---------|-----------|
| `SELECTOR_NOT_FOUND` | "Element not found: {selector}" | Timeout waiting for element |
| `SELECTOR_INVALID` | "Invalid CSS selector: {selector}" | Malformed selector syntax |
| `SELECTOR_AMBIGUOUS` | "Multiple elements match: {selector}" | Selector matches >1 element |
| `ELEMENT_NOT_VISIBLE` | "Element exists but not visible" | Element hidden |
| `ELEMENT_NOT_INTERACTABLE` | "Element cannot be interacted with" | Disabled or obscured |

**Response Format:**
```json
{
  "status": "failed",
  "error": {
    "code": "SELECTOR_NOT_FOUND",
    "message": "Timeout 5000ms exceeded for selector: #nonexistent"
  },
  "receipts": [{
    "action": "click",
    "success": false,
    "details": {
      "selector": "#nonexistent",
      "timeout": 5000
    }
  }]
}
```

---

### 5. Action Errors (HTTP 500)

Specific action execution failures.

| Code | Message | Condition |
|------|---------|-----------|
| `CLICK_ERROR` | "Failed to click element" | Click failed after found |
| `FILL_ERROR` | "Failed to fill element" | Fill failed after found |
| `SCREENSHOT_ERROR` | "Failed to capture screenshot" | Screenshot failed |
| `EXTRACT_ERROR` | "Failed to extract content" | Extraction failed |
| `INSPECT_ERROR` | "Failed to inspect page" | Inspection failed |
| `DOWNLOAD_ERROR` | "Failed to download file" | Download failed |
| `UPLOAD_ERROR` | "Failed to upload file" | Upload failed |

---

### 6. Timeout Errors (HTTP 500)

Action exceeded time limit.

| Code | Message | Condition |
|------|---------|-----------|
| `TIMEOUT` | "Action timed out after {ms}ms" | Generic timeout |
| `NAVIGATION_TIMEOUT` | "Navigation timed out" | Page load timeout |
| `SELECTOR_TIMEOUT` | "Waiting for element timed out" | Element wait timeout |
| `DOWNLOAD_TIMEOUT` | "Download timed out" | File download timeout |

---

### 7. Adapter Errors (HTTP 500)

Adapter-level failures.

| Code | Message | Condition |
|------|---------|-----------|
| `ADAPTER_ERROR` | "Browser adapter failed" | Generic adapter failure |
| `ADAPTER_NOT_FOUND` | "Adapter {name} not available" | Requested adapter missing |
| `ADAPTER_INIT_FAILED` | "Failed to initialize {adapter}" | Adapter startup failed |
| `BROWSER_CRASHED` | "Browser process crashed" | Chromium crashed |
| `BROWSER_DISCONNECTED` | "Browser connection lost" | WebSocket/CDP disconnected |

---

### 8. Resource Errors (HTTP 500)

Resource limitation failures.

| Code | Message | Condition |
|------|---------|-----------|
| `MEMORY_EXCEEDED` | "Browser memory limit exceeded" | OOM in browser |
| `DISK_FULL` | "Insufficient disk space for artifact" | Cannot save file |
| `ARTIFACT_TOO_LARGE` | "Artifact exceeds size limit" | Screenshot/download too big |

---

## Error Response Schema

All runtime errors return `ExecuteResponse` with `status: "failed"`:

```typescript
interface ErrorResponse {
  run_id: string;           // Echo of request
  session_id: string;       // Echo of request
  adapter_id: string;       // Which adapter was running
  family: "browser" | "desktop" | "retrieval" | "hybrid";
  mode: "assist" | "execute" | "inspect" | ...;
  status: "failed";         // Always "failed"
  summary: string;          // Human-readable summary
  error: {
    code: string;           // Machine-readable code
    message: string;        // Human-readable message
  };
  artifacts: [];            // Empty on error
  receipts: [{
    action: string;
    timestamp: string;
    success: false;         // Always false
    details: {
      error?: string;
      [key: string]: any;
    };
  }];
  trace_id: string;         // For debugging
}
```

---

## Error Mapping Strategy

### Playwright Errors → Our Codes

| Playwright Error | Our Code |
|------------------|----------|
| `TimeoutError` | `SELECTOR_TIMEOUT` or `NAVIGATION_TIMEOUT` |
| `Error: net::ERR_NAME_NOT_RESOLVED` | `DNS_ERROR` |
| `Error: net::ERR_CONNECTION_REFUSED` | `CONNECTION_ERROR` |
| `Error: net::ERR_SSL_PROTOCOL_ERROR` | `SSL_ERROR` |
| `Error: net::ERR_ABORTED` | `ABORTED_NAVIGATION` |
| `Error: page.goto: Navigation failed` | `NAVIGATION_ERROR` |
| `Error: Element is not attached to the DOM` | `ELEMENT_NOT_INTERACTABLE` |
| `Error: Target closed` | `BROWSER_DISCONNECTED` |

### Python Exceptions → Our Codes

| Python Exception | Our Code |
|------------------|----------|
| `KeyError` on session | `SESSION_NOT_FOUND` |
| `asyncio.TimeoutError` | `TIMEOUT` |
| `OSError` (disk) | `DISK_FULL` |
| Generic `Exception` | `ADAPTER_ERROR` |

---

## GIZZI Integration

### Error Display

In GIZZI, errors should display as:

```
❌ Browser action failed: {summary}

Error: {error.code}
{error.message}

Receipt:
- Action: {receipt.action}
- Time: {receipt.timestamp}
- Status: Failed
```

### Retry Policy

Some errors are retryable:

| Code | Retryable? | Strategy |
|------|------------|----------|
| `TIMEOUT` | Yes | Retry once with longer timeout |
| `NAVIGATION_TIMEOUT` | Yes | Retry once |
| `BROWSER_DISCONNECTED` | Yes | Reconnect and retry |
| `DNS_ERROR` | No | Permanent failure |
| `SSL_ERROR` | No | Permanent failure |
| `SELECTOR_NOT_FOUND` | No | Permanent failure |

---

## Implementation Notes

### Gateway Implementation

```python
def map_playwright_error(error: Exception) -> ErrorDetail:
    """Map Playwright error to standard error code."""
    message = str(error)
    
    if "ERR_NAME_NOT_RESOLVED" in message:
        return ErrorDetail(code="DNS_ERROR", message=message)
    elif "ERR_CONNECTION_REFUSED" in message:
        return ErrorDetail(code="CONNECTION_ERROR", message=message)
    elif "Timeout" in message:
        return ErrorDetail(code="TIMEOUT", message=message)
    elif "Target closed" in message:
        return ErrorDetail(code="BROWSER_DISCONNECTED", message=message)
    else:
        return ErrorDetail(code="ADAPTER_ERROR", message=message)
```

### GIZZI Implementation

```typescript
function normalizeError(envelope: ComputerUseResponse): string {
  if (envelope.status === "failed" && envelope.error) {
    const { code, message } = envelope.error
    
    switch (code) {
      case "SELECTOR_NOT_FOUND":
        return `Element not found: ${message}`
      case "NAVIGATION_ERROR":
        return `Failed to load page: ${message}`
      case "TIMEOUT":
        return `Action timed out: ${message}`
      default:
        return `Browser error (${code}): ${message}`
    }
  }
  return "Unknown error"
}
```

---

## Testing Errors

Test cases should verify:

1. **Validation errors return 400**
2. **Runtime errors return 200 with status: failed**
3. **All errors have code and message**
4. **Receipts indicate failure**
5. **Trace_id present for debugging**
6. **Error messages are human-readable**
