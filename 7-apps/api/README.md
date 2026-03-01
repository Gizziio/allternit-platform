# A2rchitech API

Thin HTTP adapter over `packages/orchestration/control-plane-service` with comprehensive observability.

## Features

- **RESTful API**: Clean, versioned endpoints for all platform capabilities
- **Comprehensive Observability**: Prometheus metrics and structured tracing
- **Real-time Events**: SSE and WebSocket streams for live updates
- **Multi-tenancy**: Built-in tenant isolation and access controls
- **Scalable Architecture**: Designed for horizontal scaling

## Endpoints

### Health
- `GET /health` -> `{ "status": "ok" }`

### Workflows
- `POST /api/workflows/validate` -> `{ yaml, tenant_id? }`
- `POST /api/workflows/compile` -> `{ yaml, tenant_id? }`

### Events
- `GET /api/events/stream?event_type=...` -> SSE stream of events
- `GET /api/events/ws?event_type=...` -> WebSocket stream of events

### Registry
- `GET /api/registry/tenant/:tenant_id/capabilities` -> tenant capabilities
- `GET /api/registry/tenant/:tenant_id/summary` -> capability summary
- `POST /api/registry/capabilities/search` -> `{ query, limit? }`
- `POST /api/registry/agents` -> `AgentDefinition` JSON
- `GET /api/registry/agents/:id`
- `POST /api/registry/skills` -> `Skill` JSON
- `GET /api/registry/skills/:id`
- `POST /api/registry/tools` -> `ToolDefinition` JSON
- `GET /api/registry/tools/:id`

### Capsules
- `GET /api/capsules` -> list capsule IDs
- `POST /api/capsules` -> raw capsule bundle bytes (`application/octet-stream`)
- `GET /api/capsules/:id` -> capsule manifest (latest or `id@version`)
- `GET /api/capsules/:id/verify` -> signature + hash verification
- `POST /api/capsules/:id/execute` -> not yet implemented

### Sessions
- `GET /api/sessions` -> list active sessions
- `GET /api/sessions/:id` -> get specific session details

### Terminal Sessions
- `GET /api/terminal/sessions` -> list active terminal sessions
- `POST /api/terminal/sessions` -> create a new terminal session
- `GET /api/terminal/sessions/:id` -> get specific terminal session details
- `DELETE /api/terminal/sessions/:id` -> delete a terminal session
- `GET /api/terminal/session/:session_id` -> WebSocket endpoint for terminal session connection

### Observability
- `GET /metrics` -> Prometheus metrics in text format

## Observability

### Metrics
The API exposes the following Prometheus metrics:

- `api_requests_total` - Total number of API requests
- `api_requests_success_total` - Total number of successful API requests
- `api_requests_failed_total` - Total number of failed API requests
- `api_request_duration_seconds` - Request duration histogram
- `api_active_requests` - Currently active API requests
- `cloud_runner_executions_total` - Total number of execution requests (from cloud-runner)
- `cloud_runner_executions_success_total` - Total number of successful executions
- `cloud_runner_executions_failed_total` - Total number of failed executions
- `cloud_runner_execution_duration_seconds` - Execution time histogram
- `cloud_runner_active_executions` - Currently active executions
- `cloud_runner_memory_allocated_mb` - Memory allocated in MB
- `cloud_runner_cpu_allocated_cores` - CPU cores allocated
- `scheduler_queue_size` - Number of pending executions in queue
- `terminal_sessions_total` - Total number of terminal sessions created
- `terminal_sessions_active` - Currently active terminal sessions
- `terminal_session_duration_seconds` - Terminal session duration histogram
- `terminal_websocket_connections` - Active WebSocket connections to terminal sessions

### Tracing
The API includes structured tracing spans for:
- Request lifecycle tracking
- Workflow validation and compilation
- Capsule operations
- Registry operations
- Cloud runner execution flows
- Terminal session management
- WebSocket terminal connections

## Environment
- `A2RCHITECH_API_BIND` (default `0.0.0.0:3000`)
- `A2RCHITECH_LEDGER_PATH` (default `./a2rchitech.jsonl`)
- `A2RCHITECH_DB_PATH` (default `./a2rchitech.db`)
- `A2RCHITECH_API_IDENTITY` (default `api-service`)
- `A2RCHITECH_API_TENANT` (default `default`)
- `A2RCHITECH_API_BOOTSTRAP_POLICY` (default `true`)
- `A2RCHITECH_API_POLICY_ENFORCE` (default `true`)

## API Versioning
The API supports versioned endpoints under `/api/v1/` with backward compatibility for non-versioned routes.
