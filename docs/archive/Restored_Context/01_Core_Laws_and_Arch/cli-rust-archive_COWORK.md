# Gizzi Cowork CLI Guide

Complete reference for the `gizzi cowork` command-line interface.

---

## Overview

The Cowork CLI provides terminal access to the Cowork Runtime system for managing runs, schedules, and approvals.

```
gizzi cowork [COMMAND] [OPTIONS]
```

---

## Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help information |
| `--version` | Show version information |

---

## Commands

### `list` (alias: `ls`)

List all runs with optional filtering.

```bash
gizzi cowork list [OPTIONS]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--status` | `-s` | Filter by status (comma-separated) |
| `--mode` | `-m` | Filter by mode: local, remote, cloud |
| `--limit` | `-l` | Maximum results (default: 20) |

**Examples:**

```bash
# List all runs
gizzi cowork list

# List only running runs
gizzi cowork list --status running

# List local runs, max 10
gizzi cowork list --mode local --limit 10

# List pending and running runs
gizzi cowork list -s pending,running
```

**Output:**

```
ID                                   NAME                 MODE       STATUS       PROGRESS   CREATED             
----------------------------------------------------------------------------------------------------
550e8400-e29b-41d4-a716-446655440000 Build Project        local      running      5/10       2024-01-15 10:30:00 
6ba7b810-9dad-11d1-80b4-00c04fd430c8 Test Suite           remote     completed    50/50      2024-01-15 09:00:00 

Showing 2 run(s)
```

---

### `start` (alias: `new`)

Create and start a new run.

```bash
gizzi cowork start <NAME> [OPTIONS]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `NAME` | Name for the run (required) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--mode` | `-m` | Execution mode: local, remote, cloud (default: local) |
| `--command` | `-c` | Command to execute |
| `--working-dir` | `-w` | Working directory |
| `--attach` | `-a` | Auto-attach after starting |
| `--env` | `-e` | Environment variables (KEY=value, can be repeated) |

**Examples:**

```bash
# Simple local run
gizzi cowork start "My Script" --command "./script.sh"

# With environment variables
gizzi cowork start "Build" \
  --command "cargo build --release" \
  --env "RUST_LOG=info" \
  --env "CARGO_NET_OFFLINE=true"

# Auto-attach for real-time output
gizzi cowork start "Server" \
  --command "npm start" \
  --working-dir /path/to/app \
  --attach

# Remote execution
gizzi cowork start "Deploy" \
  --mode remote \
  --command "./deploy.sh production"
```

---

### `attach`

Attach to a running run and stream events.

```bash
gizzi cowork attach <RUN_ID>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `RUN_ID` | Run ID (full or first 8 characters) |

**Behavior:**
- Streams real-time output from the run
- Shows historical events first, then new events
- Press `Ctrl+C` to detach (run continues)

**Example:**

```bash
gizzi cowork attach 550e8400
```

**Output:**

```
Attaching to run: Build Project (550e8400)
Status: running

Press Ctrl+C to detach (run will continue in background)

[STEP] Starting: Compile dependencies
[STEP] Completed: Compile dependencies
[STEP] Starting: Build main binary
```

---

### `detach`

Detach from a run (client-side only).

```bash
gizzi cowork detach [RUN_ID]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `RUN_ID` | Optional run ID (uses current if not specified) |

---

### `stop` (aliases: `stop`, `kill`)

Stop or cancel a run.

```bash
gizzi cowork stop <RUN_ID> [OPTIONS]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `RUN_ID` | Run ID to stop |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-f` | Force immediate stop |

**Example:**

```bash
gizzi cowork stop 550e8400
gizzi cowork stop 550e8400 --force
```

---

### `logs`

View logs for a run.

```bash
gizzi cowork logs <RUN_ID> [OPTIONS]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `RUN_ID` | Run ID to view logs for |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--follow` | `-f` | Follow log output (like tail -f) |
| `--lines` | `-n` | Number of lines to show (default: 100) |
| `--since` | | Show logs since timestamp |

**Examples:**

```bash
# Show last 100 lines
gizzi cowork logs 550e8400

# Show last 50 lines and follow
gizzi cowork logs 550e8400 -n 50 -f

# Show all logs since specific time
gizzi cowork logs 550e8400 --since "2024-01-15T10:00:00Z"
```

---

### `show` (alias: `info`)

Display detailed information about a run.

```bash
gizzi cowork show <RUN_ID>
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
Progress: 10/10
Created: 2024-01-15T10:30:00Z
Started: 2024-01-15T10:30:05Z
Completed: 2024-01-15T10:35:22Z
```

---

### `pause`

Pause a running run.

```bash
gizzi cowork pause <RUN_ID>
```

**Example:**

```bash
gizzi cowork pause 550e8400
```

---

### `resume`

Resume a paused run.

```bash
gizzi cowork resume <RUN_ID>
```

**Example:**

```bash
gizzi cowork resume 550e8400
```

---

## Schedule Commands

### `schedule list` (alias: `schedule ls`)

List all schedules.

```bash
gizzi cowork schedule list [OPTIONS]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--enabled` | `-e` | Show only enabled schedules |

**Example:**

```bash
gizzi cowork schedule list
gizzi cowork schedule list --enabled
```

**Output:**

