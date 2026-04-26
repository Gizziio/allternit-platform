# BRIDGE_CONTRACT_V2.md
**Extended Allternit stdio-RPC Bridge Contract with GUI Support**
_version 2.0 — extends WEBVM_BOOT_AND_BRIDGE_CONTRACT.md_

---

## 0. Purpose

This document extends the original bridge contract to include:
- GUI perception and action methods
- Screenshot management
- Artifact streaming
- Session management
- Health monitoring

This is a **superset** of v1.0 — all original methods remain valid.

---

## 1. Transport Layer (Unchanged)

- **Protocol**: NDJSON over stdio
- **Direction**: Bidirectional (UI ↔ Runner)
- **Encoding**: UTF-8
- **Delimiter**: Newline (`\n`)

---

## 2. Message Format

### 2.1 Request

```typescript
interface BridgeRequest {
  id: string;              // Unique request ID
  method: string;          // Method name (dotted namespace)
  params: object;          // Method-specific parameters
  meta?: {                 // Optional metadata
    timestamp?: string;    // ISO 8601
    timeout_ms?: number;   // Request timeout
    priority?: "normal" | "high" | "urgent";
  };
}
```

### 2.2 Response

```typescript
interface BridgeResponse {
  id: string;              // Matches request ID
  result?: unknown;        // Success payload
  error?: BridgeError;     // Error payload (mutually exclusive with result)
  meta?: {
    duration_ms?: number;  // Processing time
    runner_version?: string;
  };
}

interface BridgeError {
  code: string;            // Error code (e.g., "ERR_NOT_FOUND")
  message: string;         // Human-readable message
  data?: unknown;          // Additional error context
}
```

### 2.3 Server-Push Events

Runner can push events without a request:

```typescript
interface BridgeEvent {
  event: string;           // Event type
  data: unknown;           // Event payload
  timestamp: string;       // ISO 8601
}
```

---

## 3. Namespaces

| Namespace | Description |
|-----------|-------------|
| `runner.*` | Runner lifecycle and health |
| `intent.*` | Intent dispatch and tracking |
| `capsule.*` | Capsule CRUD operations |
| `journal.*` | Journal queries |
| `skill.*` | Skill invocation |
| `gui.*` | **NEW** GUI perception and actions |
| `artifact.*` | **NEW** Artifact management |
| `session.*` | **NEW** Session management |

---

## 4. Core Methods (v1.0)

### 4.1 runner.ping

Health check.

**Request**
```json
{"id":"1","method":"runner.ping","params":{}}
```

**Response**
```json
{"id":"1","result":"pong"}
```

### 4.2 intent.dispatch

Dispatch an intent to the kernel.

**Request**
```json
{
  "id":"2",
  "method":"intent.dispatch",
  "params":{
    "intent_type": "search",
    "goal": "Find restaurants nearby",
    "context": {}
  }
}
```

**Response**
```json
{
  "id":"2",
  "result":{
    "capsule_id": "cap_abc123",
    "status": "accepted",
    "run_id": "run_xyz789"
  }
}
```

### 4.3 capsule.get

Retrieve capsule state.

**Request**
```json
{"id":"3","method":"capsule.get","params":{"capsule_id":"cap_abc123"}}
```

