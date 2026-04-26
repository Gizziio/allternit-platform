# Runtime Execution Flow

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Allternit Platform                                │
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │   ChatUI        │────▶│   API Service   │────▶│   Kernel Service    │   │
│  │   (Port 5177)   │◀────│   (Port 3000)   │◀────│   (Port 3004)       │   │
│  └─────────────────┘     └─────────────────┘     └─────────────────────┘   │
│         │                                               │                    │
│         │                                               │                    │
│         ▼                                               ▼                    │
│  ┌─────────────────┐                          ┌─────────────────────┐       │
│  │   Model Picker  │                          │   Brain Drivers     │       │
│  │   (Runtime      │                          │   - ACP Protocol    │       │
│  │    Discovery)   │                          │   - JSONL Protocol  │       │
│  └─────────────────┘                          │   - Terminal App    │       │
│                                               └─────────────────────┘       │
│                                                        │                     │
│                                                        ▼                     │
│                                               ┌─────────────────────┐       │
│                                               │   CLI Runtimes      │       │
│                                               │   (opencode,        │       │
│                                               │    gemini, kimi)    │       │
│                                               └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Startup Sequence

### Step 1: Kernel Service Starts (Port 3004)

```rust
// kernel-service/src/main.rs
#[tokio::main]
async fn main() {
    // 1. Load brain profiles from registry
    let brain_manager = BrainManager::new();
    
    // 2. Register drivers
    brain_manager.register_driver(Box::new(AcpProtocolDriver::new()));
    brain_manager.register_driver(Box::new(JsonlProtocolDriver::new()));
    brain_manager.register_driver(Box::new(TerminalAppDriver::new(terminal_manager)));
    
    // 3. Start HTTP server
    let app = create_router(brain_manager);
    axum::serve(listener, app).await;
}
```

**Loaded Brain Profiles:**
```yaml
opencode-acp:
  brain_type: cli
  event_mode: acp
  command: opencode
  args: [acp]
  
gemini-acp:
  brain_type: cli
  event_mode: acp
  command: npx
  args: [@google/gemini-cli, --experimental-acp]

claude-code-tui:
  brain_type: cli
  event_mode: terminal
  command: claude
```

---

### Step 2: API Service Starts (Port 3000)

```rust
// api/src/main.rs
#[tokio::main]
async fn main() {
    // 1. Connect to kernel
    let kernel_client = reqwest::Client::new();
    let kernel_url = "http://127.0.0.1:3004";
    
    // 2. Start HTTP server
    let app = create_router(AppState {
        kernel_client,
        kernel_url,
        chat_sessions: Arc::new(RwLock::new(HashMap::new())),
    });
    
    axum::serve(listener, app).await;
}
```

---

### Step 3: ChatUI Loads (Port 5177)

```typescript
// shell-ui loads ChatUI component
export function ChatView() {
  return (
    <ChatModelsProvider>
      <ProviderAuthProvider>  {/* NEW */}
        <ChatComposer />
      </ProviderAuthProvider>
    </ChatModelsProvider>
  );
}
```

---

## 2. User Opens Model Picker

### Flow: ChatUI → API → Kernel

```
User clicks model picker
        │
        ▼
┌───────────────────────┐
│ useProviderAuth hook  │
│ - Check cache (miss)  │
│ - Fetch auth status   │
└───────────────────────┘
        │
        │ GET /v1/providers/auth/status
        ▼
┌───────────────────────┐
│ API Service           │
│ - Proxy to kernel     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Kernel Service        │
│ - ProviderAuthRegistry│
│ - Check auth files    │
│ - Return status       │
└───────────────────────┘
        │
        │ {providers: [{provider_id: "opencode", status: "missing", ...}]}
        ▼
┌───────────────────────┐
│ ChatUI                │
│ - Show "Authenticate" │
│   button for OpenCode │
│ - Show lock icons     │
└───────────────────────┘
```

**Auth Status Check:**
```bash
# Kernel checks for auth tokens
ls ~/.config/opencode/auth.json  # missing = locked
ls ~/.config/gemini/credentials  # exists = unlocked
```

---

## 3. User Authenticates (Auth Wizard)

