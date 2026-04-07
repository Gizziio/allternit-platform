# A2R IO Service

**The ONLY Permitted Side-Effect Path in A2R**

Implements SYSTEM_LAW.md:
- **LAW-ONT-002**: Only IO can execute side effects
- **LAW-ONT-003**: Deterministic execution with policy enforcement
- **LAW-ONT-008**: IO Idempotency & Replay

---

## Purpose

The IO Service is the constitutional boundary for all side-effect execution in A2R. No other service may execute tools, write files, make network calls, or perform any IO operations.

**Ontology Compliance:**
```
┌─────────────────┐     ┌─────────────────┐
│  Kernel Service │────►│   IO Service    │
│  (pure logic)   │     │  (side effects) │
└─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
   Deterministic           Policy-gated
   decisions               execution
```

---

## Features

- ✅ Sandboxed tool execution (local, MCP, HTTP, subprocess)
- ✅ IO capture and logging (all inputs/outputs logged)
- ✅ Policy enforcement BEFORE execution (LAW-ONT-002)
- ✅ Resource isolation and limits
- ✅ Execution telemetry and audit trails
- ✅ Retry and backoff mechanisms
- ✅ Idempotency support (LAW-ONT-008)

---

## Architecture

### Components

| Component | Purpose |
|-----------|---------|
| **Gateway** | Main entry point for tool execution |
| **Sandbox** | Isolated execution environment |
| **IO Capture** | Input/output logging and monitoring |
| **Policy Client** | Integration with policy engine |
| **Rate Limits** | Execution throttling and quotas |
| **Adapters** | Local, MCP, HTTP tool adapters |

### Tool Types

```rust
pub enum ToolType {
    Local,      // Local command execution
    Http,       // HTTP API calls
    Mpc,        // MCP (Model Context Protocol)
    Sdk,        // SDK-based tools
    Subprocess, // Subprocess execution
}
```

---

## API Endpoints

### Health

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "a2r-io-service",
  "version": "0.1.0",
  "ontology_compliance": true
}
```

### Tool Execution

```bash
POST /v1/tools/execute
```

Request:
```json
{
  "tool_id": "fs.read",
  "input": {"path": "/path/to/file"},
  "correlation_id": "corr_abc123",
  "run_id": "run_xyz789",
  "wih_id": "wih_456"
}
```

Response:
```json
{
  "success": true,
  "output": {"content": "..."},
  "error": null,
  "io_captured": true,
  "policy_enforced": true
}
```

### Tool Registry

```bash
GET  /v1/tools              # List all tools
GET  /v1/tools/:tool_id     # Get tool definition
POST /v1/tools              # Register new tool
```

### Worker Registry

```bash
GET  /v1/workers            # List all workers
GET  /v1/workers/:id        # Get worker definition
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLTERNIT_IO_SERVICE_HOST` | `127.0.0.1` | Bind host (internal only) |
| `ALLTERNIT_IO_SERVICE_PORT` | `3510` | Bind port |
| `ALLTERNIT_POLICY_URL` | `http://127.0.0.1:3003` | Policy service URL |
| `ALLTERNIT_HISTORY_URL` | `http://127.0.0.1:3200` | History service URL |

### Port Assignment

**Port 3510** - Documented in `ARCHITECTURE.md` service table

---

## Ontology Compliance

### LAW-ONT-002: Only IO Executes Side Effects

All side effects MUST flow through this service:

```
┌─────────────────────────────────────────────────────────┐
│                    A2R System                            │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ DAK Runner   │───►│ Kernel Svc   │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                              │                           │
│                              ▼                           │
│                    ┌─────────────────┐                   │
│                    │   IO Service    │◄─── LAW-ONT-002   │
│                    │   (Port 3510)   │                   │
│                    └─────────────────┘                   │
│                              │                           │
│                              ▼                           │
│                    ┌─────────────────┐                   │
│                    │  Tool Gateway   │                   │
│                    │  (Sandboxed)    │                   │
│                    └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### LAW-ONT-008: IO Idempotency & Replay

All IO operations support:
- Idempotency keys (via `correlation_id`)
- Replay from journal
- Deterministic execution (same inputs → same outputs)

---

## Development

### Build

```bash
cd services/io-service
cargo build --bin a2r-io-service
```

### Run

```bash
cargo run --bin a2r-io-service
```

### Test

```bash
cargo test
```

---

## Integration

### From Kernel Service

```rust
// Kernel Service calls IO Service via HTTP
let client = reqwest::Client::new();
let response = client
    .post("http://127.0.0.1:3510/v1/tools/execute")
    .json(&ExecuteToolRequest {
        tool_id: "fs.read".to_string(),
        input: json!({"path": "/path"}),
        correlation_id: corr_id,
        run_id: run_id,
        wih_id: wih_id,
    })
    .send()
    .await?;
```

### From DAK Runner

```typescript
// DAK Runner calls IO Service via HTTP adapter
const response = await axios.post(
  'http://127.0.0.1:3510/v1/tools/execute',
  {
    tool_id: 'fs.read',
    input: { path: '/path' },
    correlation_id: corr_id,
    run_id: run_id,
    wih_id: wih_id,
  }
);
```

---

## Startup Configuration

Add to `.a2r/services.json`:

```json
{
  "services": [
    {
      "id": "io-service",
      "command": "a2r-io-service",
      "port": 3510,
      "host": "127.0.0.1",
      "dependencies": ["policy-service", "history-service"]
    }
  ]
}
```

---

## License

MIT