**Response**
```json
{
  "id":"3",
  "result":{
    "capsule_id": "cap_abc123",
    "goal": "Find restaurants nearby",
    "status": "active",
    "evidence_ids": ["ev_1", "ev_2"],
    "current_data_model": {...},
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### 4.4 journal.tail

Get recent journal entries.

**Request**
```json
{
  "id":"4",
  "method":"journal.tail",
  "params":{
    "run_id": "run_xyz789",
    "limit": 50,
    "since": "2024-01-15T10:00:00Z"
  }
}
```

**Response**
```json
{
  "id":"4",
  "result":{
    "entries": [
      {
        "event_id": "evt_001",
        "timestamp": "2024-01-15T10:30:01Z",
        "event_type": "intent.received",
        "payload_hash": "abc123..."
      }
    ],
    "has_more": false
  }
}
```

### 4.5 skill.invoke

Invoke a registered skill.

**Request**
```json
{
  "id":"5",
  "method":"skill.invoke",
  "params":{
    "skill_id": "web_search",
    "input": {"query": "best pizza NYC"},
    "capsule_id": "cap_abc123"
  }
}
```

**Response**
```json
{
  "id":"5",
  "result":{
    "skill_id": "web_search",
    "status": "success",
    "output": {...},
    "artifacts": ["art_001"],
    "duration_ms": 1523
  }
}
```

---

## 5. GUI Methods (v2.0 NEW)

### 5.1 gui.screenshot.capture

Capture current screen state.

**Request**
```json
{
  "id":"g1",
  "method":"gui.screenshot.capture",
  "params":{
    "format": "png",
    "scale": 1.0,
    "region": null
  }
}
```

**Response**
```json
{
  "id":"g1",
  "result":{
    "screenshot_id": "ss_abc123",
    "width": 1024,
    "height": 768,
    "format": "png",
    "artifact_path": "/var/gizzi/artifacts/screenshots/ss_abc123.png",
    "data_uri": "data:image/png;base64,iVBORw0KGgo...",
    "timestamp": "2024-01-15T10:31:00Z"
  }
}
```

### 5.2 gui.screenshot.perceive

Run UI-TARS perception on a screenshot.

**Request**
```json
{
  "id":"g2",
  "method":"gui.screenshot.perceive",
  "params":{
    "screenshot_id": "ss_abc123",
    "task": "Find the login button",
    "mode": "grounding",
    "include_elements": true
  }
}
```

**Response**
```json
{
  "id":"g2",
  "result":{
    "screenshot_id": "ss_abc123",
    "perception": {
      "target": {
        "description": "Login button in top-right corner",
        "coordinates": {"x": 920, "y": 45},
        "bounds": {"x": 880, "y": 30, "width": 80, "height": 30},
        "confidence": 0.94
      },
      "elements": [
        {"type": "button", "text": "Login", "bounds": {...}},
        {"type": "button", "text": "Sign Up", "bounds": {...}},
        {"type": "input", "placeholder": "Search", "bounds": {...}}
      ],
      "screen_description": "Website homepage with navigation bar"
    },
    "model": "ui-tars-1.5-7b",
    "inference_ms": 1850
  }
}
```

### 5.3 gui.action.execute

Execute a GUI action.

**Request**
```json
{
  "id":"g3",
  "method":"gui.action.execute",
  "params":{
    "action_type": "click",
    "parameters": {
      "x": 920,
      "y": 45
    },
    "capsule_id": "cap_abc123",
    "capture_before": true,
    "capture_after": true,
    "reasoning": "Click login button to access account"
  }
}
```

**Response**
```json
{
  "id":"g3",
  "result":{
    "action_id": "act_xyz789",
    "status": "success",
    "action_type": "click",
    "coordinates": {"x": 920, "y": 45},
    "screenshot_before": "ss_before_001",
    "screenshot_after": "ss_after_001",
    "executed_at": "2024-01-15T10:31:05Z",
    "journal_event_id": "evt_gui_001"
  }
}
```

### 5.4 gui.action.batch

Execute multiple actions in sequence.

**Request**
```json
{
  "id":"g4",
  "method":"gui.action.batch",
  "params":{
    "actions": [
      {"type": "click", "params": {"x": 500, "y": 300}},
      {"type": "wait", "params": {"ms": 500}},
      {"type": "type", "params": {"text": "admin@example.com"}},
      {"type": "hotkey", "params": {"keys": ["tab"]}},
      {"type": "type", "params": {"text": "password123"}}
    ],
    "capsule_id": "cap_abc123",
    "stop_on_error": true
  }
}
```

**Response**
```json
{
  "id":"g4",
  "result":{
    "batch_id": "batch_001",
    "status": "success",
    "actions_executed": 5,
    "actions_total": 5,
    "results": [
      {"index": 0, "status": "success", "action_id": "act_001"},
      {"index": 1, "status": "success", "action_id": "act_002"},
      {"index": 2, "status": "success", "action_id": "act_003"},
      {"index": 3, "status": "success", "action_id": "act_004"},
      {"index": 4, "status": "success", "action_id": "act_005"}
    ],
    "screenshot_final": "ss_final_001",
    "total_duration_ms": 2350
  }
}
```

### 5.5 gui.perceive_and_act

Combined perception + action in one call.

**Request**
```json
{
  "id":"g5",
  "method":"gui.perceive_and_act",
  "params":{
    "task": "Click the Submit button",
    "capsule_id": "cap_abc123",
    "max_actions": 1,
    "confidence_threshold": 0.7
  }
}
```

**Response**
```json
{
  "id":"g5",
  "result":{
    "perception": {
      "target": "Submit button",
      "coordinates": {"x": 450, "y": 320},
      "confidence": 0.92
    },
    "action": {
      "action_id": "act_auto_001",
      "type": "click",
      "coordinates": {"x": 450, "y": 320},
      "status": "success"
    },
    "reasoning": "Located Submit button in form area, executing click",
    "screenshot_before": "ss_pb_001",
    "screenshot_after": "ss_pa_001"
  }
}
```

### 5.6 gui.task.execute

Execute a multi-step GUI task with autonomous reasoning.

**Request**
```json
{
  "id":"g6",
  "method":"gui.task.execute",
  "params":{
    "task": "Log in with username 'admin' and password 'secret'",
    "capsule_id": "cap_abc123",
    "max_steps": 10,
    "timeout_ms": 60000,
    "checkpoint_interval": 3
  }
}
```

**Response**
```json
{
  "id":"g6",
  "result":{
    "task_id": "task_login_001",
    "status": "success",
    "steps_executed": 6,
    "steps": [
      {"step": 1, "action": "click", "target": "username field", "status": "success"},
      {"step": 2, "action": "type", "text": "admin", "status": "success"},
      {"step": 3, "action": "click", "target": "password field", "status": "success"},
      {"step": 4, "action": "type", "text": "******", "status": "success"},
      {"step": 5, "action": "click", "target": "login button", "status": "success"},
      {"step": 6, "action": "wait", "reason": "page load", "status": "success"}
    ],
    "checkpoints": ["cp_001", "cp_002"],
    "final_screenshot": "ss_task_final",
    "total_duration_ms": 8540
  }
}
```

### 5.7 gui.element.find

Find UI element by description.

**Request**
```json
{
  "id":"g7",
  "method":"gui.element.find",
  "params":{
    "description": "the red 'Delete' button",
    "screenshot_id": "ss_abc123"
  }
}
```

**Response**
```json
{
  "id":"g7",
  "result":{
    "found": true,
    "element": {
      "description": "Red button labeled 'Delete'",
      "type": "button",
      "text": "Delete",
      "coordinates": {"x": 750, "y": 400},
      "bounds": {"x": 700, "y": 385, "width": 100, "height": 30},
      "confidence": 0.89
    },
    "alternatives": [
      {"description": "Gray 'Cancel' button", "coordinates": {"x": 600, "y": 400}}
    ]
  }
}
```

### 5.8 gui.checkpoint.create

Create a rollback checkpoint.

**Request**
```json
{
  "id":"g8",
  "method":"gui.checkpoint.create",
  "params":{
    "capsule_id": "cap_abc123",
    "label": "before_form_submit"
  }
}
```

**Response**
```json
{
  "id":"g8",
  "result":{
    "checkpoint_id": "cp_form_001",
    "screenshot_id": "ss_cp_001",
    "timestamp": "2024-01-15T10:32:00Z",
    "label": "before_form_submit"
  }
}
```

### 5.9 gui.checkpoint.restore

Restore to a checkpoint (informational only — full VM restore not supported).

**Request**
```json
{
  "id":"g9",
  "method":"gui.checkpoint.restore",
  "params":{
    "checkpoint_id": "cp_form_001"
  }
}
```

**Response**
```json
{
  "id":"g9",
  "result":{
    "checkpoint_id": "cp_form_001",
    "status": "info_only",
    "message": "Full VM restore not supported. Checkpoint screenshot available.",
    "screenshot_id": "ss_cp_001",
    "suggested_actions": [
      "Press browser back button",
      "Refresh the page",
      "Navigate to previous URL"
    ]
  }
}
```

---

## 6. Artifact Methods (v2.0 NEW)

### 6.1 artifact.get

Retrieve artifact by ID.

**Request**
```json
{
  "id":"a1",
  "method":"artifact.get",
  "params":{
    "artifact_id": "art_001",
    "include_data": true
  }
}
```

**Response**
```json
{
  "id":"a1",
  "result":{
    "artifact_id": "art_001",
    "type": "screenshot",
    "mime_type": "image/png",
    "size_bytes": 145823,
    "path": "/var/gizzi/artifacts/screenshots/art_001.png",
    "data_uri": "data:image/png;base64,...",
    "metadata": {
      "width": 1024,
      "height": 768,
      "captured_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 6.2 artifact.list

List artifacts by filter.

**Request**
```json
{
  "id":"a2",
  "method":"artifact.list",
  "params":{
    "capsule_id": "cap_abc123",
    "type": "screenshot",
    "since": "2024-01-15T10:00:00Z",
    "limit": 20
  }
}
```

**Response**
```json
{
  "id":"a2",
  "result":{
    "artifacts": [
      {"artifact_id": "art_001", "type": "screenshot", "created_at": "..."},
      {"artifact_id": "art_002", "type": "screenshot", "created_at": "..."}
    ],
    "total": 2,
    "has_more": false
  }
}
```

### 6.3 artifact.stream

Stream artifact data (for large files).

**Request**
```json
{
  "id":"a3",
  "method":"artifact.stream",
  "params":{
    "artifact_id": "art_large_001",
    "chunk_size": 65536,
    "offset": 0
  }
}
```

**Response** (chunked)
```json
{
  "id":"a3",
  "result":{
    "artifact_id": "art_large_001",
    "chunk_index": 0,
    "total_chunks": 10,
    "data": "base64_chunk_data...",
    "is_final": false
  }
}
```

---

## 7. Session Methods (v2.0 NEW)

### 7.1 session.start

Initialize a GUI session.

**Request**
```json
{
  "id":"s1",
  "method":"session.start",
  "params":{
    "display": ":0",
    "resolution": "1024x768",
    "color_depth": 24
  }
}
```

**Response**
```json
{
  "id":"s1",
  "result":{
    "session_id": "sess_001",
    "display": ":0",
    "resolution": {"width": 1024, "height": 768},
    "started_at": "2024-01-15T10:30:00Z"
  }
}
```

### 7.2 session.status

Get session status.

**Request**
```json
{"id":"s2","method":"session.status","params":{}}
```

**Response**
```json
{
  "id":"s2",
  "result":{
    "session_id": "sess_001",
    "status": "active",
    "display": ":0",
    "resolution": {"width": 1024, "height": 768},
    "uptime_seconds": 3600,
    "actions_executed": 150,
    "screenshots_captured": 45
  }
}
```

### 7.3 session.end

End the GUI session.

**Request**
```json
{"id":"s3","method":"session.end","params":{"session_id":"sess_001"}}
```

**Response**
```json
{
  "id":"s3",
  "result":{
    "session_id": "sess_001",
    "status": "ended",
    "ended_at": "2024-01-15T11:30:00Z",
    "summary": {
      "duration_seconds": 3600,
      "actions_executed": 150,
      "screenshots_captured": 45,
      "capsules_interacted": 3
    }
  }
}
```

---

## 8. Runner Methods (Extended)

### 8.1 runner.status

Get detailed runner status.

**Request**
```json
{"id":"r1","method":"runner.status","params":{}}
```

**Response**
```json
{
  "id":"r1",
  "result":{
    "version": "1.0.0",
    "status": "healthy",
    "uptime_seconds": 7200,
    "memory_mb": 256,
    "active_capsules": 5,
    "skills_loaded": ["web_search", "gui_agent", "note"],
    "gui_session": {
      "active": true,
      "session_id": "sess_001"
    },
    "journal": {
      "entries_today": 1250,
      "current_run_id": "run_xyz789"
    }
  }
}
```

### 8.2 runner.config

Get/set runner configuration.

**Request** (get)
```json
{"id":"r2","method":"runner.config","params":{"action":"get"}}
```

**Response**
```json
{
  "id":"r2",
  "result":{
    "config": {
      "gui_enabled": true,
      "max_actions_per_minute": 300,
      "screenshot_retention_hours": 24,
      "inference_backend": "browser"
    }
  }
}
```

**Request** (set)
```json
{
  "id":"r3",
  "method":"runner.config",
  "params":{
    "action":"set",
    "key":"max_actions_per_minute",
    "value": 500
  }
}
```

---

## 9. Server-Push Events

### 9.1 Event Types

| Event | Description |
|-------|-------------|
| `runner.ready` | Runner initialization complete |
| `capsule.updated` | Capsule state changed |
| `journal.entry` | New journal entry |
| `gui.action.completed` | GUI action finished |
| `gui.task.progress` | Multi-step task progress |
| `gui.error` | GUI error occurred |
| `skill.progress` | Long-running skill progress |

### 9.2 Event Format

```json
{
  "event": "gui.action.completed",
  "data": {
    "action_id": "act_xyz789",
    "action_type": "click",
    "status": "success",
    "capsule_id": "cap_abc123"
  },
  "timestamp": "2024-01-15T10:31:05Z"
}
```

### 9.3 Subscribing to Events

Events are automatically pushed when relevant. No subscription needed.

To filter events on the UI side:

```typescript
class EventFilter {
  private handlers: Map<string, ((data: unknown) => void)[]> = new Map();

  on(eventType: string, handler: (data: unknown) => void): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  dispatch(event: BridgeEvent): void {
    const handlers = this.handlers.get(event.event) || [];
    handlers.forEach(h => h(event.data));

    // Wildcard handlers
    const wildcardHandlers = this.handlers.get("*") || [];
    wildcardHandlers.forEach(h => h(event));
  }
}
```

---

## 10. Error Codes

### 10.1 General Errors

| Code | Description |
|------|-------------|
| `ERR_INVALID_REQUEST` | Malformed request |
| `ERR_METHOD_NOT_FOUND` | Unknown method |
| `ERR_INVALID_PARAMS` | Invalid parameters |
| `ERR_INTERNAL` | Internal runner error |
| `ERR_TIMEOUT` | Request timed out |

### 10.2 Capsule Errors

| Code | Description |
|------|-------------|
| `ERR_CAPSULE_NOT_FOUND` | Capsule ID not found |
| `ERR_CAPSULE_LOCKED` | Capsule is locked for editing |
| `ERR_CAPSULE_ARCHIVED` | Capsule is archived |

### 10.3 GUI Errors

| Code | Description |
|------|-------------|
| `ERR_GUI_NOT_ENABLED` | GUI session not active |
| `ERR_GUI_SCREENSHOT_FAILED` | Screenshot capture failed |
| `ERR_GUI_ACTION_BLOCKED` | Action blocked by policy |
| `ERR_GUI_RATE_LIMITED` | Too many actions |
| `ERR_GUI_COORDINATES_OOB` | Coordinates out of bounds |
| `ERR_GUI_INFERENCE_FAILED` | UI-TARS inference failed |
| `ERR_GUI_LOW_CONFIDENCE` | Action confidence too low |

### 10.4 Skill Errors

| Code | Description |
|------|-------------|
| `ERR_SKILL_NOT_FOUND` | Skill ID not found |
| `ERR_SKILL_DISABLED` | Skill is disabled |
| `ERR_SKILL_FAILED` | Skill execution failed |
| `ERR_SKILL_TIMEOUT` | Skill timed out |

---

## 11. Rate Limits

| Resource | Limit | Window |
|----------|-------|--------|
| GUI actions | 300 | per minute |
| Screenshots | 60 | per minute |
| Skill invocations | 100 | per minute |
| Journal queries | 1000 | per minute |

Rate limit response:

```json
{
  "id":"x",
  "error":{
    "code": "ERR_RATE_LIMITED",
    "message": "Rate limit exceeded for gui.action.execute",
    "data": {
      "limit": 300,
      "window": "1m",
      "retry_after_ms": 5000
    }
  }
}
```

---

## 12. Security Considerations

### 12.1 Action Validation

All GUI actions are validated before execution:
- Coordinates must be within viewport
- Text input is sanitized
- Hotkeys are restricted (no system shortcuts)
- Rate limits are enforced

### 12.2 Sensitive Content Protection

- Password fields are detected and protected
- Credit card inputs trigger warnings
- System settings areas are restricted

### 12.3 Audit Trail

All actions are journaled with:
- Before/after screenshots
- Action parameters
- Execution result
- Capsule context

---

## 13. Implementation Notes

### 13.1 TypeScript Types

```typescript
// Full type definitions for bridge messages

type BridgeMethod =
  // Core
  | "runner.ping"
  | "runner.status"
  | "runner.config"
  | "intent.dispatch"
  | "capsule.get"
  | "capsule.list"
  | "journal.tail"
  | "skill.invoke"
  // GUI
  | "gui.screenshot.capture"
  | "gui.screenshot.perceive"
  | "gui.action.execute"
  | "gui.action.batch"
  | "gui.perceive_and_act"
  | "gui.task.execute"
  | "gui.element.find"
  | "gui.checkpoint.create"
  | "gui.checkpoint.restore"
  // Artifacts
  | "artifact.get"
  | "artifact.list"
  | "artifact.stream"
  // Session
  | "session.start"
  | "session.status"
  | "session.end";

interface MethodParamsMap {
  "runner.ping": {};
  "gui.action.execute": {
    action_type: ActionType;
    parameters: ActionParams;
    capsule_id: string;
    capture_before?: boolean;
    capture_after?: boolean;
    reasoning?: string;
  };
  // ... etc
}
```

### 13.2 Rust Implementation Skeleton

```rust
// runner/src/bridge/mod.rs

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Deserialize)]
struct BridgeRequest {
    id: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Serialize)]
struct BridgeResponse {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<BridgeError>,
}

pub async fn run_bridge(state: Arc<RunnerState>) -> Result<()> {
    let stdin = tokio::io::stdin();
    let mut stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();

    // Emit ready signal
    let ready = serde_json::json!({
        "protocol": "stdio-rpc-v2",
        "runner_version": env!("CARGO_PKG_VERSION"),
        "capabilities": ["gui", "artifacts", "sessions"]
    });
    writeln!(stdout, "RUNNER_READY {}", ready).await?;
    stdout.flush().await?;

    loop {
        line.clear();
        if reader.read_line(&mut line).await? == 0 {
            break; // EOF
        }

        let request: BridgeRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Invalid request: {}", e);
                continue;
            }
        };

        let response = dispatch_method(&state, request).await;
        let response_json = serde_json::to_string(&response)?;
        writeln!(stdout, "{}", response_json).await?;
        stdout.flush().await?;
    }

    Ok(())
}

async fn dispatch_method(
    state: &RunnerState,
    request: BridgeRequest,
) -> BridgeResponse {
    match request.method.as_str() {
        "runner.ping" => BridgeResponse {
            id: request.id,
            result: Some(serde_json::json!("pong")),
            error: None,
        },
        "gui.screenshot.capture" => {
            handle_screenshot_capture(state, request).await
        },
        "gui.action.execute" => {
            handle_gui_action(state, request).await
        },
        // ... other methods
        _ => BridgeResponse {
            id: request.id,
            result: None,
            error: Some(BridgeError {
                code: "ERR_METHOD_NOT_FOUND".into(),
                message: format!("Unknown method: {}", request.method),
                data: None,
            }),
        },
    }
}
```

---

## 14. Status

This document is **implementation-ready** and extends v1.0.

New capabilities in v2.0:
- Full GUI perception and action support
- Artifact management
- Session lifecycle
- Server-push events
- Extended health monitoring

Backward compatible with v1.0 clients.