### Flow: Unlock Provider

```
User clicks "Authenticate" on OpenCode
        │
        ▼
┌───────────────────────┐
│ createAuthSession()   │
│ POST /v1/sessions     │
│ {                     │
│   brain_profile_id:   │
│     "opencode-auth",  │
│   source: "terminal"  │ ← Important!
│ }                     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Kernel Service        │
│ - Validates:          │
│   source=terminal     │
│   event_mode=terminal │
│ - Creates PTY session │
│ - Spawns: opencode    │
│   login               │
└───────────────────────┘
        │
        │ {session_id: "sess_abc123"}
        ▼
┌───────────────────────┐
│ ChatUI                │
│ - Opens Terminal view │
│ - Attaches to sess    │
│ - User types:         │
│   "opencode login"    │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ User completes OAuth  │
│ in terminal           │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ ChatUI polls auth     │
│ every 3 seconds       │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ GET /v1/providers/    │
│ opencode/auth/status  │
│ Returns: "ok"         │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ UI unlocks OpenCode   │
│ Model picker enabled  │
└───────────────────────┘
```

---

## 4. User Selects Model

### Flow: Discovery

```
OpenCode unlocked, user opens model dropdown
        │
        ▼
┌───────────────────────┐
│ useProviderAuth       │
│ - Check cache (stale) │
│ - Fetch models        │
└───────────────────────┘
        │
        │ GET /v1/providers/opencode/models
        │ ?profile_id=opencode-acp
        ▼
┌───────────────────────┐
│ Kernel Service        │
│ - Spawns: opencode    │
│   acp --list-models   │
│ - Parses JSON output  │
└───────────────────────┘
        │
        │ {models: [
        │   {id: "anthropic:claude-3-7", 
        │    label: "Claude 3.7 Sonnet"},
        │   {id: "openai:gpt-4o",
        │    label: "GPT-4o"}
        │ ]}
        ▼
┌───────────────────────┐
│ ChatUI                │
│ - Populate dropdown   │
│ - Cache 24h           │
│ - Show "Updated now"  │
└───────────────────────┘
```

**Kernel Discovery:**
```rust
// kernel/src/brain/providers/mod.rs
async fn discover_models(&self, profile_id: &str) -> Result<ModelsResponse> {
    let profile = self.get_profile(profile_id)?;
    
    // Spawn CLI in pipe mode (NOT PTY)
    let output = Command::new(&profile.command)
        .args([&profile.args, "--list-models"])
        .output()
        .await?;
    
    // Parse JSON output
    let models: Vec<ModelInfo> = serde_json::from_slice(&output.stdout)?;
    
    Ok(ModelsResponse {
        provider: profile.provider_id,
        profile_id: profile_id.to_string(),
        fetched_at: Utc::now().to_rfc3339(),
        models,
    })
}
```

---

## 5. User Sends Chat Message

### Flow: Complete Chat Session

