# Cron Migration Guide

## Overview

We've consolidated from **two separate cron implementations** to a **single TypeScript implementation**.

### What Was Removed
- ❌ Rust `allternit-scheduler` crate (`domains/kernel/cowork/allternit-scheduler/`)
- ❌ Previous in-memory `CronService`

### What Replaces It
- ✅ **Enhanced TypeScript CronService** with SQLite persistence
- ✅ **HTTP Daemon** for background scheduling
- ✅ **Natural language** schedule parsing
- ✅ **Multiple job types** (shell, HTTP, agent, cowork)

---

## Why Consolidate?

| Aspect | Old (Dual) | New (Unified) |
|--------|-----------|---------------|
| Languages | Rust + TypeScript | TypeScript only |
| Persistence | SQLite (Rust) + Memory (TS) | SQLite (Bun native) |
| Deployment | Complex multi-binary | Single CLI binary |
| Maintenance | Two codebases | One codebase |
| Feature parity | Hard to keep sync | Automatic |

---

## API Comparison

### Old Rust Scheduler API (REMOVED)
```rust
// POST /schedules - Create schedule
{
  "name": "backup",
  "schedule": "0 2 * * *",
  "action": {
    "type": "cowork_run",
    "config": { ... }
  }
}
```

### New TypeScript API
```typescript
// POST /jobs - Create job
{
  "name": "backup",
  "schedule": "0 2 * * *",  // or "daily at 2am"
  "type": "cowork",
  "config": {
    "runtime": "docker",
    "commands": ["./backup.sh"]
  }
}
```

---

## Feature Comparison

| Feature | Old Rust | New TypeScript |
|---------|----------|----------------|
| Cron expressions | ✅ | ✅ + Natural language |
| SQLite persistence | ✅ | ✅ (Bun native) |
| HTTP API | ✅ | ✅ (enhanced) |
| Job types | cowork only | shell, http, agent, cowork |
| Run history | ✅ | ✅ (with logs) |
| CLI commands | ❌ | ✅ Full CLI |
| Daemon mode | ✅ | ✅ |
| Natural language | ❌ | ✅ |
| Event system | ✅ | ✅ |

---

## Migration Steps

### 1. Update Database Path
```bash
# Old
~/.allternit/scheduler.db

# New  
~/.allternit/cron.db
```

### 2. Update API Clients
```diff
- fetch("http://localhost:3030/schedules", ...)
+ fetch("http://localhost:3031/jobs", ...)
```

### 3. Update Job Payloads
```diff
{
  "name": "backup",
  "schedule": "0 2 * * *",
- "action": {
-   "type": "cowork_run",
-   "config": { ... }
- }
+ "type": "cowork",
+ "config": { ... }
}
```

### 4. Start Daemon
```bash
# Old - Run Rust binary
./allternit-scheduler

# New - Use CLI
allternit cron daemon start
```

---

## New Features

### Natural Language Schedules
```bash
allternit cron add "backup every day at 2am"
allternit cron add "check health every 5 minutes"
allternit cron add "reports weekly on friday at 5pm"
```

### Multiple Job Types
```bash
# Shell command
allternit cron add --name backup --schedule "0 2 * * *" --type shell --command "./backup.sh"

# HTTP health check
allternit cron add --name health --schedule "*/5 * * * *" --type http --url https://api.example.com/health

# Agent task
allternit cron add --name digest --schedule "daily at 9am" --type agent --prompt "Summarize yesterday's commits"

# Cowork session
allternit cron add --name tests --schedule "every hour" --type cowork --commands "npm test"
```

### Rich CLI
```bash
allternit cron list              # List all jobs
allternit cron logs <id>         # View run history
allternit cron run <id>          # Trigger manually
allternit cron status            # Show daemon status
allternit cron wake              # Check for due jobs
```

---

## Removing Old Code

### Files to Delete
```
domains/kernel/cowork/allternit-scheduler/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── main.rs
│   └── api.rs
└── tests/
```

### Cargo.toml Update
```diff
[workspace]
members = [
  "domains/kernel/cowork/allternit-cowork",
- "domains/kernel/cowork/allternit-scheduler",
]
```

---

## Testing

### Unit Tests
```bash
cd cmd/gizzi-code
bun test src/runtime/automation/cron/
```

### Integration Tests
```bash
# Start daemon
allternit cron daemon start &

# Create job
curl -X POST http://localhost:3031/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "schedule": "* * * * *",
    "type": "shell",
    "config": {"command": "echo hello"}
  }'

# Check status
curl http://localhost:3031/status
```

---

## Rollback Plan

If issues arise:

1. **Stop new daemon**: `Ctrl+C` or kill process
2. **Restore old database**: `cp ~/.allternit/scheduler.db.bak ~/.allternit/scheduler.db`
3. **Start old scheduler**: `./target/release/allternit-scheduler`

---

## Support

For issues with the new system:
1. Check logs: `~/.allternit/logs/cron.log`
2. Check database: `bun ~/.allternit/cron.db`
3. File issue with `allternit cron status` output
