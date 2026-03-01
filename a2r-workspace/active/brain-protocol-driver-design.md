# Brain Protocol Driver: Architectural Design Document

## Executive Summary

This document proposes a new architecture for A2rchitech's model brain backend to properly integrate CLI-based AI agents (Claude Code, Gemini CLI, Kimi CLI, etc.) using the **Agent Client Protocol (ACP)** and headless execution modes, replacing the current PTY-based approach that produces TUI garbage output.

## Current Problem

### The PTY Architecture Mistake

The current `CliBrainDriver` uses PTY (pseudo-terminal) sessions to spawn CLI tools:

```rust
// Current (WRONG) approach in cli.rs
let session_id = self.terminal_manager.create_custom_session(...).await?;
// Spawns claude/gemini/kimi in interactive TUI mode
// Captures ANSI escape codes, banners, echoed input
```

**Result**: The API receives TUI garbage:
```
[?25l[?25h[1m[32m>[0m explain this code
[?25l[1;1H┌────────────────────────────────────┐
│ [33mClaude Code[0m                       │
```

### Root Cause

CLI tools like `claude`, `gemini`, and `kimi` are designed with two distinct modes:

| Mode | Purpose | Interface |
|------|---------|-----------|
| **Interactive TUI** | Human users | PTY required, rich UI, ANSI codes |
| **Headless/Print** | Automation/Scripts | Pipes/stdio, clean output, JSON |

The current driver spawns them in TUI mode (via PTY) but expects programmatic output.

## Proposed Architecture

### Design Principle: Separate Concerns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         A2rchitech Platform                                  │
│                                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────────────────┐     │
│  │ Terminal UI      │      │ Brain Engine (Chat/Agent API)            │     │
│  │ (Human-facing)   │      │ (Programmatic)                           │     │
│  └────────┬─────────┘      └──────────────────┬───────────────────────┘     │
│           │                                    │                            │
│           ▼                                    ▼                            │
│  ┌──────────────────┐      ┌──────────────────────────────────────────┐     │
│  │ TerminalDriver   │      │ ProtocolDriver                         │     │
│  │ - PTY sessions   │      │ - ACP stdio or headless CLI            │     │
│  │ - Full TUI       │      │ - Clean JSON/text output               │     │
│  │ - ANSI support   │      │ - No PTY, no ANSI                      │     │
│  └──────────────────┘      └──────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Two Driver Types

#### 1. TerminalAppDriver (Existing)

**Purpose**: Human interactive terminal sessions
**Use Case**: User opens a terminal in the shell UI to manually use claude/gemini

```rust
pub struct TerminalAppDriver {
    terminal_manager: Arc<TerminalManager>,
    // Uses PTY for full TUI experience
}

impl TerminalAppDriver {
    pub async fn spawn_interactive(&self, command: &str) -> Result<String> {
        // Creates PTY session
        // User sees full TUI with banners, colors, interactive menus
        // Output captured as-is (ANSI and all) for terminal display
    }
}
```

#### 2. BrainProtocolDriver (NEW)

**Purpose**: Programmatic agent communication
**Use Case**: API chat requests, background agents, automation

```rust
pub enum ProtocolMode {
    /// Native ACP (Agent Client Protocol) - JSON-RPC over stdio
    /// Used by: opencode, future versions of claude/gemini/kimi
    Acp,
    
    /// Headless CLI mode with structured output
    /// Used by: claude -p, gemini -p, kimi --print
    HeadlessCli {
        command: String,
        prompt_flag: String,      // "-p" or "--print"
        output_format_flag: String, // "--output-format"
        output_format: String,    // "stream-json" or "json"
    },
}

pub struct BrainProtocolDriver {
    mode: ProtocolMode,
    // NO PTY - uses raw stdin/stdout pipes
}
```

## Implementation Approaches

### Approach A: ACP Native (Future-Proof)

**Protocol**: Agent Client Protocol (ACP) - JSON-RPC 2.0 over stdio

**Supported Agents**:
- OpenCode (`opencode acp`)
- Gemini CLI (via ACP mode)
- Future: Claude Code, Kimi CLI (when they add native ACP)