```
User: "Explain this code"
        │
        ▼
┌───────────────────────┐
│ ChatUI                │
│ - Selected:           │
│   provider=opencode   │
│   model=anthropic:    │
│          claude-3-7   │
│ - Call sendMessage()  │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ useBrainChat hook     │
│ - Add user message    │
│ - Call API chat()     │
└───────────────────────┘
        │
        │ POST /api/chat
        │ {
        │   message: "Explain...",
        │   chatId: "chat_123",
        │   modelId: "opencode-acp",
        │   runtimeModelId: 
        │     "anthropic:claude-3-7"
        │ }
        ▼
┌───────────────────────┐
│ API Service           │
│ - resolve_chat_model  │
│ - Build config:       │
│   event_mode: "acp"   │
│ - Create kernel sess  │
└───────────────────────┘
        │
        │ POST /v1/sessions
        │ {
        │   brain_profile_id: 
        │     "opencode-acp",
        │   source: "chat",      ← CRITICAL!
        │   runtime_overrides: {
        │     model_id: 
        │       "anthropic:cl-   ← Runtime model
        │        aude-3-7"
        │   }
        │ }
        ▼
┌───────────────────────┐
│ Kernel Service        │
│                       │
│ 1. SOURCE GATING      │
│    source=chat        │
│    event_mode=acp ✓   │
│    (NOT terminal)     │
│                       │
│ 2. DRIVER SELECTION   │
│    AcpProtocolDriver  │
│    (pipes, NOT PTY)   │
│                       │
│ 3. SPAWNING           │
│    Command: opencode  │
│    Args: [acp]        │
│    Stdio: piped       │
│    (NO PTY!)          │
│                       │
│ 4. ACP HANDSHAKE      │
│    → {"method":"init  │
│       ialize",...}    │
│    ← {"result":{...}} │
│                       │
│ 5. SESSION CREATION   │
│    → {"method":"sess  │
│       ion/new",...}   │
│    ← {"session_id"    │
│       :"sess_xyz"}    │
└───────────────────────┘
        │
        │ {id: "sess_xyz", ...}
        ▼
┌───────────────────────┐
│ API Service           │
│ - Get session ID      │
│ - Open SSE stream     │
│ GET /v1/sessions/     │
│ sess_xyz/events       │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Kernel → API Stream   │
│                       │
│ Event 1:              │
│ {"type":"session.      │
│  started",            │
│  "payload":{          │
│   "event_mode":"acp", │
│   "source":"chat"     │
│  }}                   │
│                       │
│ Event 2:              │
│ {"type":"chat.delta", │
│  "payload":{          │
│   "text":"I'll help   │
│    explain..."        │
│  }}                   │
│                       │
│ Event 3:              │
│ {"type":"tool.call",  │
│  "payload":{          │
│   "tool_id":"Read",   │
│   "args":{"file":...} │
│  }}                   │
│                       │
│ ... more events ...   │
│                       │
│ Event N:              │
│ {"type":"chat.mess    │
│  age.completed"}      │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ API Validates Stream  │
│                       │
│ 1. session.started    │
│    is first? ✓        │
│                       │
│ 2. event_mode=acp     │
│    (not terminal)? ✓  │
│                       │
│ 3. No terminal.delta  │
│    in stream? ✓       │
│                       │
│ 4. Forward to UI      │
└───────────────────────┘
        │
        │ SSE to ChatUI
        ▼
┌───────────────────────┐
│ ChatUI Renders        │
│                       │
│ User: Explain...      │
│                       │
│ Assistant: I'll help  │
│ explain... [stream]   │
│                       │
│ 🔧 Running: Read      │
│ src/main.rs           │
│                       │
│ ✅ Read completed     │
│ [show result]         │
│                       │
│ The code uses tokio   │
│ for async runtime...  │
│                       │
│ [Input field active]  │
└───────────────────────┘
```

---

## 6. What Happens with Terminal Brain

### Blocked Flow

```
User selects "claude-code-tui"
(event_mode=terminal)
        │
        ▼
┌───────────────────────┐
│ User tries to chat    │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ API sends:            │
│ source="chat"         │
│ event_mode="terminal" │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ KERNEL REJECTS!       │
│                       │
│ Source Gating:        │
│ source="chat" &&      │
│ event_mode="terminal" │
│ = CONFLICT            │
│                       │
│ Returns: 409 Conflict │
│ "Chat sessions cannot │
│ use Terminal mode"    │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ API returns error     │
│ to ChatUI             │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ UI shows:             │
│ "❌ Mode Mismatch      │
│  This brain is        │
│  terminal-only.       │
│  [Open in Terminal]   │
│  [Choose ACP Brain]"  │
└───────────────────────┘
```

---

## 7. Runtime Model ID Flow

### How Runtime Model Selection Works

