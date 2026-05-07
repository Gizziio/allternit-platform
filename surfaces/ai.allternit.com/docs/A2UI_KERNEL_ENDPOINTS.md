# A2UI Kernel Endpoint Requirements

## Overview

The Kernel service (port 3004) needs to implement A2UI-specific endpoints to support agent-generated UI functionality. These endpoints enable the agent to:

1. Generate A2UI payloads from natural language prompts
2. Execute actions requested by the user through A2UI components
3. Stream action progress for long-running operations

## Required Endpoints

### 1. POST /v1/a2ui/generate

Generate an A2UI payload from a natural language prompt.

**Request:**
```json
{
  "chat_id": "string",           // Required: Chat context ID
  "prompt": "string",            // Required: Natural language description
  "context": {
    "dataModel": {},             // Optional: Existing data model
    "currentPayload": {},        // Optional: Current A2UI payload (for updates)
    "chat_history": "string"     // Optional: Kernel session ID for context
  }
}
```

**Response:**
```json
{
  "success": true,
  "agent_id": "string",          // ID of the generating agent
  "payload": {
    "version": "1.0",
    "surfaces": [...],
    "dataModel": {...}
  },
  "message": "string"            // Optional: Explanation of generated UI
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "GENERATION_FAILED",
    "message": "Failed to generate UI"
  }
}
```

**Implementation Notes:**
- The agent should use its LLM capabilities to interpret the prompt
- Generate appropriate component structure based on the request
- Include sensible defaults in the data model
- Return valid A2UI payload structure

---

### 2. POST /v1/a2ui/action

Execute an action triggered by user interaction with A2UI components.

**Request:**
```json
{
  "session_id": "string",        // Required: A2UI session ID
  "action_id": "string",         // Required: Action identifier (e.g., "submit", "delete")
  "payload": {},                 // Optional: Action-specific data
  "data_model": {},              // Required: Current data model state
  "agent_id": "string",          // Optional: Agent that owns the session
  "context": {
    "chat_id": "string",
    "message_id": "string",
    "user_id": "string"
  }
}
```

**Response - Simple Update:**
```json
{
  "success": true,
  "message": "Action completed successfully",
  "data_model_updates": {
    "saved": true,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Response - New Payload:**
```json
{
  "success": true,
  "message": "Navigated to details view",
  "payload": {
    "version": "1.0",
    "surfaces": [...]  // New UI to render
  },
  "data_model_updates": {
    "currentView": "details"
  }
}
```

**Response - Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid form data",
    "field_errors": {
      "email": "Invalid email format"
    }
  }
}
```

**Common Action Patterns:**

| Action ID | Description | Typical Response |
|-----------|-------------|------------------|
| `submit` | Form submission | `data_model_updates` with saved state |
| `cancel` | Cancel operation | May return previous payload or close |
| `delete` | Delete item | Confirmation message, navigation |
| `refresh` | Refresh data | Updated `data_model_updates` |
| `navigate` | Change view | New `payload` with different surface |
| `search` | Search/filter | Updated `data_model_updates` with results |
| `sort` | Sort data | Updated `data_model_updates` with sorted data |

---

### 3. GET /v1/a2ui/actions/stream

Stream action progress for long-running operations via SSE.

**Query Parameters:**
- `session_id` (required): A2UI session ID
- `action_id` (required): Action being executed

**SSE Event Types:**

```
event: action.start
data: {"type": "action.start", "sessionId": "...", "actionId": "...", "timestamp": "..."}

event: action.progress
data: {"type": "action.progress", "progress": 30, "message": "Processing...", "timestamp": "..."}

event: action.complete
data: {"type": "action.complete", "result": {...}, "timestamp": "..."}

event: action.error
data: {"type": "action.error", "error": {...}, "timestamp": "..."}
```

