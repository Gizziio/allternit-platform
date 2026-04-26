# IO_BRIDGE_CONTRACT.md
**IO Transport Protocol for Allternit**
_version 2.0 — replaces BRIDGE_CONTRACT_V2.md_

---

## 0. Purpose

This document defines the **transport protocol** between Shell and IO.

It is NOT:
- A planning layer
- A domain-specific API
- A "brain"

It IS:
- A message pipe
- An execution request channel
- An event stream

---

## 1. Transport Layer

| Property | Value |
|----------|-------|
| Protocol | NDJSON over stdio |
| Direction | Bidirectional |
| Encoding | UTF-8 |
| Delimiter | Newline (`\n`) |

---

## 2. Message Types

### 2.1 Request (Shell → IO)

```typescript
interface IORequest {
  id: string;              // Unique request ID
  method: string;          // Namespaced method
  params?: object;         // Method parameters
}
```

### 2.2 Response (IO → Shell)

```typescript
interface IOResponse {
  id: string;              // Matches request ID
  result?: unknown;        // Success payload
  error?: IOError;         // Error payload
}

interface IOError {
  code: string;
  message: string;
  data?: unknown;
}
```

### 2.3 Event (IO → Shell, unsolicited)

```typescript
interface IOEvent {
  event: string;           // Event type
  data: unknown;           // Payload
  ts: string;              // ISO 8601 timestamp
}
```

---

## 3. Core Methods

### 3.1 Lifecycle

| Method | Description |
|--------|-------------|
| `io.ping` | Health check |
| `io.status` | Get IO state |
| `io.shutdown` | Graceful shutdown |

### 3.2 Skill Invocation

| Method | Description |
|--------|-------------|
| `skill.list` | List available skills |
| `skill.invoke` | Execute a skill |
| `skill.cancel` | Cancel running skill |

### 3.3 State Queries

| Method | Description |
|--------|-------------|
| `capsule.get` | Get capsule by ID |
| `capsule.list` | List capsules |
| `journal.tail` | Get recent journal entries |
| `artifact.get` | Get artifact by ID |

### 3.4 Intent Dispatch

| Method | Description |
|--------|-------------|
| `intent.dispatch` | Submit intent to Kernel |

---

## 4. Method Definitions

### 4.1 io.ping

**Request**
```json
{"id":"1","method":"io.ping","params":{}}
```

**Response**
```json
{"id":"1","result":"pong"}
```

---

### 4.2 io.status

**Request**
```json
{"id":"2","method":"io.status","params":{}}
```

**Response**
```json
{
  "id":"2",
  "result":{
    "version": "1.0.0",
    "uptime_seconds": 3600,
    "active_capsules": 5,
    "skills_available": ["search","summarize","gui.observe","gui.execute"],
    "journal_entries_today": 250
  }
}
```

---

### 4.3 skill.invoke

The **primary** way to cause side effects.

**Request**
```json
{
  "id":"3",
  "method":"skill.invoke",
  "params":{
    "skill": "search.web",
    "input": {"query": "best pizza NYC"},
    "capsule_id": "cap_123"
  }
}
```

**Response**
```json
{
  "id":"3",
  "result":{
    "skill": "search.web",
    "status": "success",
    "output": {"results": [...]},
    "artifacts": ["art_001"],
    "journal_event_id": "evt_456"
  }
}
```

---

### 4.4 intent.dispatch

Submit user intent to Kernel for routing.

**Request**
```json
{
  "id":"4",
  "method":"intent.dispatch",
  "params":{
    "type": "search",
    "goal": "Find restaurants nearby",
    "context": {}
  }
}
```

**Response**
```json
{
  "id":"4",
  "result":{
    "capsule_id": "cap_789",
    "status": "accepted",
    "run_id": "run_abc"
  }
}
```

---

### 4.5 capsule.get

**Request**
```json
{"id":"5","method":"capsule.get","params":{"capsule_id":"cap_789"}}
```

