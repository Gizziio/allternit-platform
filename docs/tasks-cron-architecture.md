# Tasks & Cron Execution Architecture

## Problem Statement

Users want to schedule tasks and cron jobs in Allternit/Gizzi Code the same way they do in Kimi Code and Claude Code. The key requirements are:

1. Scheduled work starts automatically at the right time.
2. No terminal window needs to stay open for schedules to run.
3. The system is robust: handles misfires, retries, downtime, and clock skew.
4. There are no vague "if this then else" local fallbacks — only explicit, tested execution paths.

## How the Industry Solves This

### Kimi Code / Local-first agents

Kimi Code's `/schedule` command keeps a lightweight scheduler inside the CLI process. When you schedule something, it is stored locally and the process wakes itself up at the scheduled time. The limitation is clear and explicit: **schedules only run while the Kimi Code process is running**. If you close the terminal, scheduled work pauses. This is honest local scheduling, not a fallback.

### Claude Code / Cloud-backed agents

Claude Code's tasks and cron jobs are backed by Anthropic's cloud infrastructure. When you schedule work, the schedule is persisted server-side. A cloud scheduler triggers the job at the right time and either runs it in the cloud or reconnects to your machine. The explicit model is: **schedules run as long as you are connected to the internet and authenticated**, because the authoritative state lives in the cloud. Claude Desktop does not need to stay open because the cloud owns the schedule.

### General pattern

Every serious task/cron system separates three concerns:

1. **Schedule store** — durable, single source of truth for what should run and when.
2. **Scheduler** — watches the store and emits events at the right wall-clock time.
3. **Executor** — receives the event and does the work, reporting success/failure.

The store and scheduler can live in the cloud (always-on) or on the local machine (runs while the app runs). The executor can be cloud-side, local-side, or both. What matters is that each path is explicit, not a fallback.

## Allternit/Gizzi Code Design

Allternit has both a cloud backend and a local desktop runtime. We therefore support **two explicit scheduling paths**, chosen by the user when the schedule is created.

### Path 1: Cloud Scheduler (Claude-style)

- **Store**: `schedules` table in the cloud database (SQLite/PostgreSQL).
- **Scheduler**: `allternit-scheduler` daemon, deployed as part of the cloud control plane.
- **Executor**: cloud services call local agents over a secure tunnel/WebSocket when the job needs local context, or run fully cloud-side when it does not.
- **Lifetime**: schedules run as long as the cloud control plane is up. The user's laptop can be asleep.
- **Use for**: recurring reports, cloud infrastructure tasks, agent check-ins that do not need the local machine.

### Path 2: Local Scheduler (Kimi-style)

- **Store**: local SQLite database inside the desktop app / Gizzi Code runtime.
- **Scheduler**: `gizzi-scheduler` component embedded in the desktop main process or sidecar.
- **Executor**: the local agent runtime executes the task directly.
- **Lifetime**: schedules run as long as the Allternit Desktop / Gizzi Code process is running. If the process exits, schedules pause and resume on restart with misfire handling.
- **Use for**: local file operations, local builds, desktop automation, tasks that must touch the user's machine.

### Path 3: Hybrid (explicit sync)

A schedule can be created in either location. The desktop syncs local schedule metadata to the cloud for visibility, but the authoritative trigger remains local. Conversely, a cloud schedule can request local execution via a push notification that wakes the desktop. The architecture never silently falls back from cloud to local or vice versa — the user picks the authoritative location.

## Implementation Status

### Cloud scheduler

- Crate: `infrastructure/scheduler` (`allternit-scheduler` binary).
- Polls the `schedules` table and triggers runs via the control plane API.
- Misfire policy: `ignore`, `fire_once`, `fire_all`.
- Cron parser: `infrastructure/scheduler/cron-parser` now uses the real `cron` crate to compute next occurrences.
- Database schema expected:

```sql
CREATE TABLE schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cron_expr TEXT NOT NULL,
    natural_lang TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    job_template JSON NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    misfire_policy TEXT NOT NULL DEFAULT 'fire_once',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER NOT NULL DEFAULT 0,
    misfire_count INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT,
    tenant_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Local scheduler

- Not yet implemented. Proposed as a new crate or module inside the Gizzi Code runtime.
- Should reuse `allternit-cron-parser` for natural-language → cron conversion.
- Should reuse the same misfire policies as the cloud scheduler.
- Should store schedules in `~/.allternit/gizzi-scheduler.db`.

## No Fallbacks Rule

The following are explicit decisions, not fallbacks:

| Scenario | Behavior |
|----------|----------|
| Cloud scheduler cannot reach local agent | Mark run as failed; do not silently run locally later unless the schedule was created as hybrid with explicit retry. |
| Local scheduler process exits | Schedules pause. On restart, misfire policy applies. No cloud takeover. |
| User creates schedule while offline (cloud mode) | Store the schedule locally first, sync to cloud when online, but display clearly that it is pending sync. |
| Both cloud and local are available | User chooses the execution domain when creating the schedule. |

## API Surface

```typescript
// Create a schedule
POST /api/v1/schedules
{
  "name": "Daily standup summary",
  "schedule": "weekdays at 9am",
  "timezone": "America/New_York",
  "domain": "cloud" | "local",
  "job_template": {
    "type": "agent-task",
    "agent": "standup-agent",
    "prompt": "Summarize yesterday's commits and today's plan"
  },
  "misfire_policy": "fire_once"
}

// List schedules
GET /api/v1/schedules

// Pause/resume
PATCH /api/v1/schedules/:id
{ "enabled": false }

// Trigger manually
POST /api/v1/schedules/:id/trigger
```

## Next Steps

1. Implement the local scheduler for Gizzi Code / Allternit Desktop.
2. Add the schedule CRUD API to `cmd/allternit-api`.
3. Add a UI in `surfaces/ai.allternit.com` for creating and monitoring schedules.
4. Add schedule execution metrics and alerting.
5. Document which execution domain each schedule type uses.
