# HEARTBEAT.md - Periodic Tasks

## Overview

Scheduled tasks that Gizzi performs automatically.

## Active Schedules

### Daily Check-in
- **Schedule**: `0 9 * * *` (9 AM daily)
- **Action**: Review active tasks, prepare daily focus
- **Enabled**: true

### Memory Compaction
- **Schedule**: `0 2 * * *` (2 AM daily)
- **Action**: Archive old logs, update lessons
- **Enabled**: true

### Platform Update Check
- **Schedule**: `0 */6 * * *` (Every 6 hours)
- **Action**: Check for platform updates, update knowledge
- **Enabled**: true

### Weekly Review
- **Schedule**: `0 10 * * 1` (10 AM Monday)
- **Action**: Self-review, growth assessment
- **Enabled**: true

## Task Definitions

```json
{
  "tasks": [
    {
      "name": "daily-checkin",
      "schedule": "0 9 * * *",
      "action": "review_and_focus",
      "enabled": true
    },
    {
      "name": "memory-compaction", 
      "schedule": "0 2 * * *",
      "action": "archive_and_update",
      "enabled": true
    },
    {
      "name": "platform-update-check",
      "schedule": "0 */6 * * *",
      "action": "sync_platform_knowledge",
      "enabled": true
    },
    {
      "name": "weekly-review",
      "schedule": "0 10 * * 1",
      "action": "self_assessment",
      "enabled": true
    }
  ]
}
```

## Adding Tasks

To add new scheduled tasks:
1. Add entry to JSON above
2. Define action handler
3. Test schedule
4. Enable

## Disabling Heartbeat

To disable all periodic tasks, set all `enabled` to `false`.

To disable individual tasks, set that task's `enabled` to `false`.