**Flow**:
```
┌─────────────┐     initialize      ┌─────────────┐
│   Client    │ ──────────────────> │    Agent    │
│ (A2rchitech)│ <────────────────── │  (opencode) │
└─────────────┘   InitializeResponse └─────────────┘
       │
       │ session/new
       ▼
┌─────────────┐     session/prompt    ┌─────────────┐
│   Client    │ ─────────────────────> │    Agent    │
│             │ <──────────────────── │             │
│             │  session/update (notif)│             │
│             │  session/update (notif)│             │
│             │  session/update (notif)│             │
│             │ <──────────────────── │             │
│             │     PromptResponse     │             │
└─────────────┘                       └─────────────┘
```

**Rust Implementation**:
```rust
use agent_client_protocol::{ClientSideConnection, InitializeRequest};

pub struct AcpBrainDriver {
    connection: ClientSideConnection,
    session_id: Option<String>,
}

impl AcpBrainDriver {
    pub async fn spawn(command: &str, args: &[&str]) -> Result<Self> {
        let mut child = Command::new(command)
            .args(args)  // e.g., ["acp"]
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        
        // Establish ACP connection over stdio
        let connection = ClientSideConnection::new(
            child.stdin.take().unwrap(),
            child.stdout.take().unwrap(),
        ).await?;
        
        // Initialize
        let response = connection.initialize(InitializeRequest {
            protocol_version: 1,
            client_info: ImplementationMetadata {
                name: "a2rchitech".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            capabilities: ClientCapabilities::default(),
        }).await?;
        
        Ok(Self { connection, session_id: None })
    }
    
    pub async fn send_prompt(&mut self, prompt: &str) -> Result<ResponseStream> {
        // Create session if needed
        let session_id = match &self.session_id {
            Some(id) => id.clone(),
            None => {
                let resp = self.connection.session_new(NewSessionRequest {
                    cwd: std::env::current_dir()?.to_string_lossy().to_string(),
                }).await?;
                self.session_id = Some(resp.session_id.clone());
                resp.session_id
            }
        };
        
        // Send prompt
        let response = self.connection.session_prompt(PromptRequest {
            session_id,
            content: vec![Content::text(prompt)],
        }).await?;
        
        // Stream updates via connection event loop
        Ok(ResponseStream::new(self.connection.subscribe()))
    }
}
```

**Pros**:
- Clean, standardized protocol
- Bidirectional (agent can request file reads, terminal commands)
- Streaming support
- Session management
- Tool use support

**Cons**:
- Limited agent support today (mostly opencode)
- Requires Rust ACP SDK (available: `agent-client-protocol` crate)

### Approach B: Headless CLI Mode (Immediate Solution)

**Command Flags**:
| CLI Tool | Print Mode | Output Format | Streaming |
|----------|-----------|---------------|-----------|
| Claude Code | `-p` or `--print` | `--output-format stream-json` | Yes |
| Gemini CLI | `-p` | `--output-format stream-json` | Yes |
| Kimi CLI | `--print` | `--output-format stream-json` | Yes |
| Codex CLI | `-q` | `--format json` | Yes |

**Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│  User Request (HTTP/API)                                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  A2rchitech Platform                                             │
│                                                                  │
│  1. Compile conversation context from thread log                │
│  2. Spawn CLI process:                                           │
│     claude -p --output-format stream-json \                     │
│            --include-partial-messages \                         │
│            "<compiled context + current prompt>"                │
│                                                                  │
│  3. Stream stdout (JSON lines)                                   │
│  4. Parse and emit clean events:                                 │
│     - chat.delta (assistant text)                               │
│     - tool.start/tool.finish (if supported)                     │
│                                                                  │
│  5. Process exits → session ends                                 │
│     (NO persistent process - state in platform, not CLI)        │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight**: The platform maintains the canonical conversation state, not the CLI process. Each turn spawns a fresh CLI process with full context.

