# Allternit Tools Gateway — Public API

The IO/tools gateway is the constitutional boundary for all side-effect execution in Allternit. Every tool call that performs IO, invokes an external system, or mutates state MUST go through this service.

- **Base URL:** `http://127.0.0.1:3510`
- **Content type:** `application/json`
- **CORS / tracing:** Enabled via `tower-http`.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service health and ontology compliance |
| `POST` | `/v1/tools/execute` | Execute a registered tool (LAW-ONT-002) |
| `GET`  | `/v1/tools` | List registered tools |
| `POST` | `/v1/tools` | Register a new tool |

---

## `GET /health`

Returns the service status and declares ontology compliance.

### Response

```json
{
  "status": "ok",
  "service": "allternit-io-service",
  "version": "0.1.0",
  "ontology_compliance": true
}
```

**Schema:** [`schemas/health-response.json`](../schemas/health-response.json)

---

## `POST /v1/tools/execute`

The only permitted path for side-effect execution. The gateway enforces policy, captures IO, writes receipts, and dispatches to the appropriate adapter (local, HTTP, MCP, SDK, subprocess).

### Request body

```json
{
  "tool_id": "fs.read",
  "input": { "path": "/.allternit/artifacts/run_123/meta.json" },
  "correlation_id": "corr_abc123",
  "run_id": "run_xyz789",
  "wih_id": "wih_456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool_id` | string | yes | Registered tool identifier |
| `input` | object | yes | Tool-specific input payload |
| `correlation_id` | string | yes | Idempotency / trace correlation key |
| `run_id` | string | yes | Run scope used for filesystem isolation |
| `wih_id` | string | yes | Workflow invocation handle context |

**Schema:** [`schemas/execute-tool-request.json`](../schemas/execute-tool-request.json)

### Response body

```json
{
  "success": true,
  "output": { "content": "..." },
  "error": null,
  "io_captured": true,
  "policy_enforced": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` when execution completed without error |
| `output` | object / null | Tool output, when successful |
| `error` | object / null | Error code, message, and optional details |
| `io_captured` | boolean | Whether the call was journaled |
| `policy_enforced` | boolean | Whether policy was evaluated |

**Schema:** [`schemas/execute-tool-response.json`](../schemas/execute-tool-response.json)

### Error shape

```json
{
  "code": "TOOL_EXECUTION_FAILED",
  "message": "Tool not found: fs.read",
  "details": null
}
```

### Notes

- The handler maps the public request to an internal [`ToolExecutionRequest`](../schemas/tool-execution-request.json) with fixed `identity_id="io-service"`, `workflow_id="io-execution"`, and `node_id="io-node"`.
- The write scope is automatically derived from `run_id` and restricted to `/.allternit/artifacts/{run_id}/**` and `/.allternit/receipts/{run_id}/**`.
- Policy evaluation happens inside `ToolGateway::execute_tool`. If policy denies, `success` is `false`, `policy_enforced` is `false`, and `error` contains the reason.

---

## `GET /v1/tools`

Returns the list of registered tools.

### Response

```json
[]
```

> **Current behavior:** the handler returns an empty array. `ToolGateway::list_tools()` exists and can be wired in when the registry surface is expanded.

---

## `POST /v1/tools`

Register a new tool definition with the gateway.

### Request body

A [`ToolDefinition`](../schemas/tool-definition.json) object. Example:

```json
{
  "id": "echo.test",
  "name": "Echo Test Tool",
  "description": "Returns the input unchanged",
  "tool_type": "Local",
  "command": "echo",
  "endpoint": "",
  "input_schema": { "type": "object" },
  "output_schema": { "type": "object" },
  "side_effects": [],
  "idempotency_behavior": "idempotent",
  "retryable": false,
  "failure_classification": "transient",
  "safety_tier": "T0",
  "resource_limits": {
    "cpu": null,
    "memory": null,
    "network": "None",
    "filesystem": "None",
    "time_limit": 30
  },
  "subprocess": null
}
```

### Response

- `201 Created` — body: `Tool registered: {tool_id}`
- `500 Internal Server Error` — body: `Failed to register tool: {reason}`

---

## Tool types

| Variant | Adapter |
|---------|---------|
| `Local` | Local command via `tokio::process::Command` |
| `Http` | HTTP client via `reqwest` |
| `Mcp` | MCP tool bridge (`src/mcp_bridge.rs`) |
| `Sdk` | In-process SDK executor trait |
| `Subprocess` | Worker subprocess with scoped filesystem policy |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLTERNIT_IO_SERVICE_HOST` | `127.0.0.1` | Bind host (internal only) |
| `ALLTERNIT_IO_SERVICE_PORT` | `3510` | Bind port |

---

## Schemas

JSON Schema files for all request/response bodies live in [`../schemas/`](../schemas/).