**Response**
```json
{
  "id":"5",
  "result":{
    "capsule_id": "cap_789",
    "goal": "Find restaurants nearby",
    "status": "active",
    "evidence_ids": ["ev_1","ev_2"],
    "data_model": {...},
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4.6 journal.tail

**Request**
```json
{
  "id":"6",
  "method":"journal.tail",
  "params":{
    "limit": 50,
    "since": "2024-01-15T10:00:00Z"
  }
}
```

**Response**
```json
{
  "id":"6",
  "result":{
    "entries": [
      {"event_id":"evt_001","event_type":"skill.invoked","ts":"..."},
      {"event_id":"evt_002","event_type":"capsule.updated","ts":"..."}
    ],
    "has_more": false
  }
}
```

---

## 5. Events

IO pushes events without requests.

### 5.1 Event Types

| Event | Description |
|-------|-------------|
| `io.ready` | IO initialization complete |
| `skill.started` | Skill execution began |
| `skill.progress` | Skill progress update |
| `skill.completed` | Skill execution finished |
| `capsule.updated` | Capsule state changed |
| `journal.entry` | New journal entry |
| `presence.state` | Gizzi presence state change |

### 5.2 Event Format

```json
{
  "event": "skill.completed",
  "data": {
    "skill": "search.web",
    "capsule_id": "cap_123",
    "status": "success"
  },
  "ts": "2024-01-15T10:31:00Z"
}
```

---

## 6. Skills as Domain Methods

**Important:** Domain-specific operations are skills, not bridge primitives.

Instead of:
```
gui.screenshot.capture
gui.action.execute
gui.perceive_and_act
```

Use:
```
skill.invoke("gui.observe", {...})
skill.invoke("gui.execute", {...})
skill.invoke("model.ui_tars.propose", {...})
```

This keeps the bridge clean and the skill registry authoritative.

---

## 7. Readiness Protocol

On startup, IO emits exactly once:

```
IO_READY {"protocol":"io-bridge-v2","version":"1.0.0","skills":["search","gui.observe",...]}
```

Shell waits for this before sending requests.

---

## 8. Error Codes

| Code | Description |
|------|-------------|
| `ERR_INVALID_REQUEST` | Malformed request |
| `ERR_METHOD_NOT_FOUND` | Unknown method |
| `ERR_SKILL_NOT_FOUND` | Unknown skill |
| `ERR_SKILL_FAILED` | Skill execution failed |
| `ERR_POLICY_DENIED` | Action blocked by policy |
| `ERR_TIMEOUT` | Request timed out |

---

## 9. Implementation (Rust Skeleton)

```rust
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct IORequest {
    id: String,
    method: String,
    params: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct IOResponse {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<IOError>,
}

async fn dispatch(req: IORequest) -> IOResponse {
    match req.method.as_str() {
        "io.ping" => IOResponse {
            id: req.id,
            result: Some(json!("pong")),
            error: None,
        },
        "skill.invoke" => handle_skill_invoke(req).await,
        "intent.dispatch" => handle_intent_dispatch(req).await,
        "capsule.get" => handle_capsule_get(req).await,
        "journal.tail" => handle_journal_tail(req).await,
        _ => IOResponse {
            id: req.id,
            result: None,
            error: Some(IOError {
                code: "ERR_METHOD_NOT_FOUND".into(),
                message: format!("Unknown: {}", req.method),
                data: None,
            }),
        },
    }
}
```

---

## 10. TypeScript Client

```typescript
class IOBridge {
  private pending = new Map<string, { resolve: Function; reject: Function }>();

  async request(method: string, params?: object): Promise<unknown> {
    const id = crypto.randomUUID();
    const req: IORequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send(JSON.stringify(req) + "\n");
    });
  }

  // Convenience methods
  ping = () => this.request("io.ping");
  status = () => this.request("io.status");
  invokeSkill = (skill: string, input: object, capsuleId?: string) =>
    this.request("skill.invoke", { skill, input, capsule_id: capsuleId });
  dispatchIntent = (type: string, goal: string) =>
    this.request("intent.dispatch", { type, goal });
  getCapsule = (id: string) => this.request("capsule.get", { capsule_id: id });
  tailJournal = (limit?: number, since?: string) =>
    this.request("journal.tail", { limit, since });
}
```

---

## 11. Status

This document is **implementation-ready**.

Conforms to: ONTOLOGY_LAW.md

Key principle: **The bridge is a pipe, not a brain.**
