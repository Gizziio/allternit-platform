# Mode System Prompt Integration Guide

## Current Status

✅ **Frontend:** Mode toggle sends `mode: "plan" | "build"` to backend  
✅ **Backend API:** Forwards mode to kernel in session creation payload  
⏳ **Kernel:** Needs to read mode and inject system prompt

---

## Integration Points

### 1. Backend Already Sends Mode

**File:** `cmd/api/src/main.rs` line ~4078

```rust
// Add mode for tool filtering (plan vs build)
if let Some(ref mode) = request.mode {
    create_body["mode"] = serde_json::json!(mode);
}
```

This sends:
```json
{
  "config": {...},
  "mode": "plan",  // or "build"
  ...
}
```

### 2. Kernel Session Creation

**File:** `domains/kernel/infrastructure/allternit-openclaw-host/src/api/sessions.rs`

**Function:** `create_session` (line 138)

**Current Code:**
```rust
pub async fn create_session(
    State(state): State<AgentApiState>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<SessionResponse>), (StatusCode, Json<ApiError>)> {
    let mut sessions = state.session_manager.write().await;
    
    // ... creates session
}
```

**What Needs to Change:**

The kernel needs to:
1. Accept `mode` field in CreateSessionRequest
2. Load the appropriate mode prompt file
3. Inject it into the session's system messages

---

## Implementation Steps

### Step 1: Update CreateSessionRequest

**File:** `domains/kernel/infrastructure/allternit-openclaw-host/src/api/sessions.rs`

```rust
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
    // ADD THIS:
    pub mode: Option<String>,  // "plan" or "build"
}
```

### Step 2: Load Mode Prompt

**Add at top of file:**
```rust
const PROMPT_PLAN_MODE: &str = include_str!("../prompt/plan-mode.txt");
const PROMPT_BUILD_MODE: &str = include_str!("../prompt/build-mode.txt");
```

### Step 3: Inject Mode Prompt in Session Creation

**In `create_session` function, after creating the session:**

```rust
// Inject mode-based system prompt
let mode_prompt = match req.mode.as_deref() {
    Some("plan") => PROMPT_PLAN_MODE,
    Some("build") => PROMPT_BUILD_MODE,
    _ => "",  // Default: no mode restriction
};

if !mode_prompt.is_empty() {
    // Store mode in session metadata
    let mut metadata = req.metadata.unwrap_or_default();
    metadata["mode"] = serde_json::Value::String(req.mode.unwrap_or_default());
    
    // The mode prompt will be used when sending messages to the LLM
    // This happens in the message handling/streaming code
    metadata["system_prompt_prefix"] = serde_json::Value::String(mode_prompt.to_string());
    
    session.metadata = Some(metadata);
}
```

### Step 4: Apply Mode Prompt to LLM Messages

**Where LLM calls are made** (likely in `native_session_manager.rs` or message streaming):

```rust
// When building messages for the LLM
let mut system_messages = Vec::new();

// Add mode prompt first (if exists)
if let Some(mode_prompt) = session.metadata.get("system_prompt_prefix") {
    if let Some(prompt_text) = mode_prompt.as_str() {
        system_messages.push(Message {
            role: "system".to_string(),
            content: prompt_text.to_string(),
            timestamp: Utc::now(),
            metadata: None,
        });
    }
}

// Then add existing system messages
// ... rest of system messages

// Then user/assistant messages
```

---

## Alternative: Gizzi Integration

Since you already updated `cmd/gizzi-code/src/runtime/session/system.ts`:

```typescript
export function provider(model: Provider.Model, mode?: 'plan' | 'build') {
  const basePrompts = []
  
  // Add mode-specific prompt
  if (mode === 'plan') {
    basePrompts.push(PROMPT_PLAN_MODE)
  } else if (mode === 'build') {
    basePrompts.push(PROMPT_BUILD_MODE)
  }
  
  // ... provider prompts
  return basePrompts
}
```

**You need to:**
1. Find where `SystemPrompt.provider()` is called
2. Pass the `mode` parameter from the session config
3. The mode comes from the API request

**Likely location:** `cmd/gizzi-code/src/runtime/session/` - look for where sessions are created with model/provider config.

---

## Testing

Once integrated, test by:

1. **Toggle to Plan mode** (Compass icon)
2. **Send a message** like "delete the test files"
3. **Expected behavior:** LLM should refuse, citing plan mode restrictions
4. **Toggle to Build mode** (Hammer icon)
5. **Send same message**
6. **Expected behavior:** LLM proceeds with deletion (with appropriate safety checks)

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `domains/kernel/.../api/sessions.rs` | Add mode field, load prompts | P0 |
| `domains/kernel/.../native_session_manager.rs` | Apply mode prompt to LLM | P0 |
| `cmd/gizzi-code/.../system.ts` | Already updated | ✅ |
| `cmd/gizzi-code/.../session-creation` | Pass mode to SystemPrompt | P1 |

---

## Quick Win

The **fastest path** is through Gizzi since you already updated `system.ts`:

1. Find where sessions are created in Gizzi
2. Extract `mode` from session config/request
3. Pass it to `SystemPrompt.provider(model, mode)`

This avoids touching the Rust kernel entirely if Gizzi is the active execution path.
