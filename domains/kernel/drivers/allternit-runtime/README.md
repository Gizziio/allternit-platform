# Allternit Runtime Brain (MBR)

Minimal Viable Runtime Brain - a deterministic per-session execution engine.

## Purpose

The Runtime Brain orchestrates the agentic conversation loop:

```
prompt → stream deltas → detect tool call(s) → execute tool(s) → 
send tool result(s) → continue streaming → final completion
```

With **explicit state transitions** and **contract enforcement**.

## Architecture

### State Machine

```rust
Idle → Initializing → Ready → AwaitingModel → Streaming → Completed
                          ↓
                   AwaitingToolExecution → ExecutingTool → (back to AwaitingModel)
```

All transitions are **guarded** - invalid transitions panic in debug, return error in release.

### Key Components

| Module | Purpose |
|--------|---------|
| `state` | `SessionState` enum + guarded transitions |
| `events` | `RuntimeEvent` inputs that drive transitions |
| `provider` | `ProviderRuntime` trait for LLM providers |
| `tools` | `ToolExecutor` trait for tool execution |
| `runtime` | `SessionRuntime` - the main orchestration loop |

## Usage

```rust
use allternit_runtime::*;

// Create runtime with fake provider (for testing)
let provider = FakeProviderRuntime::new();
let tools = EchoToolExecutor::new();
let runtime = SessionRuntime::new(provider, tools);

// Run a prompt
let config = ProviderSessionConfig { /* ... */ };
let transcript = runtime.run(config, "Hello, use echo tool".to_string()).await;

// Inspect results
println!("Deltas: {:?}", transcript.deltas);
println!("Tool calls: {:?}", transcript.tool_calls);
println!("State transitions: {:?}", transcript.transitions);
```

## Running Tests

```bash
cargo test -p allternit-runtime
```

Required tests (6):
1. Valid transition sequence (happy path)
2. Invalid transition triggers error/panic
3. ToolCall triggers ToolExecutor execution
4. Multiple tool calls handled sequentially
5. Provider error transitions to Failed
6. Deterministic transcript matches golden

## Demo

See kernel-service integration at:
```
POST /v1/runtime/demo/run
Body: { "prompt": "hello, call echo tool with hi" }
```

## Contract

The MBR guarantees:
- **Deterministic**: Same inputs → Same transcript (no timestamps)
- **Explicit**: All state transitions are explicit and guarded
- **Observable**: Complete transcript of everything that happened
- **Minimal**: No supervisor, no failover, no circuit breaker (post-MBR)
