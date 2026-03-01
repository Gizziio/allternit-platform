# ACP (Agent Client Protocol) Implementation

## Summary

This document describes the implementation of ACP-first architecture for A2R kernel, enabling OpenCode-style "CLI as brain runtime" with clean semantic event streams.

## Architecture Changes

### Before (PTY-First)
```
CLI Brain → PTY (Terminal) → ANSI/Banner garbage → Unreliable parsing
```

### After (ACP-First)
```
CLI Brain → Pipes (stdio) → JSON-RPC/NDJSON → Structured BrainEvents
```

## Files Created/Modified

### New Files

1. **`brain/drivers/acp.rs`** (NEW)
   - `AcpProtocolDriver` - Primary driver for ACP-capable CLIs
   - `AcpBrainRuntime` - Runtime using piped stdio (NOT PTY)
   - Full JSON-RPC 2.0 implementation
   - Handles ACP messages: `initialize`, `session/new`, `session/prompt`, `session/update`
   - Emits clean `BrainEvent`s: `ChatDelta`, `ChatMessageCompleted`, `ToolCall`, `ToolResult`

### Modified Files

2. **`brain/types.rs`**
   - Added `EventMode` enum: `Terminal`, `Acp`, `Jsonl`, `Api`
   - Added `event_mode` field to `BrainConfig`

3. **`brain/traits.rs`**
   - Added `supports_with_config()` method to `BrainDriver` trait
   - Enables event_mode-based driver selection

4. **`brain/drivers/terminal.rs`** (renamed from `cli.rs`)
   - Renamed `CliBrainDriver` → `TerminalAppDriver`
   - Added `supports_with_config()` that only accepts `EventMode::Terminal`
   - Now explicitly for HUMAN INTERACTION ONLY

5. **`brain/drivers/mod.rs`**
   - Added exports for new drivers

6. **`brain/mod.rs`**
   - Updated exports
   - Backward compatibility alias: `CliBrainDriver` → `TerminalAppDriver`

7. **`brain/manager.rs`**
   - Updated to use `supports_with_config()` for driver selection
   - Better error messages for missing drivers

8. **`main.rs`**
   - Updated driver registration order:
     1. `AcpProtocolDriver` (PRIMARY)
     2. `ApiBrainDriver`
     3. `LocalBrainDriver`
     4. `TerminalAppDriver` (fallback for human interaction)
   - Updated all brain profiles with `event_mode: Some(EventMode::Jsonl)`

## Brain Profile Configuration

| CLI | event_mode | Driver | Use Case |
|-----|------------|--------|----------|
| claude-code | `Jsonl` | `AcpProtocolDriver` | Chat, code generation |
| codex | `Jsonl` | `AcpProtocolDriver` | Chat, code generation |
| gemini-cli | `Jsonl` | `AcpProtocolDriver` | Chat, code generation |
| kimi-cli | `Jsonl` | `AcpProtocolDriver` | Chat, code generation |
| qwen-cli | `Jsonl` | `AcpProtocolDriver` | Chat, code generation |

## How Driver Selection Works

```rust
// When creating a brain session:
let driver = self
    .drivers
    .iter()
    .find(|d| d.supports_with_config(&config))
    .ok_or_else(|| anyhow!("No driver found..."))?;
```

1. **AcpProtocolDriver.supports_with_config()**: Returns true only if `event_mode == Some(EventMode::Acp)`
2. **TerminalAppDriver.supports_with_config()**: Returns true if `event_mode == Some(EventMode::Terminal)` or `None`
3. Priority order: ACP > API > Local > Terminal

## Event Mode Meanings

### `EventMode::Acp`
- Uses piped stdin/stdout (NO PTY)
- Speaks JSON-RPC 2.0 over NDJSON
- Clean structured events
- **PRIMARY for chat/AI interactions**

### `EventMode::Jsonl`
- Uses piped stdin/stdout (NO PTY)
- Speaks NDJSON events (not full JSON-RPC)
- Still structured, but simpler protocol
- Good for CLIs with `--output-format json` flags

### `EventMode::Terminal`
- Uses PTY (pseudo-terminal)
- Interactive TUI mode
- Output has ANSI codes, banners, etc.
- **FOR HUMAN INTERACTION ONLY**

### `EventMode::Api`
- HTTP API calls
- Not CLI-based

## ACP Protocol Implementation

### Handshake Flow
1. Spawn process with piped stdio
2. Send `initialize` request (JSON-RPC)
3. Receive `initialize` response
4. Send `session/new` request
5. Receive `session/new` response with session_id
6. Ready for prompts