**Rust Implementation**:
```rust
pub struct HeadlessCliDriver {
    config: HeadlessCliConfig,
}

pub struct HeadlessCliConfig {
    pub command: String,                    // "claude"
    pub prompt_flag: String,                // "-p"
    pub output_format_args: Vec<String>,    // ["--output-format", "stream-json"]
    pub extra_args: Vec<String>,            // ["--include-partial-messages"]
}

impl BrainDriver for HeadlessCliDriver {
    async fn send_prompt(&self, context: &ConversationContext, prompt: &str) -> Result<EventStream> {
        // Compile full prompt with context
        let full_prompt = self.compile_prompt(context, prompt);
        
        // Spawn one-shot process (NO PTY!)
        let mut child = Command::new(&self.config.command)
            .arg(&self.config.prompt_flag)
            .args(&self.config.output_format_args)
            .args(&self.config.extra_args)
            .arg(&full_prompt)  // Pass as argument, not stdin
            .stdout(Stdio::piped())
            .stderr(Stdio::null())  // Suppress warnings
            .spawn()?;
        
        // Stream and parse JSON lines
        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        
        let (tx, rx) = mpsc::channel(100);
        
        tokio::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                match parse_stream_json(&line) {
                    Ok(StreamEvent::Delta { content }) => {
                        let _ = tx.send(BrainEvent::ChatDelta { content }).await;
                    }
                    Ok(StreamEvent::ToolCall { name, params }) => {
                        let _ = tx.send(BrainEvent::ToolStart { name, params }).await;
                    }
                    Ok(StreamEvent::Done) => break,
                    Err(e) => log::warn!("Parse error: {}", e),
                }
            }
            
            // Wait for process to complete
            let _ = child.wait().await;
            let _ = tx.send(BrainEvent::Complete).await;
        });
        
        Ok(EventStream::new(rx))
    }
}
```

**Pros**:
- Works TODAY with claude/gemini/kimi
- No persistent process management
- Clean JSON output
- No PTY complexity

