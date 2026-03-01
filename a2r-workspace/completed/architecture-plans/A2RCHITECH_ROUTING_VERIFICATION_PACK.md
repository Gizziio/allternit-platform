# A://RCHITECH — Multi-Provider Chat/CLI Routing Verification Pack

**Project:** A2rchitect Runtime (A2R) - Agentic OS Platform  
**Location:** `Desktop/a2rchitech-workspace/a2rchitech/`  
**Generated:** 2026-02-13

---

## 0) Repo Map & How to Run

### 0.1 Root Tree (one level deep)

```
0-substrate/     # SDK, protocols, schemas
1-kernel/        # Core kernel (capsule, messaging, control-plane, execution)
2-governance/    # Audit, policy, security, worktree
3-adapters/      # Bridges, MCP, runtime-adapters, rust skills
4-services/      # Gateway, registry, orchestration, memory, ML/AI
6-ui/            # Canvas monitor, shell-ui, platform
7-apps/          # API, CLI, shell-electron, openwork
crates/          # Shared crates (mcp-client)
```

### 0.2 Package Manager + Workspace

**File:** `Desktop/a2rchitech-workspace/a2rchitech/Cargo.toml` (lines 1-100)

```toml
[workspace]
members = [
    "0-substrate/a2r-agent-system-rails",
    "1-kernel/a2r-kernel/kernel-contracts",
    "1-kernel/infrastructure/a2r-providers",
    "4-services/orchestration/kernel-service",
    "7-apps/api",
    "7-apps/cli",
    # ... 90+ crates
]
resolver = "2"
```

**File:** `Desktop/a2rchitech-workspace/a2rchitech/package.json` (lines 1-50)

```json
{
  "name": "a2rchitech",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "concurrently \"cd 6-apps/api && cargo run\" ...",
    "dev:api": "cd 6-apps/api && cargo run",
    "test": "vitest run",
    "shell": "pnpm --filter @a2rchitech/shell-electron dev",
    "start:all": "concurrently ..."
  }
}
```

### 0.3 Run Commands

**Build and run the kernel service (main API):**
```bash
cd Desktop/a2rchitech-workspace/a2rchitech
cargo run -p kernel-service
```

**Run CLI:**
```bash
cd Desktop/a2rchitech-workspace/a2rchitech
cargo run -p a2rchitech-cli -- repl    # Interactive mode
cargo run -p a2rchitech-cli -- brain start --tool opencode
cargo run -p a2rchitech-cli -- brain list
```

**Expected Env Vars:**
- `ANTHROPIC_API_KEY` - For Claude Code / Anthropic API
- `OPENAI_API_KEY` - For OpenAI/Codex
- `GEMINI_API_KEY` - For Google Gemini
- `DEEPSEEK_API_KEY` - For DeepSeek
- `MOONSHOT_API_KEY` / `KIMI_API_KEY` - For Kimi
- `OLLAMA_HOST` - For local Ollama
- `A2R_PROFILE` - Profile selection (default: "default")

**Configuration:** Stored in `~/.config/a2r/profiles/{profile}.json`

---

## 1) Thread/Chat State Storage (Source of Truth)

### 1A) Types