```
┌─────────────────────────────────────────────────────────┐
│                    MODEL SELECTION                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  UI Layer                                                │
│  ├─ Provider: OpenCode                                   │
│  ├─ Brain Profile: opencode-acp                         │
│  └─ Runtime Model: anthropic:claude-3-7-sonnet         │
│     (opaque string from runtime)                        │
│                                                          │
│  ↓                                                       │
│                                                          │
│  API Layer                                               │
│  ├─ brain_profile_id: "opencode-acp"                    │
│  ├─ source: "chat"                                      │
│  └─ runtime_overrides: {                                │
│       model_id: "anthropic:claude-3-7-sonnet"          │
│     }                                                    │
│                                                          │
│  ↓                                                       │
│                                                          │
│  Kernel Layer                                            │
│  ├─ Routes to AcpProtocolDriver                         │
│  ├─ Spawns: opencode acp                                │
│  └─ Sends ACP message: {                                │
│       method: "session/prompt",                         │
│       params: {                                         │
│         content: [...],                                 │
│         session_config: {                               │
│           model_id: "anthropic:claude-3-7-sonnet"      │
│         }                                               │
│       }                                                 │
│     }                                                    │
│                                                          │
│  ↓                                                       │
│                                                          │
│  OpenCode Runtime                                        │
│  ├─ Receives model_id                                   │
│  ├─ Routes to Anthropic API                             │
│  └─ Streams back responses                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Tool Execution Flow

### Round-Trip Tool Call

```
User: "Read src/main.rs"
        │
        ▼
┌───────────────────────┐
│ Assistant generates   │
│ tool call via ACP     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Kernel Receives:      │
│ {"type":"tool.call",  │
│  "tool_id":"Read",    │
│  "call_id":"t1",      │
│  "args":{             │
│    "file":"src/       │
│     main.rs"          │
│  }}                   │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Kernel → API:         │
│ "Execute tool Read    │
│  with args {...}"     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Tool Gateway          │
│ - Validates tool      │
│ - Executes:           │
│   cat src/main.rs     │
│ - Returns result      │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Kernel → ACP:         │
│ {"type":"tool.result",│
│  "call_id":"t1",      │
│  "result":"fn main..."│
│ }                     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ OpenCode continues    │
│ with tool result      │
│ in context            │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Assistant responds    │
│ with explanation      │
└───────────────────────┘
```

---

## 9. Error Scenarios

### Scenario A: Kernel Returns terminal.delta

```
Kernel bug: emits terminal event in chat
        │
        ▼
┌───────────────────────┐
│ API receives:         │
│ {"type":"terminal.     │
│  delta",...}          │
│                       │
│ CONTRACT VIOLATION!   │
│                       │
│ Action: ABORT STREAM  │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ UI shows:             │
│ "❌ Kernel Mode        │
│  Mismatch             │
│  Terminal output in    │
│  chat session"        │
└───────────────────────┘
```

### Scenario B: Stale Model ID

```
User selects model from cache
        │
        ▼
┌───────────────────────┐
│ Runtime responds:     │
│ "Unknown model:       │
│  anthropic:claude-x"  │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ UI auto-refreshes     │
│ model list            │
│                       │
│ Shows updated list    │
│ with suggestions      │
└───────────────────────┘
```

---

## 10. Data Flow Summary

| Step | Component | Action |
|------|-----------|--------|
| 1 | ChatUI | Check auth status, lock/unlock providers |
| 2 | ChatUI | Fetch runtime models (cache 24h) |
| 3 | User | Select provider + model |
| 4 | ChatUI | Call API with `runtime_overrides.model_id` |
| 5 | API | Create kernel session with `source="chat"` |
| 6 | Kernel | Validate: source=chat requires event_mode≠terminal |
| 7 | Kernel | Spawn ACP driver (pipes, NOT PTY) |
| 8 | Kernel | ACP handshake + session creation |
| 9 | Kernel | Stream events: chat.delta, tool.call, etc. |
| 10 | API | Validate: session.started first, no terminal.delta |
| 11 | API | Forward events to ChatUI |
| 12 | ChatUI | Render assistant text + tool panels |

---

## 11. Key Invariants at Runtime

| Invariant | Enforced By | Failure Mode |
|-----------|-------------|--------------|
| Chat uses ACP/JSONL | Kernel source gating | 409 Conflict |
| Terminal uses PTY | Kernel source gating | 409 Conflict |
| session.started first | API validation | Abort stream |
| No terminal.delta in chat | API validation | Abort stream |
| Runtime model IDs | Runtime discovery | Auto-refresh |
| Auth before chat | UI lock | Auth wizard |
| Tool execution | Kernel gateway | Error event |

---

**Result**: Clean separation between chat (ACP/JSONL) and terminal (PTY), with runtime-owned model discovery and proper error handling.