**Cons**:
- Spawns process per turn (overhead ~100-500ms)
- No native tool use (agent can't request file reads mid-turn)
- Context length limitations

## Recommended Implementation Plan

### Phase 1: Headless CLI Driver (Immediate)

**Goal**: Fix CLI tools showing TUI garbage in chat

1. **Create new driver**: `HeadlessCliDriver` in `kernel-service/src/brain/drivers/headless_cli.rs`
2. **Update CLI brain config** to use headless mode:
   ```json
   {
     "id": "claude-code",
     "brain_type": "headless_cli",
     "command": "claude",
     "prompt_flag": "-p",
     "output_format": "stream-json",
     "extra_flags": ["--include-partial-messages"]
   }
   ```
3. **Implement context compilation**:
   - Convert thread log to conversation format
   - Respect token limits
   - Handle system prompts
4. **Stream JSON parsing**:
   - Handle `stream-json` format from claude/gemini/kimi
   - Emit proper `BrainEvent`s
5. **Test with all CLI tools**

### Phase 2: State Management Refactor

**Goal**: Move session state from CLI process to platform

1. **Thread log as source of truth**:
   - Store complete conversation history
   - Include tool results, file edits, etc.
2. **Context window management**:
   - Summarize older messages when approaching limit
   - Prioritize recent context + system prompt
3. **No persistent CLI processes**:
   - Spawn/exit per turn
   - Platform manages "session" concept

### Phase 3: ACP Driver (Future-Proofing)

**Goal**: Support native ACP agents

1. **Add ACP dependency**: `agent-client-protocol = "0.x"`
2. **Create `AcpBrainDriver`**:
   - Wraps `ClientSideConnection`
   - Handles ACP session lifecycle
3. **Support bidirectional tools**:
   - Agent requests file reads → platform serves
   - Agent requests terminal → platform spawns
4. **Migrate opencode support** from PTY to ACP

### Phase 4: Hybrid Architecture

**Goal**: Support both human TUI and programmatic use

```
┌─────────────────────────────────────────────────────────────┐
│                    A2rchitech Platform                       │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Shell UI        │    │ API Gateway                     │ │
│  │ (Interactive)   │    │ (Programmatic)                  │ │
│  └────────┬────────┘    └────────────┬────────────────────┘ │
│           │                          │                      │
│           ▼                          ▼                      │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ TerminalDriver  │    │ BrainProtocolDriver             │ │
│  │ (PTY sessions)  │    │ (ACP / Headless CLI)            │ │
│  │                 │    │                                 │ │
│  │ Human-facing    │    │ Machine-facing                  │ │
│  │ Full TUI        │    │ Clean events                    │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Shared: Thread Log (Source of Truth)                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Schema

### New brain_types

```rust
pub enum BrainType {
    /// HTTP API (OpenAI-compatible)
    HttpApi,
    
    /// Native MCP client
    Mcp,
    
    /// PTY-based terminal app (human-facing)
    #[deprecated(note = "Use HeadlessCli for chat, TerminalApp for TUI")]
    Cli,
    
    /// NEW: Headless CLI mode (one-shot execution)
    HeadlessCli {
        command: String,
        prompt_flag: String,
        output_format: OutputFormat,
        streaming: bool,
    },
    
    /// NEW: ACP native protocol
    Acp {
        command: String,
        args: Vec<String>,
    },
    
    /// NEW: Human-facing terminal app (PTY)
    TerminalApp {
        command: String,
        args: Vec<String>,
    },
}

pub enum OutputFormat {
    StreamJson,  // NDJSON with streaming events
    Json,        // Single JSON response
    Text,        // Plain text
}
```

### Example Configs

**Claude Code (Headless)**:
```json
{
  "id": "claude-code",
  "name": "Claude Code",
  "brain_type": "headless_cli",
  "command": "claude",
  "prompt_flag": "-p",
  "output_format": "stream-json",
  "streaming": true,
  "extra_args": ["--include-partial-messages"],
  "requirements": [{ "kind": "binary", "name": "claude" }]
}
```

**OpenCode (ACP)**:
```json
{
  "id": "opencode-acp",
  "name": "OpenCode (ACP)",
  "brain_type": "acp",
  "command": "opencode",
  "args": ["acp"],
  "requirements": [{ "kind": "binary", "name": "opencode" }]
}
```

**Claude Code (Terminal TUI)**:
```json
{
  "id": "claude-code-tui",
  "name": "Claude Code (Terminal)",
  "brain_type": "terminal_app",
  "command": "claude",
  "args": [],
  "requirements": [{ "kind": "binary", "name": "claude" }]
}
```

## Migration Path

### Current State (Broken)
```rust
// cli.rs - PTY-based, outputs TUI garbage
CliBrainDriver::spawn("claude") -> PTY session
```

### Step 1: Rename and Deprecate
```rust
// Rename CliBrainDriver -> TerminalAppDriver
// Mark as #[deprecated] for programmatic use
// Keep for human TUI sessions
```

### Step 2: Add HeadlessCliDriver
```rust
// New driver for chat API
HeadlessCliDriver::spawn("claude", "-p", "stream-json")
```

### Step 3: Update API Routing
```rust
// In kernel service
match brain_config.brain_type {
    "headless_cli" => Box::new(HeadlessCliDriver::new(config)),
    "terminal_app" => Box::new(TerminalAppDriver::new(config)),
    "acp" => Box::new(AcpBrainDriver::new(config)),
    // ...
}
```

### Step 4: Update Shell UI
```typescript
// Model selector
const CLI_HEADLESS = [
  { id: "claude-code", name: "Claude Code", driver: "headless_cli" },
  { id: "gemini-cli", name: "Gemini CLI", driver: "headless_cli" },
  { id: "kimi-cli", name: "Kimi CLI", driver: "headless_cli" },
];

const CLI_TERMINAL = [
  { id: "claude-code-tui", name: "Claude Code (Terminal)", driver: "terminal_app" },
];
```

## Open Questions

1. **Tool Use in Headless Mode**:
   - Claude's `-p` mode supports some tool use
   - How do we handle file reads? Platform pre-reads and includes in context?

2. **Streaming vs Non-Streaming**:
   - Always use streaming (`stream-json`) for better UX?
   - Fallback to non-streaming for simple queries?

3. **Context Window Management**:
   - Summarization strategy for long conversations
   - How to preserve tool results/edit history?

4. **Error Handling**:
   - CLI process crashes → graceful degradation
   - Rate limiting from CLI tools (separate from API rate limits)

5. **MCP Integration**:
   - Should headless mode support MCP servers?
   - Or is MCP only for ACP mode?

## References

- [ACP Specification](https://agentclientprotocol.com/)
- [OpenCode ACP Docs](https://opencode.ai/docs/acp/)
- [Zed ACP Docs](https://zed.dev/acp)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [agent-client-protocol Crate](https://docs.rs/agent-client-protocol/latest/agent_client_protocol/)
- [ACP Rust SDK](https://github.com/agentclientprotocol/rust-sdk)

## Appendix: Stream JSON Format

### Claude Code Stream JSON

```json
{"type": "thinking", "thinking": "Let me analyze this..."}
{"type": "text", "content": "I'll help you "}
{"type": "text", "content": "refactor this function."}
{"type": "tool_use", "name": "Read", "params": {"file_path": "src/main.rs"}}
{"type": "tool_result", "content": "..."}
{"type": "text", "content": "Based on the code..."}
{"type": "stop", "stop_reason": "end_turn"}
```

### Gemini CLI Stream JSON

Similar format with Gemini-specific event types.

### Kimi CLI Stream JSON

Similar format with Kimi-specific event types.