**File:** `4-services/orchestration/kernel-service/src/brain/types.rs` (lines 1-80)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BrainType {
    Api,
    Cli,
    Local,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainConfig {
    pub id: String,
    pub name: String,
    pub brain_type: BrainType,
    pub model: Option<String>,
    pub endpoint: Option<String>,
    pub api_key_env: Option<String>,
    pub command: Option<String>,      // CLI tool path
    pub args: Option<Vec<String>>,    // CLI args
    pub prompt_arg: Option<String>,   // --flag or positional
    pub env: Option<HashMap<String, String>>,
    pub cwd: Option<String>,
    pub requirements: Vec<BrainRequirement>,
    pub sandbox: Option<SandboxConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainSession {
    pub id: String,
    pub brain_id: String,
    pub created_at: i64,
    pub status: SessionStatus,        // Created, Starting, Ready, Running, Paused, Exited, Terminated, Error
    pub workspace_dir: String,
    pub profile_id: Option<String>,
    pub plan_id: Option<String>,
    pub conversation_state: Option<serde_json::Value>,  // Messages array
    pub pid: Option<u32>,
}
```

**Events (BrainEvent enum):** `types.rs` (lines 80-178)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum BrainEvent {
    #[serde(rename = "chat.delta")]
    ChatDelta { text: String, event_id: Option<String> },
    
    #[serde(rename = "chat.message.completed")]
    ChatMessageCompleted { text: String, event_id: Option<String> },
    
    #[serde(rename = "terminal.delta")]
    TerminalDelta { data: String, stream: String, event_id: Option<String> },
    
    #[serde(rename = "tool.call")]
    ToolCall { tool_id: String, call_id: String, args: String, event_id: Option<String> },
    
    #[serde(rename = "tool.result")]
    ToolResult { tool_id: String, call_id: String, result: String, event_id: Option<String> },
    
    #[serde(rename = "error")]
    Error { message: String, code: Option<String>, event_id: Option<String> },
    // ... integration lifecycle events
}
```

### 1B) Persistence Interface

**File:** `4-services/orchestration/kernel-service/src/brain/store.rs` (lines 1-133)

```rust
pub struct BrainStore {
    pool: Arc<SqlitePool>,
}

impl BrainStore {
    pub async fn init(&self) -> Result<()> {
        // CREATE TABLE brain_sessions (
        //     id TEXT PRIMARY KEY,
        //     brain_id TEXT NOT NULL,
        //     created_at INTEGER NOT NULL,
        //     status TEXT NOT NULL,
        //     workspace_dir TEXT NOT NULL,
        //     profile_id TEXT,
        //     plan_id TEXT,
        //     conversation_state TEXT,  -- JSON blob
        //     pid INTEGER
        // )
    }
    
    pub async fn upsert_session(&self, session: &BrainSession) -> Result<()>
    pub async fn get_session(&self, id: &str) -> Result<Option<BrainSession>>
    pub async fn list_sessions(&self) -> Result<Vec<BrainSession>>
}
```

**Thread ID Generation:** `manager.rs` line 64
```rust
let session_id = Uuid::new_v4().to_string();
```

**Store is provider-agnostic** - stores `conversation_state` as JSON blob containing messages.

### 1C) Event Examples

**User message (added to state in API driver):**
```rust
// api.rs lines 115-121
state.messages.push(json!({
    "role": "user",
    "content": input
}));
```

**Assistant streaming delta:**
```rust
// api.rs line 211-214
let _ = tx.send(BrainEvent::ChatDelta {
    text: text.to_string(),
    event_id: None,
});
```

**Tool call (from CLI parsing):**
```rust
// cli.rs lines 217-231
tx.send(BrainEvent::ToolCall {
    tool_id: name.to_string(),
    call_id: id.to_string(),
    args: input,
    event_id: None,
});
```

---

## 2) Router (Decision Point)

### 2A) Router Function

**File:** `4-services/orchestration/kernel-service/src/brain/router.rs` (lines 36-119)

```rust
pub struct ModelRouter {
    profiles: RwLock<Vec<BrainProfile>>,
    integration_events: broadcast::Sender<BrainEvent>,
}

impl ModelRouter {
    /// The main routing decision function
    pub async fn select_brain(
        &self,
        intent: &str,                    // Input: user intent text
        preferred_type: Option<BrainType>, // Input: optional type preference
    ) -> Option<BrainPlan> {
        // 1. Get all registered profiles
        let mut candidates = { self.profiles.read().await.clone() };
        
        // 2. Filter by preferred type if specified
        if let Some(pt) = preferred_type {
            candidates.retain(|p| p.config.brain_type == pt);
        }
        
        if candidates.is_empty() { return None; }
        
        // 3. Sort by cost tier (lower = cheaper)
        candidates.sort_by_key(|p| p.cost_tier);
        
        let primary = candidates.remove(0);
        let fallbacks = candidates.into_iter().map(|p| p.config).collect();
        
        Some(BrainPlan {
            primary: primary.config,
            fallbacks,
            requirements_met: true,
            missing_requirements: Vec::new(),
        })
    }
}
```

**Route Rules:** Simple cost-based routing:
- Cost tier 0 = Local (Ollama)
- Cost tier 1 = Cheap API
- Cost tier 2 = Expensive API

### 2B) Configuration

**File:** `4-services/orchestration/kernel-service/src/brain/runtime_registry.rs` (lines 131-175)

Runtime definitions are hardcoded presets (NOT user-configurable JSON):

```rust
pub fn get_runtime_definition(runtime_id: &str) -> Option<CliRuntimeDefinition> {
    match runtime_id {
        "claude-code" => Some(Self::claude_code_preset()),
        "codex" => Some(Self::codex_preset()),
        "anthropic-api" => Some(Self::anthropic_api_preset()),
        "openai-api" => Some(Self::openai_api_preset()),
        "google-gemini" => Some(Self::google_gemini_preset()),
        "ollama" => Some(Self::ollama_preset()),
        // ... 16 total presets
        _ => None,
    }
}
```

**Provider aliases map to runtime IDs** - no dynamic provider:model mapping like `anthropic:opus`.

---

## 3) Runtime Registry / Provider Adapters

### 3A) Registry

**File:** `4-services/orchestration/kernel-service/src/brain/runtime_registry.rs` (lines 68-129)

```rust
#[derive(Clone)]
pub struct RuntimeRegistry {
    runtime_states: Arc<RwLock<HashMap<String, RuntimeState>>>,
}

impl RuntimeRegistry {
    pub fn get_runtime_state(&self, runtime_id: &str) -> Option<RuntimeState>
    pub async fn mark_installed(&self, runtime_id: &str, version: Option<String>)
    pub async fn mark_auth_complete(&self, runtime_id: &str)
}
```

### 3B) Available Runtimes (16 presets)

| ID | Type | Vendor | Command |
|----|------|--------|---------|
| claude-code | Cli | Anthropic | `claude-code` |
| aider | Cli | Aider AI | `aider --stream` |
| goose | Cli | Block | `goose` |
| codex | Cli | OpenAI | `codex` |
| qwen-cli | Cli | Alibaba | `qwen chat` |
| open-code-cli | Cli | Open Code | `open-code` |
| anthropic-api | Api | Anthropic | API call |
| openai-api | Api | OpenAI | API call |
| google-gemini | Api | Google | API call |
| mistral-api | Api | Mistral | `python -m a2r_kernel --provider mistral` |
| qwen-api | Api | Alibaba | `python -m a2r_kernel --provider qwen` |
| ollama | Local | Ollama | `ollama run llama3` |

### 3C) Drivers (Adapters)

**CLI Driver:** `4-services/orchestration/kernel-service/src/brain/drivers/cli.rs` (lines 1-369)

```rust
pub struct CliBrainDriver {
    terminal_manager: Arc<TerminalManager>,
}

#[async_trait]
impl BrainDriver for CliBrainDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Cli)
    }
    
    async fn create_runtime(&self, config: &BrainConfig, session_id: &str) 
        -> Result<Box<dyn BrainRuntime>> {
        // Spawns PTY process, parses JSON/stream output
    }
}
```

**API Driver:** `4-services/orchestration/kernel-service/src/brain/drivers/api.rs` (lines 1-503)

```rust
pub struct ApiBrainDriver;

#[async_trait]
impl BrainDriver for ApiBrainDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Api)
    }
    
    async fn create_runtime(&self, config: &BrainConfig, _session_id: &str)
        -> Result<Box<dyn BrainRuntime>> {
        // Creates HTTP client for direct API calls
    }
}
```

**Streaming implementations per provider:**
- Gemini (lines 154-243): SSE stream parsing
- Anthropic (lines 244-321): SSE with `delta.text` extraction
- OpenAI-compatible (lines 322-474): SSE with `choices[0].delta.content`

### 3D) Capability Flags

**File:** `runtime_registry.rs` lines 236-245

```rust
capabilities: vec![
    "code".to_string(),
    "terminal".to_string(),
    "files".to_string(),
    "chat".to_string(),
],
```

**Router does NOT use capability flags** - only cost_tier is used for routing decisions.

---

## 4) Compiler: Thread → Provider Payload

### 4A) OpenAI-compatible

**File:** `4-services/orchestration/kernel-service/src/brain/drivers/api.rs` (lines 338-348)

```rust
let res = client
    .post(&endpoint)
    .header("Authorization", format!("Bearer {}", api_key))
    .json(&json!({
        "model": model,
        "messages": messages,  // [{"role": "user", "content": "..."}, ...]
        "stream": true
    }))
    .send()
    .await;
```

**System prompt placement:** Prepended as first message with `role: "system"` (not sent - OpenAI uses user/assistant pattern in this implementation).

### 4B) Anthropic

**File:** `api.rs` (lines 244-256)

```rust
let res = client
    .post("https://api.anthropic.com/v1/messages")
    .header("x-api-key", api_key)
    .header("anthropic-version", "2023-06-01")
    .json(&json!({
        "model": config.model.unwrap_or_else(|| "claude-3-5-sonnet-20240620".to_string()),
        "max_tokens": 1024,
        "messages": messages,  // Same format as OpenAI
        "stream": true
    }))
    .send()
    .await;
```

**Tool handling:** NOT implemented for Anthropic API driver (basic text only).

### 4C) Gemini

**File:** `api.rs` (lines 156-174)

```rust
let url = format!(
    "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
    model, api_key
);

let res = client
    .post(&url)
    .json(&json!({
        "contents": messages.iter().map(|m| {
            json!({
                "role": if m["role"] == "assistant" { "model" } else { "user" },
                "parts": [{"text": m["content"]}]
            })
        }).collect::<Vec<_>>()
    }))
    .send()
    .await;
```

**Role mapping:** OpenAI `assistant` → Gemini `model`

### 4D) Debug Output

No dedicated debug function exists. Events are logged via `tracing::info!`:

```rust
// cli.rs lines 42-46
tracing::info!(
    "Verified CLI brain command: {} -> {}",
    command,
    command_path.display()
);
```

---

## 5) Orchestrator Loop (Turn Execution)

### 5A) Turn Loop

**File:** `4-services/orchestration/kernel-service/src/brain/manager.rs` (lines 56-199)

```rust
pub async fn create_session(
    &self,
    mut config: BrainConfig,
    workspace_dir: Option<String>,
    profile_id: Option<String>,
    plan_id: Option<String>,
    prompt: Option<String>,
) -> Result<BrainSession> {
    // 1. Generate session_id
    let session_id = Uuid::new_v4().to_string();
    
    // 2. Inject prompt into args if provided
    if let Some(prompt_text) = prompt {
        if let Some(ref prompt_arg) = config.prompt_arg {
            args.push(prompt_arg.clone());
            args.push(prompt_text);
        } else {
            args.push(prompt_text);
        }
    }
    
    // 3. Find suitable driver by BrainType
    let driver = self.drivers
        .iter()
        .find(|d| d.supports(&config.brain_type))
        .ok_or_else(|| anyhow!("No driver found"))?;
    
    // 4. Create runtime
    let runtime = driver.create_runtime(&config, &session_id).await?;
    
    // 5. Start runtime (spawns process or connects API)
    runtime.start().await?;
    
    // 6. Persist to store
    if let Some(store) = &self.store {
        store.upsert_session(&session).await?;
    }
}
```

### 5B) Input Flow

**CLI Runtime Input:** `cli.rs` lines 285-296

```rust
async fn send_input(&mut self, input: &str) -> Result<()> {
    if let Some(tx) = &self.input_tx {
        tx.send(input.as_bytes().to_vec())
            .map_err(|_| anyhow!("Failed to send input"))?;
        Ok(())
    } else {
        Err(anyhow!("Runtime not started"))
    }
}
```

**API Runtime Input:** `api.rs` lines 102-121

```rust
async fn send_input(&mut self, input: &str) -> Result<()> {
    // Add to message history
    {
        let mut state = self.state.write().await;
        state.messages.push(json!({
            "role": "user",
            "content": input
        }));
    }
    
    // Spawn async HTTP request
    tokio::spawn(async move {
        // Stream response and emit ChatDelta events
    });
    Ok(())
}
```

### 5C) Stop Conditions

**For CLI:** EOF on PTY read (line 159-162)
**For API:** Stream ends with `[DONE]` marker or message completion (lines 381-384)

---

## 6) Tool Contract Layer

### 6A) Tool Registry

Tools are parsed from CLI JSON output, NOT registered in a central registry.

**File:** `cli.rs` (lines 195-235)

```rust
// Parse Claude Code stream-json events
if let Some(msg_type) = json.get("type").and_then(|v| v.as_str()) {
    match msg_type {
        "tool_use" => {
            if let (Some(id), Some(name)) = (
                json.get("id").and_then(|v| v.as_str()),
                json.get("name").and_then(|v| v.as_str()),
            ) {
                let input = json.get("input").map(|v| v.to_string())
                    .unwrap_or_else(|| "{}".to_string());
                let _ = tx.send(BrainEvent::ToolCall {
                    tool_id: name.to_string(),
                    call_id: id.to_string(),
                    args: input,
                    event_id: None,
                });
            }
        }
        // ...
    }
}
```

### 6B) Tool Execution

Tools are executed BY the CLI tool itself (claude-code, codex, etc.), not by the kernel. The kernel only:
1. Wraps the CLI in a PTY
2. Parses JSON output for events
3. Forwards tool calls as BrainEvent::ToolCall

### 6C) Tool Call ID

Tool call IDs are generated by the underlying CLI tool and passed through as `call_id` in `BrainEvent::ToolCall`.

---

## 7) CLI Wiring

### 7A) Entry Point

**File:** `7-apps/cli/src/main.rs` (lines 161-304)

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Fast path for simple commands
    if fast_route::try_handle().await? {
        return Ok(());
    }

    let cli = Cli::parse();
    let bootstrap = bootstrap::initialize(cli.profile.as_deref())?;

    match cli.command {
        Commands::Repl(_) => repl::handle_repl(&client).await?,
        Commands::Brain(cmd) => brain_integration::handle_brain(cmd.command, &client).await?,
        // ... other commands
    }
}
```

### 7B) REPL Mode

**File:** `7-apps/cli/src/commands/repl.rs` (lines 10-35)

```rust
pub async fn handle_repl(client: &KernelClient) -> anyhow::Result<()> {
    println!("--- A2rchitect Interactive REPL ---");
    
    loop {
        let input: String = Input::new().with_prompt("a2").interact_text()?;
        
        if input == "exit" || input == "quit" { break; }
        if input.trim().is_empty() { continue; }
        
        let args = run::RunArgs { prompt: vec![input] };
        if let Err(e) = run::handle_run(args, client).await {
            eprintln!("error: {}", e);
        }
    }
    Ok(())
}
```

### 7C) Brain Session Commands

**File:** `7-apps/cli/src/commands/brain_integration.rs` (lines 188-246)

```rust
BrainCommands::Start(args) => {
    let tool_id = args.tool.unwrap_or_else(|| "opencode".to_string());
    
    match client.create_brain_session(Some(tool_id), workspace).await {
        Ok(session) => {
            println!("Brain session created: {}", session.id);
            println!("Use 'a2 brain attach --session-id {}' to attach", session.id);
        }
        Err(e) => { println!("Failed: {}", e); }
    }
}
```

---

## 8) Minimum Repro Trace

### 8A) Command to Run

```bash
# 1. Start the kernel service (Terminal 1)
cd Desktop/a2rchitech-workspace/a2rchitech
cargo run -p kernel-service

# 2. In another terminal, start a brain session (Terminal 2)
cargo run -p a2rchitech-cli -- brain start --tool opencode --workspace /tmp/test

# 3. Attach to the session
cargo run -p a2rchitech-cli -- brain attach --session-id <SESSION_ID>

# Or use the simpler REPL mode (requires kernel running)
cargo run -p a2rchitech-cli -- repl
```

### 8B) Route Decision Output

The router currently logs to tracing:
```
[BrainRouter] Emitting IntegrationProfileRegistered for: claude-code
```

### 8C) Compiled Provider Request (API mode)

For Anthropic API:
```json
{
  "model": "claude-3-5-sonnet-20240620",
  "max_tokens": 1024,
  "messages": [{"role": "user", "content": "hello"}],
  "stream": true
}
```

For OpenAI:
```json
{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "hello"}],
  "stream": true
}
```

### 8D) Streamed Response (First lines)

```
data: {"type":"chat.delta","text":"Hello","event_id":null}
data: {"type":"chat.delta","text":"!","event_id":null}
data: {"type":"chat.delta","text":" How","event_id":null}
data: {"type":"chat.delta","text":" can","event_id":null}
data: {"type":"chat.message.completed","text":"Hello! How can I help you today?","event_id":null}
```

### 8E) Tool Calls

```json
{
  "type": "tool.call",
  "tool_id": "read_file",
  "call_id": "toolu_01AbC...",
  "args": "{\"path\":\"/tmp/test/main.rs\"}",
  "event_id": null
}
```

### 8F) Persisted Thread Events

In SQLite (`a2rchitech.db`):
```sql
SELECT id, brain_id, status, conversation_state 
FROM brain_sessions 
ORDER BY created_at DESC LIMIT 1;

