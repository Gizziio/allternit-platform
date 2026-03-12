# Gizzi Cowork CLI

Terminal interface for the Cowork Runtime - manage runs, schedules, approvals, and checkpoints.

## Overview

Cowork provides collaborative execution environments for agent runs with support for:
- **Local execution**: Docker, VM (Apple VF/Firecracker), or direct shell
- **Remote execution**: VPS via SSH
- **Cloud execution**: Managed cloud instances (Hetzner, AWS, etc.)

## Commands

### Run Management

#### `gizzi cowork list` (alias: `ls`)
List all runs with filtering options.

```bash
gizzi cowork list [options]
```

**Options:**
- `-s, --status <status>` - Filter by status (pending, running, completed, failed)
- `-m, --mode <mode>` - Filter by mode (local, remote, cloud)
- `-l, --limit <n>` - Maximum results (default: 20)
- `--format <format>` - Output format: table, json (default: table)

**Examples:**
```bash
gizzi cowork list
gizzi cowork list --status running --limit 10
gizzi cowork list -s pending,running --format json
```

---

#### `gizzi cowork start <name>` (alias: `new`)
Create and start a new run.

```bash
gizzi cowork start <name> [options]
```

**Options:**
- `-m, --mode <mode>` - Execution mode: local, remote, cloud (default: local)
- `-c, --command <cmd>` - Command to execute
- `-w, --working-dir <dir>` - Working directory
- `-a, --attach` - Auto-attach after starting
- `-e, --env <KEY=value>` - Environment variables (repeatable)

**Local Mode Options:**
- `--runtime <type>` - Runtime type: docker, vm, shell (default: shell)
- `--image <image>` - Docker image (for docker runtime)

**Remote Mode Options:**
- `--host <host>` - Remote host
- `--port <port>` - SSH port (default: 22)
- `--username <user>` - SSH username
- `--ssh-key <path>` - SSH private key path

**Cloud Mode Options:**
- `--provider <provider>` - Cloud provider: hetzner, aws, digitalocean
- `--region <region>` - Cloud region
- `--instance-type <type>` - Instance type (e.g., cx11, cpx11)
- `--storage-gb <size>` - Storage size in GB

**Examples:**
```bash
# Simple local shell execution
gizzi cowork start "Build Project" --command "cargo build --release"

# With environment variables and auto-attach
gizzi cowork start "Test Suite" \
  --command "npm test" \
  --env "NODE_ENV=production" \
  --env "CI=true" \
  --attach

# Docker execution
gizzi cowork start "Container Build" \
  --mode local \
  --runtime docker \
  --image node:18 \
  --command "npm run build"

# Remote execution
gizzi cowork start "Deploy" \
  --mode remote \
  --host prod.example.com \
  --username deploy \
  --ssh-key ~/.ssh/deploy_key \
  --command "./deploy.sh"

# Cloud execution
gizzi cowork start "Heavy Compute" \
  --mode cloud \
  --provider hetzner \
  --region fsn1 \
  --instance-type cpx31 \
  --command "python train_model.py"
```

---

#### `gizzi cowork attach <run-id>`
Attach to a running run and stream events/output.

```bash
gizzi cowork attach <run-id>
```

**Behavior:**
- Streams real-time output from the run
- Shows historical events first, then new events
- Press `Ctrl+C` to detach (run continues in background)
- Automatically reconnects on connection loss

**Example:**
```bash
gizzi cowork attach 550e8400
```

---

#### `gizzi cowork detach [run-id]`
Detach from a run (client-side only, run continues).

```bash
gizzi cowork detach [run-id]
```

**Note:** If `run-id` is not specified, detaches from the current session.

---

#### `gizzi cowork stop <run-id>` (aliases: `cancel`, `kill`)
Stop or cancel a run.

```bash
gizzi cowork stop <run-id> [options]
```

**Options:**
- `-f, --force` - Force immediate stop (SIGKILL)
- `--timeout <seconds>` - Timeout before force stop (default: 30)

**Examples:**
```bash
gizzi cowork stop 550e8400
gizzi cowork stop 550e8400 --force
gizzi cowork stop 550e8400 --timeout 60
```

---

#### `gizzi cowork show <run-id>` (alias: `info`)
Display detailed information about a run.

