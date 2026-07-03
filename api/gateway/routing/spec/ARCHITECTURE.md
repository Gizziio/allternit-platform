# Allternit Tools Gateway — Architecture

The `allternit-tools-gateway` crate at `api/gateway/routing/` is the IO/tools gateway: a standalone Axum service that is the only permitted path for executing side effects in Allternit.

---

## Responsibilities

- **Constitutional boundary** — Implements LAW-ONT-002: only this service may execute tools.
- **Policy gating** — Every tool execution is evaluated by the policy engine before dispatch.
- **Audit and replay** — Every request and result is journaled via the history ledger and emitted on the messaging event bus.
- **Sandboxing** — Local/subprocess tools run with a `WriteScope` that restricts filesystem access to the current run's artifact and receipt directories under `/.allternit/`.
- **Adapter routing** — Dispatches to local commands, HTTP endpoints, MCP servers, SDK executors, or subprocess workers.

---

## High-level flow

```
┌─────────────────┐      POST /v1/tools/execute      ┌──────────────────────┐
│  Kernel / DAK   │ ───────────────────────────────► │   IO Service         │
│   Runner        │                                  │  (Axum on :3510)     │
└─────────────────┘                                  └──────────┬───────────┘
                                                                │
                                                                ▼
                                                    ┌──────────────────────┐
                                                    │  ToolGateway::execute  │
                                                    │        _tool           │
                                                    └──────────┬───────────┘
                                                               │
           ┌─────────────────┬─────────────────┬───────────────┴───────────────┐
           ▼                 ▼                 ▼                               ▼
   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐           ┌───────────────┐
   Policy Engine   │ History Ledger │ Messaging Bus   │           Tool Adapters  │
   (evaluate)      │ (append)       │ (Pre/PostToolUse events)      (local/http/  │
   └───────────────┘ └───────────────┘ └───────────────┘           mcp/sdk/sub)  │
                                                                   └───────────────┘
```

---

## Components

### `src/main.rs`

Thin entry point. Initializes tracing, creates `IoServiceState`, builds the Axum router via `create_router`, and binds to `ALLTERNIT_IO_SERVICE_HOST:ALLTERNIT_IO_SERVICE_PORT` (default `127.0.0.1:3510`).

### `src/service.rs`

HTTP service layer:

- `IoServiceState` — shared Axum state holding `Arc<RwLock<ToolGateway>>`.
- `create_router` — Axum route table.
- Public request/response types for the REST surface (`HealthResponse`, `ExecuteToolRequest`, `ExecuteToolResponse`, `ToolError`).
- Handlers for `/health`, `/v1/tools/execute`, `GET /v1/tools`, and `POST /v1/tools`.

`IoServiceState::new()` bootstraps the in-memory policy engine, messaging system, and history ledger, and registers the `io-service` identity.

### `src/lib.rs`

Core library containing:

- `ToolGateway` — the execution engine.
- `ToolDefinition`, `ToolExecutionRequest`, `ToolExecutionResult`, `WriteScope`, resource-limit types.
- Tool adapters for local, HTTP, SDK, subprocess, and MCP tools.
- Default tool registration (`register_default_tools`).

### `src/mcp_bridge.rs`

MCP (Model Context Protocol) adapter:

- `McpToolBridge` — manages MCP server connections (stdio / SSE).
- `McpServerConfig`, `McpStdioConfig`, `McpSseConfig` — server configuration shapes.
- Wraps `mcp-client` so that MCP tool calls are subject to the same policy, audit, and receipt flow as native tools.

---

## Policy integration

- `IoServiceState` constructs an `allternit_policy::PolicyEngine` and registers the `io-service` service-account identity with the `io-executor` role and `tool:execute` permission.
- Before dispatch, `ToolGateway::execute_tool` builds a `PolicyRequest` with:
  - `identity_id`: `io-service`
  - `resource`: `tool:{tool_id}`
  - `action`: `execute`
  - `requested_tier`: the tool's `safety_tier`
- If the policy decision is `Deny`, execution is aborted and the error is propagated back to the REST caller.

See [`domains/governance/identity-access-control/policy-engine`](../../../../domains/governance/identity-access-control/policy-engine).

---

## History integration

- `IoServiceState` creates a `HistoryLedger` backed by `history.jsonl` inside the configured data directory.
- The policy engine appends `PolicyDecision` events to the ledger.
- `ToolGateway::execute_tool` appends the full `ToolExecutionResult` to the ledger after execution.
- This provides deterministic replay and audit trails per LAW-ONT-008.

See [`services/memory/data/history-ledger`](../../../../services/memory/data/history-ledger).

---

## Messaging integration

- `IoServiceState` creates an in-memory `MessagingSystem` with SQLite storage.
- `ToolGateway` publishes `PreToolUse` and `PostToolUse` event envelopes on the messaging event bus.
- These events include tool input, policy decision, execution result, trace ID, and run context.

See [`platform/protocols/communication/kernel-messaging`](../../../../platform/protocols/communication/kernel-messaging).

---

## Filesystem sandbox

- `WriteScope` defines `root` and `allowed_globs`.
- The REST handler derives the scope from `run_id`:
  - `/.allternit/artifacts/{run_id}/**`
  - `/.allternit/receipts/{run_id}/**`
- `ToolGateway::execute_tool` validates that:
  - the root is under `/.allternit/`
  - allowed globs are under the root
  - no glob targets denied paths or another run's receipts
  - the tool's declared `FilesystemAccess` permits the requested scope

---

## Idempotency

- Side-effecting tools MUST provide an `idempotency_key` (supplied by `correlation_id` from the REST request).
- The history ledger enables replay: the same inputs + idempotency key should yield the same result.

---

## Testing

Integration tests live in [`../tests/`](../tests/) and use `axum::extract::Request` with `tower::ServiceExt::oneshot` against the real `create_router` app. See `tests/common/mod.rs` for the test helper.

---

## Standalone service layout

```
api/gateway/routing/
├── Cargo.toml              # crate manifest
├── README.md               # user-facing overview
├── src/
│   ├── main.rs             # server entry point
│   ├── service.rs          # HTTP handlers and router
│   ├── lib.rs              # ToolGateway core
│   ├── mcp_bridge.rs       # MCP adapter
│   ├── gui_tools.rs        # (orphan source, not currently compiled)
│   └── browser_recording_tools.rs  # (orphan source, not currently compiled)
├── spec/
│   ├── API.md              # public REST API
│   └── ARCHITECTURE.md     # this file
├── schemas/                # JSON schemas for request/response bodies
└── tests/                  # integration tests
```

The `routing/routing/` subdirectory contains legacy `.db` / `.jsonl` data files that are already ignored by `.gitignore`.
