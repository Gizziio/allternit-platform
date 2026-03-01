# ACP Research Summary: From PTY to Protocol

## Core Finding: PTY vs Protocol Architecture

The fundamental issue with A2rchitech's CLI brain driver is architectural: **using PTY (pseudo-terminal) sessions for programmatic agent communication**.

### The Wrong Approach (Current)

```rust
// Current implementation - WRONG
CliBrainDriver::spawn() {
    // Creates PTY session
    terminal_manager.create_custom_session("claude") 
    // Result: Captures TUI garbage (ANSI codes, banners, echoed input)
}
```

**Why this fails**: CLI tools like `claude`, `gemini`, and `kimi` have two modes:
- **Interactive TUI mode** (default): Expects PTY, outputs rich UI with ANSI codes
- **Headless/Print mode** (`-p`, `--print`): Uses stdio pipes, outputs clean JSON/text

Spawning in TUI mode but expecting clean output is the mismatch.

---

## The Solution: Two-Driver Architecture

### 1. TerminalAppDriver (Human-Facing)

**Purpose**: Interactive TUI sessions for humans
**Use Case**: User opens terminal in Shell UI, types `claude`

```rust
pub struct TerminalAppDriver {
    // PTY-based for full TUI experience
    // ANSI colors, interactive menus, banners - all OK
}
```

### 2. BrainProtocolDriver (Machine-Facing)

**Purpose**: Programmatic agent communication
**Use Case**: API chat requests, automation, background agents

**Two implementation modes**:

#### Mode A: Headless CLI (Immediate Solution)

Spawn one-shot processes with print mode:

```bash
# Claude
claude -p --output-format stream-json --include-partial-messages "prompt"

# Gemini
gemini -p --output-format stream-json "prompt"

# Kimi
kimi --print --output-format stream-json "prompt"
```

**Key insight**: Platform maintains session state, CLI process is ephemeral (spawn per turn).

#### Mode B: ACP Native (Future-Proof)

Use Agent Client Protocol (ACP) - JSON-RPC 2.0 over stdio:

```bash
opencode acp  # Starts ACP server
```

**Benefits**:
- Bidirectional (agent can request file reads, terminal commands)
- Streaming updates via notifications
- Session management
- Tool use support

---

## Agent Client Protocol (ACP) Details

### What is ACP?

ACP is a **JSON-RPC 2.0 based protocol** for editor ↔ agent communication (like LSP for AI agents).

**Key characteristics**:
- Transport: Newline-delimited JSON over stdio
- Bidirectional: Both client and agent can send requests
- Stateful: Sessions maintain conversation history
- Streaming: Real-time updates via notifications

### ACP Message Flow

```
1. Initialize (capability negotiation)
   Client -> Agent: initialize
   Agent -> Client: InitializeResponse

2. Create Session
   Client -> Agent: session/new
   Agent -> Client: NewSessionResponse { session_id }

3. Send Prompt
   Client -> Agent: session/prompt { session_id, content }
   
4. Streaming Updates (notifications)
   Agent -> Client: session/update { kind: "agent_thought_chunk", ... }
   Agent -> Client: session/update { kind: "agent_message_chunk", ... }
   Agent -> Client: session/update { kind: "tool_call", ... }
   
5. Final Response
   Agent -> Client: PromptResponse { content, stop_reason }
```

### ACP vs Other Protocols

| Protocol | Purpose | Transport |
|----------|---------|-----------|
| **ACP** | Editor ↔ Agent | JSON-RPC 2.0 over stdio |
| **MCP** | Agent ↔ Tools/Data | JSON-RPC 2.0 over stdio |
| **A2A** | Agent ↔ Agent | HTTP/SSE |
| **IBM/BeeAI ACP** | Agent ↔ Agent | REST |

### ACP Implementations

**Agents supporting ACP**:
- OpenCode (`opencode acp`)
- Gemini CLI (native ACP support)
- Kimi CLI (native ACP support)
- Claude Code (via Zed's adapter, future native)
- Goose, Cline, Junie, and 20+ others

**Rust SDK**: `agent-client-protocol` crate on crates.io

---

## Vendor CLI Capabilities

### Claude Code

```bash
# Headless mode
claude -p "prompt"                                    # Simple text output
claude -p --output-format json "prompt"              # JSON output
claude -p --output-format stream-json "prompt"       # Streaming JSON
claude -p --include-partial-messages "prompt"        # Include thinking

# Session management
claude -c -p "prompt"                                # Continue last session
claude -r <session-id> -p "prompt"                   # Resume specific session
```

### Gemini CLI

```bash
# Headless mode
gemini -p "prompt"
gemini -p --output-format stream-json "prompt"

# ACP mode (native)
gemini acp  # If available, or via ACP adapter
```

### Kimi CLI

```bash
# Headless mode
kimi --print "prompt"
kimi --print --output-format stream-json "prompt"

# ACP mode (native)
kimi acp  # If available
```

### OpenCode

```bash
# ACP mode (native, recommended)
opencode acp [--port 0] [--hostname 127.0.0.1]

# Can also use headless
opencode -p "prompt"
```

---

## Recommended Implementation

### Phase 1: Headless CLI Driver (Fix TUI Garbage Now)

1. Create `HeadlessCliDriver` - NO PTY, uses `std::process::Command`
2. Spawn per turn with `-p --output-format stream-json`
3. Parse NDJSON output, emit clean `BrainEvent`s
4. Platform maintains conversation state

**Code sketch**:
```rust
impl BrainDriver for HeadlessCliDriver {
    async fn send_prompt(&self, context: &ThreadLog, prompt: &str) -> Result<EventStream> {
        let full_prompt = compile_context(context, prompt);
        
        let mut child = Command::new("claude")
            .args(["-p", "--output-format", "stream-json"])
            .arg(&full_prompt)
            .stdout(Stdio::piped())
            .spawn()?;
        
        // Stream stdout, parse JSON lines, emit events
        parse_stream_json(child.stdout).await
    }
}
```

### Phase 2: ACP Driver (Future-Proof)

1. Add `agent-client-protocol` crate
2. Create `AcpBrainDriver` wrapping `ClientSideConnection`
3. Support bidirectional tool use
4. Migrate opencode from PTY to ACP

### Phase 3: Clean Separation

```
Shell UI Terminal Tab -> TerminalAppDriver (PTY, TUI)
API Chat Request -> BrainProtocolDriver (Headless/ACP)
```

---

## Key Design Principles

1. **No PTY for programmatic use**: PTY is for humans, pipes are for machines
2. **Platform owns state**: Thread log is source of truth, CLI processes are ephemeral
3. **Spawn per turn**: Each request spawns fresh CLI with full context
4. **Two drivers, clear separation**: TerminalAppDriver for TUI, BrainProtocolDriver for API
5. **ACP is the future**: Migrate to native ACP as tools add support

---

## References

- [ACP Overview](https://agentclientprotocol.com/)
- [OpenCode ACP Docs](https://opencode.ai/docs/acp/)
- [Zed ACP](https://zed.dev/acp)
- [ACP Rust SDK](https://docs.rs/agent-client-protocol/latest/)
- [Claude Code CLI Ref](https://code.claude.com/docs/en/cli-reference)