```bash
gizzi cowork show <run-id>
```

**Example:**
```bash
gizzi cowork show 550e8400
```

**Output:**
```
Run: Build Project
ID: 550e8400-e29b-41d4-a716-446655440000
Status: completed
Mode: local
Runtime: docker
Progress: 10/10
Created: 2024-01-15T10:30:00Z
Started: 2024-01-15T10:30:05Z
Completed: 2024-01-15T10:35:22Z
Duration: 5m 17s
```

---

#### `gizzi cowork logs <run-id>`
View logs for a run.

```bash
gizzi cowork logs <run-id> [options]
```

**Options:**
- `-f, --follow` - Follow log output (like tail -f)
- `-n, --lines <n>` - Number of lines to show (default: 100)
- `--since <timestamp>` - Show logs since timestamp (ISO 8601)

**Examples:**
```bash
gizzi cowork logs 550e8400
gizzi cowork logs 550e8400 --follow
gizzi cowork logs 550e8400 -n 50 --since "2024-01-15T10:00:00Z"
```

---

#### `gizzi cowork pause <run-id>`
Pause a running run.

```bash
gizzi cowork pause <run-id>
```

---

#### `gizzi cowork resume <run-id>`
Resume a paused run.

```bash
gizzi cowork resume <run-id>
```

---

### Schedule Management

#### `gizzi cowork schedule list` (alias: `ls`)
List all schedules.

```bash
gizzi cowork schedule list [options]
```

**Options:**
- `-e, --enabled` - Show only enabled schedules

---

#### `gizzi cowork schedule create <name>`
Create a new scheduled job.

```bash
gizzi cowork schedule create <name> [options]
```

**Options:**
- `-s, --schedule <expr>` - Cron expression or natural language (required)
- `-c, --command <cmd>` - Command to execute (required)
- `-w, --working-dir <dir>` - Working directory
- `-e, --enabled` - Enable immediately (default: true)
- `--mode <mode>` - Execution mode: local, remote, cloud (default: local)
- `--timezone <tz>` - Timezone (default: UTC)

**Schedule Expression Formats:**
- Cron: `"0 2 * * *"` (daily at 2 AM)
- Natural language: `"daily at 9am"`, `"every 30 minutes"`, `"mondays at 8pm"`

**Examples:**
```bash
# Daily backup with cron expression
gizzi cowork schedule create "Daily Backup" \
  --schedule "0 2 * * *" \
  --command "./backup.sh"

# Using natural language
gizzi cowork schedule create "Morning Report" \
  --schedule "daily at 9am" \
  --command "python generate_report.py" \
  --working-dir /path/to/project

# Weekly with timezone
gizzi cowork schedule create "Weekly Cleanup" \
  --schedule "sundays at 3am" \
  --command "docker system prune -f" \
  --timezone America/New_York
```

---

#### `gizzi cowork schedule enable <schedule-id>`
Enable a schedule.

```bash
gizzi cowork schedule enable <schedule-id>
```

---

#### `gizzi cowork schedule disable <schedule-id>`
Disable a schedule.

```bash
gizzi cowork schedule disable <schedule-id>
```

---

#### `gizzi cowork schedule delete <schedule-id>` (alias: `rm`)
Delete a schedule.

```bash
gizzi cowork schedule delete <schedule-id> [options]
```

**Options:**
- `-y, --yes` - Skip confirmation

---

#### `gizzi cowork schedule trigger <schedule-id>`
Manually trigger a schedule to run immediately.

```bash
gizzi cowork schedule trigger <schedule-id>
```

---

### Approval Management

#### `gizzi cowork approval list` (alias: `ls`)
List pending approval requests.

```bash
gizzi cowork approval list [options]
```

**Options:**
- `-r, --run-id <id>` - Filter by run ID
- `-a, --all` - Show all statuses (not just pending)

---

#### `gizzi cowork approval show <approval-id>` (alias: `info`)
Show approval request details.

```bash
gizzi cowork approval show <approval-id>
```

---

#### `gizzi cowork approval approve <approval-id>` (alias: `yes`)
Approve a pending request.

```bash
gizzi cowork approval approve <approval-id> [options]
```