```
ID                                   NAME                 ENABLED  NEXT RUN            SCHEDULE             
--------------------------------------------------------------------------------------------------------------
6ba7b810-9dad-11d1-80b4-00c04fd430c8 Daily Backup         ✓        2024-01-16 02:00    daily at 2am         
550e8400-e29b-41d4-a716-446655440000 Weekly Report        ✗        -                   0 9 * * 1            

Showing 2 schedule(s)
```

---

### `schedule create`

Create a new schedule.

```bash
gizzi cowork schedule create <NAME> [OPTIONS]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `NAME` | Schedule name (required) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--schedule` | `-s` | Cron expression or natural language (required) |
| `--command` | `-c` | Command to execute (required) |
| `--working-dir` | `-w` | Working directory |
| `--enabled` | `-e` | Enable immediately (default: true) |

**Examples:**

```bash
# Daily at 2 AM
gizzi cowork schedule create "Daily Backup" \
  --schedule "0 2 * * *" \
  --command "./backup.sh"

# Using natural language
gizzi cowork schedule create "Morning Report" \
  --schedule "daily at 9am" \
  --command "python generate_report.py"

# With working directory
gizzi cowork schedule create "Nightly Build" \
  --schedule "0 0 * * *" \
  --command "cargo build --release" \
  --working-dir /path/to/project
```

---

### `schedule enable`

Enable a schedule.

```bash
gizzi cowork schedule enable <SCHEDULE_ID>
```

---

### `schedule disable`

Disable a schedule.

```bash
gizzi cowork schedule disable <SCHEDULE_ID>
```

---

### `schedule delete` (alias: `schedule rm`)

Delete a schedule.

```bash
gizzi cowork schedule delete <SCHEDULE_ID> [OPTIONS]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--yes` | `-y` | Skip confirmation |

**Example:**

```bash
gizzi cowork schedule delete 6ba7b810
gizzi cowork schedule delete 6ba7b810 --yes
```

---

### `schedule trigger`

Manually trigger a schedule to run immediately.

```bash
gizzi cowork schedule trigger <SCHEDULE_ID>
```

**Example:**

```bash
gizzi cowork schedule trigger 6ba7b810
```

---

## Approval Commands

### `approval list` (alias: `approval ls`)

List approval requests.

```bash
gizzi cowork approval list [OPTIONS]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--run-id` | `-r` | Filter by run ID |
| `--all` | `-a` | Show all statuses (not just pending) |

**Example:**

```bash
# List pending approvals
gizzi cowork approval list

# List all approvals for a run
gizzi cowork approval list --run-id 550e8400 --all
```

**Output:**

```
ID                                   STATUS  PRIORITY   TITLE                ACTION      
------------------------------------------------------------------------------------------------
6ba7b810-9dad-11d1-80b4-00c04fd430c8 ⏳       high       Delete temp files    file_delete 
550e8400-e29b-41d4-a716-446655440000 ⏳       normal     Install package      package_install 

Showing 2 approval(s)
```

---

### `approval show` (alias: `approval info`)

Show detailed information about an approval request.

```bash
gizzi cowork approval show <APPROVAL_ID>
```

**Example:**

```bash
gizzi cowork approval show 6ba7b810
```

---

### `approval approve` (alias: `approval yes`)

Approve a pending request.

```bash
gizzi cowork approve <APPROVAL_ID> [OPTIONS]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Optional approval message |

**Example:**

```bash
gizzi cowork approval approve 6ba7b810
gizzi cowork approval approve 6ba7b810 --message "Safe to delete"
```

---

### `approval deny` (aliases: `approval reject`, `approval no`)

Deny a pending request.

```bash
gizzi cowork approval deny <APPROVAL_ID> [OPTIONS]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--reason` | `-r` | Optional reason for denial |

**Example:**

```bash
gizzi cowork approval deny 6ba7b810
gizzi cowork approval deny 6ba7b810 --reason "Keep files for now"
```

---

## Configuration

The CLI reads configuration from:

1. Environment variables
2. `~/.config/gizzi/config.toml`
3. Command-line flags

### Config File Example

```toml
[api]
url = "http://localhost:8080"
timeout = 30

[output]
format = "table"  # or "json"
color = true

[runtime]
default_mode = "local"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ALLTERNIT_API_URL` | Control Plane API URL |
| `ALLTERNIT_API_TOKEN` | Authentication token |

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

---

## Tips and Tricks

### Shell Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
alias gcl='gizzi cowork list'
alias gcs='gizzi cowork start'
alias gca='gizzi cowork attach'
alias gclogs='gizzi cowork logs --follow'
```

### Watch Mode

Combine with `watch` for live monitoring:

```bash
# Watch running runs
watch -n 2 'gizzi cowork list --status running'

# Watch pending approvals
watch -n 5 'gizzi cowork approval list'
```

### JSON Output for Scripting

```bash
# Get run ID for scripting
RUN_ID=$(gizzi cowork start "Build" -c "make" --mode local | grep "Run created" | awk '{print $4}')

# Wait for completion
while gizzi cowork show $RUN_ID | grep -q "running"; do
  sleep 5
done
```

---

## See Also

- [API Reference](../../cloud/allternit-cloud-api/API.md)
- [Quick Start Guide](../../cloud/allternit-cloud-api/QUICKSTART.md)
- [System Architecture](../../COWORK_ARCHITECTURE.md)
