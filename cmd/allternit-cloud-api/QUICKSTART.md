# Cowork Runtime Quick Start

Get started with the Cowork Runtime in 5 minutes.

---

## Prerequisites

- Rust toolchain (1.70+)
- SQLite (or Postgres for production)
- A2R CLI (optional, for client access)

---

## 1. Start the Control Plane

The Control Plane is the central API server for the Cowork Runtime.

```bash
# From the a2rchitech workspace root
cargo run -p a2r-cloud-api
```

The API server starts on `http://localhost:8080` by default.

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | `./data/api.db` | Database connection string |
| `RUST_LOG` | `info` | Log level |

---

## 2. Verify Installation

Check that the API is running:

```bash
curl http://localhost:8080/health
```

Expected response:

```json
{"status": "ok"}
```

---

## 3. Create Your First Run

### Using curl

```bash
# Create a run
curl -X POST http://localhost:8080/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hello World",
    "mode": "local",
    "config": {
      "command": "echo",
      "args": ["Hello from Cowork Runtime!"]
    },
    "auto_start": true
  }'
```

### Using the Gizzi CLI

```bash
# Create and start a run
gizzi cowork start "Hello World" --mode local --command "echo Hello!"

# List runs
gizzi cowork list

# Get run details (use the ID from the list)
gizzi cowork show <run-id>
```

---

## 4. Attach to a Run

Watch a run's output in real-time:

### Using curl (SSE stream)

```bash
curl -N http://localhost:8080/api/v1/runs/{run-id}/events/stream
```

### Using the CLI

```bash
gizzi cowork attach <run-id>
```

Press `Ctrl+C` to detach (the run continues in the background).

---

## 5. Schedule a Recurring Job

### Using curl

```bash
# Create a schedule that runs daily at 2 AM
curl -X POST http://localhost:8080/api/v1/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Backup",
    "cron_expr": "0 2 * * *",
    "natural_lang": "daily at 2am",
    "job_template": {
      "command": "./backup.sh",
      "working_dir": "/app"
    },
    "enabled": true
  }'
```

### Using the CLI

```bash
# Create a schedule
gizzi cowork schedule create "Daily Backup" \
  --schedule "0 2 * * *" \
  --command "./backup.sh"

# List schedules
gizzi cowork schedule list

# Trigger immediately
gizzi cowork schedule trigger <schedule-id>

# Disable/Enable
gizzi cowork schedule disable <schedule-id>
gizzi cowork schedule enable <schedule-id>
```

---

## 6. Work with Approvals

When a run needs human approval:

### List pending approvals

```bash
# Using curl
curl "http://localhost:8080/api/v1/approvals?status=pending"

# Using CLI
gizzi cowork approval list
```

### Approve or deny

```bash
# Approve
gizzi cowork approval approve <approval-id> --message "Looks good!"

# Deny
gizzi cowork approval deny <approval-id> --reason "Need more testing"
```

---

## 7. Common Workflows

### Run a Local Script

```bash
gizzi cowork start "Data Processing" \
  --mode local \
  --command "python process_data.py" \
  --working-dir /path/to/project \
  --env "INPUT_FILE=data.csv" \
  --attach
```

### Monitor a Long-Running Run

```bash
# Start detached
gizzi cowork start "Long Task" --command "./long-task.sh"

# Check status later
gizzi cowork list --status running

# View logs
gizzi cowork logs <run-id> --follow

# Stop if needed
gizzi cowork stop <run-id>
```

### Pause and Resume

```bash
# Pause a running run
gizzi cowork pause <run-id>

# Resume when ready
gizzi cowork resume <run-id>
```

---

## 8. Web UI Access

The Control Plane includes a built-in web UI for visual run management:

```
http://localhost:8080/ui
```

Features:
- Run list with status indicators
- Real-time log streaming
- Approval management
- Schedule configuration

---

## Next Steps

- Read the full [API Reference](./API.md)
- Check the [CLI Guide](../../7-apps/cli/COWORK.md)
- Review the [System Architecture](../../COWORK_ARCHITECTURE.md)
- Explore [examples](./examples/)

---

## Troubleshooting

### Port already in use

```bash
# Use a different port
PORT=8081 cargo run -p a2r-cloud-api
```

### Database locked

The default SQLite database is in `./data/api.db`. For concurrent access:

```bash
# Use Postgres in production
DATABASE_URL="postgres://user:pass@localhost/cowork" cargo run -p a2r-cloud-api
```

### Run won't start

Check the run's events for error details:

```bash
curl http://localhost:8080/api/v1/runs/{run-id}/events
```

---

## Configuration

Create a `.env` file in your project root:

```bash
# Server configuration
PORT=8080
HOST=0.0.0.0

# Database
DATABASE_URL=./data/api.db

# Runtime paths
LOCAL_RUNTIME_SOCKET=/var/run/a2r-runtime.sock

# Logging
RUST_LOG=info,a2r_cloud_api=debug

# Features
ENABLE_APPROVALS=true
DEFAULT_APPROVAL_TIMEOUT=300
```