**Options:**
- `-m, --message <msg>` - Optional approval message

---

#### `gizzi cowork approval deny <approval-id>` (aliases: `reject`, `no`)
Deny a pending request.

```bash
gizzi cowork approval deny <approval-id> [options]
```

**Options:**
- `-r, --reason <reason>` - Optional reason for denial

---

### Checkpoint Management

#### `gizzi cowork checkpoint list <run-id>` (alias: `ls`)
List checkpoints for a run.

```bash
gizzi cowork checkpoint list <run-id>
```

---

#### `gizzi cowork checkpoint create <run-id>`
Create a checkpoint (execution snapshot).

```bash
gizzi cowork checkpoint create <run-id> [options]
```

**Options:**
- `-n, --name <name>` - Checkpoint name
- `-d, --description <desc>` - Description

---

#### `gizzi cowork checkpoint restore <run-id> <checkpoint-id>`
Restore a run from a checkpoint.

```bash
gizzi cowork checkpoint restore <run-id> <checkpoint-id>
```

---

#### `gizzi cowork checkpoint delete <checkpoint-id>` (alias: `rm`)
Delete a checkpoint.

```bash
gizzi cowork checkpoint delete <checkpoint-id> [options]
```

**Options:**
- `-y, --yes` - Skip confirmation

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `A2R_API_URL` | Control Plane API URL | `http://localhost:3001` |
| `A2R_API_TOKEN` | Authentication token | - |
| `COWORK_DEFAULT_MODE` | Default execution mode | `local` |
| `COWORK_DEFAULT_RUNTIME` | Default local runtime | `shell` |

### Config File

`~/.config/gizzi/cowork.json`:

```json
{
  "api": {
    "url": "http://localhost:3001",
    "timeout": 30
  },
  "defaults": {
    "mode": "local",
    "runtime": "docker",
    "working_dir": "/home/user/projects"
  },
  "output": {
    "format": "table",
    "color": true
  }
}
```

---

## Examples

### Workflow Examples

**Development Workflow:**
```bash
# Start a development server in background
gizzi cowork start "Dev Server" --command "npm run dev" --attach

# In another terminal, check status
gizzi cowork list --status running

# View logs
gizzi cowork logs <run-id> --follow
```

**CI/CD Pipeline:**
```bash
# Create a run and wait for completion
RUN_ID=$(gizzi cowork start "Build" --command "make build" --format json | jq -r '.id')

# Poll for completion
while gizzi cowork show $RUN_ID | grep -q "running"; do
  sleep 5
done

# Check result
STATUS=$(gizzi cowork show $RUN_ID --format json | jq -r '.status')
if [ "$STATUS" = "completed" ]; then
  echo "Build succeeded"
else
  echo "Build failed"
  gizzi cowork logs $RUN_ID
  exit 1
fi
```

**Scheduled Maintenance:**
```bash
# Create a daily cleanup schedule
gizzi cowork schedule create "Daily Cleanup" \
  --schedule "0 3 * * *" \
  --command "docker system prune -f" \
  --mode local

# List all schedules
gizzi cowork schedule list
```

**Approval Workflow:**
```bash
# When a run needs approval, list pending requests
gizzi cowork approval list

# View details
gizzi cowork approval show <approval-id>

# Approve with message
gizzi cowork approval approve <approval-id> --message "Safe to proceed"

# Or deny
gizzi cowork approval deny <approval-id> --reason "Security concerns"
```

---

## Shell Aliases

Add to `.bashrc` or `.zshrc`:

```bash
# Cowork aliases
alias gcl='gizzi cowork list'
alias gcs='gizzi cowork start'
alias gca='gizzi cowork attach'
alias gclogs='gizzi cowork logs --follow'
alias gcstop='gizzi cowork stop'
alias gcshow='gizzi cowork show'
alias gcsched='gizzi cowork schedule'
alias gcapprove='gizzi cowork approval'
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | API connection error |
| 4 | Resource not found |
| 5 | Permission denied |
| 6 | Run failed |
| 7 | Timeout |

---

## See Also

- [API Reference](../../8-cloud/a2r-cloud-api/)
- [Architecture Documentation](../../COWORK_ARCHITECTURE_AUDIT.md)
- [Gizzi Code README](./README.md)
