# Allternit Cowork Runtime — Vision Document

## Problem Statement

Current Cowork implementations in the market (Claude Desktop, etc.) run agent execution locally on the user's machine. This creates fundamental limitations:

1. **Session fragility**: When the user's laptop sleeps, loses power, or disconnects, the agent runtime dies
2. **No background execution**: Scheduled tasks require the user's machine to be awake and the app to be open
3. **Single-surface lock-in**: A run started in the terminal cannot be continued in the web interface
4. **No durability guarantees**: Crash recovery depends on local state that may be lost

## Vision

**Allternit Cowork is a persistent, remote, detachable agent runtime that lives on the user's BYOC VPS.**

The UI (terminal, web, desktop) is merely a control surface that attaches to and detaches from remote runs. The runtime continues independently of any connected client.

### Key Differentiators

| Feature | Traditional Cowork | Allternit Cowork |
|---------|-------------------|------------|
| Runtime location | Local machine | BYOC VPS (remote) |
| Survives laptop sleep | No | Yes |
| Scheduled jobs | Requires open app | Runs server-native |
| Cross-surface continuity | Limited | Full (terminal ↔ web ↔ desktop) |
| Crash recovery | Local state only | Checkpoint-based |
| Multi-client attach | No | Yes |

## User Experience Goals

### 1. Terminal-Native Cowork

```bash
# Start a cowork run (remote, durable)
gizzi cowork start "Refactor the auth module to use JWT"

# Run continues, terminal shows live output
# User presses Ctrl+D to detach

# Later, from anywhere
gizzi cowork ls
gizzi cowork attach <run-id>
# Output replays from detach point, continues live
```

### 2. Schedule-Driven Automation

```bash
# Create a scheduled cowork job
gizzi cowork schedule create \
  --name "Daily security audit" \
  --cron "0 9 * * *" \
  --command "run-security-scan.sh"

# Runs every day at 9am, even when user is offline
# Results available via `gizzi cowork logs` or web UI
```

### 3. Cross-Surface Continuity

1. Start a run from terminal during commute
2. Detach, go into meeting
3. Open web UI, see same run in progress
4. Approve a pending action from web
5. Return to terminal, reattach, continue

### 4. Policy-Gated Safety

Destructive actions pause for approval:
```
[RUN 1234] Awaiting approval:
Action: DELETE production database
Severity: CRITICAL
Requested: 2026-03-09 14:32:00 UTC

Approve? (y/n/diff/comment): 
```

Can approve from any connected client or predefined policy rules.

## Architectural Vision

### Four-Plane Architecture

1. **Control Plane**: Orchestration, scheduling, approvals, policy
2. **Execution Plane**: Workers, queue dispatch, tool execution
3. **State Plane**: PostgreSQL, event ledger, checkpoints, artifacts
4. **Presentation Plane**: Terminal TUI, web UI, desktop app

### Core Principle: Separation of Concerns

- **Run lifecycle** ≠ **Client session lifecycle**
- A run exists independently of any attached client
- Multiple clients can attach to the same run simultaneously
- Clients can reconnect and replay missed events

## Success Metrics

1. **Durability**: 99.9% of runs survive client disconnect
2. **Recovery**: Worker crash → run resumes within 30 seconds
3. **Latency**: Event replay <100ms per 1000 events
4. **Availability**: Scheduled job execution >99.5% on time
5. **Cross-surface**: Switch surface <5 seconds with full state

## Out of Scope (V1)

- Full pixel-streamed desktop automation (use remote browser workers instead)
- Mobile client attach (future)
- Multi-region scheduler (single VPS region for V1)
- Elastic worker autoscaling (fixed worker pool for V1)

---

*Last updated: 2026-03-09*
