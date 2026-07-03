# allternit-workspace-service

Team workspace service for Allternit. Manages terminal sessions, panes, and the
in-process team skills registry used by cowork workspaces and the gizzi
bundled-skills loader.

## Scope

- **Sessions** — logical terminal sessions (tmux-like) tied to a workspace.
- **Panes** — splits inside a session with captured output buffers.
- **Skills Registry** — per-workspace catalog of agent skills.

This service is consumed by `rails-service/workspace/client.rs` on port `3021`.
A production deployment would persist sessions to Redis or SQLite; the current
implementation stores everything in memory.

## Running

```bash
# Start on the default port 3021
cargo run -p allternit-workspace-service

# Override bind address/port
HOST=0.0.0.0 PORT=3021 cargo run -p allternit-workspace-service
```

## API Endpoints

### Health

```bash
GET /health
```

Response:

```json
{
  "status": "ok",
  "sessions": 0,
  "panes": 0,
  "skills": 0
}
```

### Sessions

Create a session:

```bash
POST /sessions
{
  "name": "my-session",
  "working_dir": "/home/user/project",
  "env": { "FOO": "bar" },
  "metadata": { "owner": "agent-1" },
  "workspace_id": "ws-123"
}
```

Get a session:

```bash
GET /sessions/:id
```

Delete a session and its panes:

```bash
DELETE /sessions/:id
```

### Panes

Create a pane in a session:

```bash
POST /sessions/:id/panes
{
  "name": "main",
  "command": "bash",
  "metadata": { "agent_id": "agent-1" }
}
```

Delete a pane:

```bash
DELETE /panes/:id
```

Capture pane output:

```bash
GET /panes/:id/capture
```

Send keys to a pane (simulated; appends to output buffer):

```bash
POST /panes/:id/send
{ "keys": "echo hello" }
```

Stream pane logs:

```bash
GET /panes/:id/logs
```

### Skills Registry

List skills for a workspace:

```bash
GET /skills?workspace_id=ws-123
```

Register a skill:

```bash
POST /skills
{
  "workspace_id": "ws-123",
  "name": "deploy",
  "description": "Deploy the current workspace",
  "manifest": "{ \"tools\": [\"deploy\"] }",
  "source_repo": "github.com/allternit/skills",
  "version": "1.0.0",
  "installed_by": "agent-1"
}
```

Get a skill:

```bash
GET /skills/:id
```

Delete a skill:

```bash
DELETE /skills/:id
```

## Testing

```bash
cargo test -p allternit-workspace-service
```