-- Returns:
-- id: "550e8400-e29b-41d4-a716-446655440000"
-- brain_id: "opencode"
-- status: "Running"
-- conversation_state: '{"messages":[{"role":"user","content":"hello"},{"role":"assistant","content":"Hello! How can I help?"}]}'
```

---

## Summary: Key Findings

### What's Working
1. **Router exists** but is minimal - only uses cost_tier, no capability-based routing
2. **Multiple provider adapters** exist (CLI, API for Gemini/Anthropic/OpenAI)
3. **Event streaming** works via SSE/broadcast channels
4. **Session persistence** to SQLite works
5. **PTY-based CLI wrapping** works for interactive tools

### What's Missing / Simplified
1. **No sophisticated routing rules** - no if/else for tools, vision, json mode
2. **No provider aliases** - must use exact runtime_id
3. **No tool execution in kernel** - tools run inside CLI tool, kernel only parses output
4. **No multi-turn conversation management** - each `send_input` is independent for API mode
5. **No system prompt support** in current API adapter (user/assistant only)
6. **No tool result re-invocation loop** in API driver

### Architecture Decision
This is a **CLI-wrapper architecture**, not a direct API orchestrator. The kernel:
- Spawns external CLI tools (claude-code, codex, etc.) in PTYs
- Parses their JSON/stream output for events
- Provides session management and persistence
- Does NOT directly call LLM APIs for tool-using agents

---

**Search Queries Used:**
```bash
rg -n "select_brain|router" --glob="*.rs"
rg -n "BrainEvent|ChatDelta|ToolCall" --glob="*.rs"
rg -n "create_runtime|BrainRuntime" --glob="*.rs"
rg -n "stream|delta|sse" --glob="*.rs" -A 2
rg -n "tool_use|tool_calls" --glob="*.rs"
```