**Progress Event Structure:**
```json
{
  "type": "action.progress",
  "sessionId": "string",
  "actionId": "string",
  "progress": 50,              // 0-100 percentage
  "message": "Current step description",
  "data": {},                  // Optional: Intermediate results
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Agent Implementation Guide

### Generating A2UI Payloads

When implementing `/v1/a2ui/generate`, agents should:

1. **Parse the prompt** for intent:
   - "create a form" → Form components
   - "show a chart" → Chart component with data
   - "list items" → DataTable or List component

2. **Select appropriate components** from the A2UI whitelist:
   - Use base components for simple cases
   - Use extended components for advanced features

3. **Structure the payload**:
```rust
fn generate_a2ui_payload(prompt: &str, context: Context) -> Result<A2UIPayload> {
    let intent = classify_intent(prompt)?;
    
    match intent {
        Intent::Form => generate_form_payload(prompt, context),
        Intent::Chart => generate_chart_payload(prompt, context),
        Intent::Table => generate_table_payload(prompt, context),
        _ => generate_default_payload(prompt, context),
    }
}
```

4. **Include sensible defaults** in data model:
   - Pre-populate form fields if context available
   - Include sample data for charts/tables
   - Set reasonable initial values

### Handling Actions

When implementing `/v1/a2ui/action`, agents should:

1. **Validate input data**:
```rust
fn validate_action_input(action_id: &str, payload: &Value, data_model: &Value) -> Result<()> {
    match action_id {
        "submit" => validate_form(payload),
        "delete" => validate_delete_permission(data_model),
        _ => Ok(()),
    }
}
```

2. **Execute business logic**:
```rust
fn execute_action(request: ActionRequest) -> Result<ActionResponse> {
    match request.action_id.as_str() {
        "submit" => handle_submit(request),
        "search" => handle_search(request),
        "navigate" => handle_navigate(request),
        _ => handle_generic_action(request),
    }
}
```

3. **Return appropriate response**:
   - For data updates: Return `data_model_updates`
   - For view changes: Return new `payload`
   - For errors: Return structured error response

---

## Type Definitions (Rust)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateA2UIRequest {
    pub chat_id: String,
    pub prompt: String,
    #[serde(default)]
    pub context: Option<A2UIContext>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct A2UIContext {
    #[serde(default)]
    pub data_model: Option<serde_json::Value>,
    #[serde(default)]
    pub current_payload: Option<A2UIPayload>,
    #[serde(default)]
    pub chat_history: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateA2UIResponse {
    pub success: bool,
    pub agent_id: String,
    pub payload: A2UIPayload,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct A2UIActionRequest {
    pub session_id: String,
    pub action_id: String,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    pub data_model: serde_json::Value,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub context: Option<ActionContext>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionContext {
    pub chat_id: String,
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default)]
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct A2UIActionResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<A2UIPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_model_updates: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<A2UIError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct A2UIError {
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub field_errors: Option<serde_json::Value>,
}

// A2UI Payload structure
#[derive(Debug, Serialize, Deserialize)]
pub struct A2UIPayload {
    pub version: String,
    pub surfaces: Vec<A2UISurface>,
    #[serde(default)]
    pub data_model: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct A2UISurface {
    pub id: String,
    pub title: String,
    pub components: Vec<ComponentNode>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComponentNode {
    pub r#type: String,
    pub props: serde_json::Value,
    #[serde(default)]
    pub children: Option<Vec<ComponentNode>>,
}

// SSE Event types
#[derive(Debug, Serialize)]
pub struct ActionProgressEvent {
    pub r#type: String,  // "action.progress"
    pub session_id: String,
    pub action_id: String,
    pub progress: u8,  // 0-100
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    pub timestamp: String,
}
```

---

## Testing Endpoints

### Test with curl

Generate A2UI:
```bash
curl -X POST http://127.0.0.1:3004/v1/a2ui/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "test-chat-123",
    "prompt": "Create a form for entering contact information"
  }'
```

Execute Action:
```bash
curl -X POST http://127.0.0.1:3004/v1/a2ui/action \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-456",
    "action_id": "submit",
    "payload": {"name": "John", "email": "john@example.com"},
    "data_model": {"form": {"name": "", "email": ""}}
  }'
```

Stream Action:
```bash
curl -N "http://127.0.0.1:3004/v1/a2ui/actions/stream?session_id=test&action_id=long_task" \
  -H "Accept: text/event-stream"
```

---

## Fallback Behavior

Until the Kernel implements these endpoints, the API layer provides mock responses for development:

- **Generate**: Returns pre-built templates based on keywords (form, chart, table)
- **Action**: Returns simple success responses with mock data model updates
- **Stream**: Simulates progress events with artificial delays

This allows frontend development to proceed while the Kernel endpoints are being implemented.