### Sending Prompts
```rust
let request = JsonRpcRequest {
    jsonrpc: "2.0",
    id: Some(request_id),
    method: "session/prompt",
    params: SessionPromptParams {
        session_id: "...",
        content: vec![ContentBlock::Text { text: "..." }],
    },
};
// Write to process stdin as NDJSON
```

### Receiving Events
ACP notifications are parsed and mapped to `BrainEvent`:
- `agent_thought_chunk` → `ChatDelta` (with `[thinking]` prefix)
- `agent_message_chunk` → `ChatDelta` (text content)
- `message_stop` → `ChatMessageCompleted`
- `tool_call` → `ToolCall`
- `tool_result` → `ToolResult`

## Testing Checklist

### 1. Verify Driver Selection
```bash
# Create ACP brain session
curl -X POST http://localhost:3004/v1/sessions \
  -H "Authorization: Bearer sk-a2r-dev-token-local" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "id": "claude-code",
      "name": "Claude Code",
      "brain_type": "cli",
      "event_mode": "jsonl",
      "command": "claude",
      "args": ["--output-format", "stream-json"]
    }
  }'

# Should use AcpProtocolDriver (pipes, not PTY)
```

### 2. Verify Terminal Mode Still Works
```bash
# Create terminal brain session
curl -X POST http://localhost:3004/v1/sessions \
  -H "Authorization: Bearer sk-a2r-dev-token-local" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "id": "claude-code-interactive",
      "name": "Claude Code (Interactive)",
      "brain_type": "cli",
      "event_mode": "terminal",
      "command": "claude",
      "args": []
    }
  }'

# Should use TerminalAppDriver (PTY)
```

### 3. Test Event Streaming
```bash
# Attach to session events
curl -N http://localhost:3004/v1/sessions/{id}/events \
  -H "Authorization: Bearer sk-a2r-dev-token-local"

# Should receive clean BrainEvents, not ANSI codes
```

## Future ACP-Compatible CLIs

To add a new ACP-capable CLI:

1. Check ACP Registry for spawn command
2. Add brain profile with `event_mode: Some(EventMode::Acp)`
3. Set command/args to ACP mode (e.g., `opencode acp`)

Example:
```rust
model_router
    .register_profile(BrainProfile {
        config: BrainConfig {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            brain_type: BrainType::Cli,
            event_mode: Some(EventMode::Acp),  // ← KEY
            command: Some("opencode".to_string()),
            args: Some(vec!["acp".to_string()]), // ← ACP mode
            // ...
        },
        // ...
    })
    .await;
```

## Router Gating (Future Enhancement)

To prevent chat from ever routing to Terminal brains, add this check:

```rust
// In router.rs or session creation
if request_type == RequestType::Chat && profile.event_mode == Some(EventMode::Terminal) {
    return Err(anyhow!(
        "Cannot use Terminal brains for chat. \
         Use ACP or Jsonl mode instead."
    ));
}
```

## Migration Path

### For Existing CLI Integrations
1. Check if CLI supports `--output-format json` or `--json` flags
2. Update brain profile with `event_mode: Some(EventMode::Jsonl)`
3. Test with AcpProtocolDriver
4. If it works, you're done!
5. If not, keep as Terminal mode for now

### For New CLI Integrations
1. Check ACP Registry for native ACP support
2. If available: Use `event_mode: Some(EventMode::Acp)`
3. If not available: Try `event_mode: Some(EventMode::Jsonl)` with JSON flags
4. Last resort: `event_mode: Some(EventMode::Terminal)` (human only)

## Build & Test

```bash
# Build kernel
cargo build -p kernel --release

# Start kernel
./target/release/kernel

# Test brain profiles
curl http://localhost:3004/v1/brain/profiles \
  -H "Authorization: Bearer sk-a2r-dev-token-local"

# Should show all profiles with correct event_mode
```

## Key Design Principles

1. **ACP First**: ACP protocol is the PRIMARY integration method
2. **Pipes > PTY**: Use piped stdio for machine protocol, PTY only for humans
3. **Clean Events**: All brain output must be parseable into structured BrainEvents
4. **Driver Priority**: ACP driver registered first, checked first
5. **Explicit Modes**: Every brain profile must declare its event_mode

## References

- ACP Specification: https://agentclientprotocol.com/
- ACP Registry: https://agentclientprotocol.com/registry
- OpenCode ACP: `opencode acp`
- Claude Code JSONL: `claude --output-format stream-json`
