# Cowork Scheduler Specification

## Scope

This document specifies the behavior, data model, API contract, and JSON schemas of `allternit-cowork-scheduler`.

## Data Model

### Schedule

| Field               | Type                  | Description                                      |
|---------------------|-----------------------|--------------------------------------------------|
| `id`                | `String` (UUID)       | Unique identifier.                               |
| `name`              | `String`              | Human-readable name.                             |
| `cron`              | `String`              | Cron expression.                                 |
| `timezone`          | `String`              | Timezone name (default `UTC`).                   |
| `enabled`           | `bool`                | Whether the schedule is active.                  |
| `entrypoint`        | `String`              | Command/script to execute.                       |
| `args`              | `Vec<String>`         | Arguments for the entrypoint.                    |
| `env`               | `HashMap<String, String>` | Environment variables.                       |
| `priority`          | `i32`                 | Execution priority.                              |
| `timeout_secs`      | `i32`                 | Maximum runtime in seconds.                      |
| `created_at`        | `DateTime<Utc>`       | Creation timestamp.                              |
| `updated_at`        | `DateTime<Utc>`       | Last update timestamp.                           |
| `last_triggered_at` | `Option<DateTime<Utc>>` | Last trigger timestamp.                        |
| `next_run_at`       | `Option<DateTime<Utc>>` | Next scheduled run.                            |
| `owner`             | `String`              | Tenant/user owner.                               |
| `run_mode`          | `String`              | `interactive`, `cowork`, or `scheduled`.         |

### SchedulerStats

| Field               | Type    | Description                                      |
|---------------------|---------|--------------------------------------------------|
| `total_schedules`   | `usize` | Total schedules.                                 |
| `enabled_schedules` | `usize` | Enabled schedules.                               |

### CreateScheduleRequest

| Field          | Type                          | Required | Default       |
|----------------|-------------------------------|----------|---------------|
| `name`         | `String`                      | yes      |               |
| `cron`         | `String`                      | yes      |               |
| `timezone`     | `Option<String>`              | no       | `UTC`         |
| `entrypoint`   | `String`                      | yes      |               |
| `args`         | `Option<Vec<String>>`         | no       | `[]`          |
| `env`          | `Option<HashMap<String, String>>` | no   | `{}`          |
| `priority`     | `Option<i32>`                 | no       | `0`           |
| `timeout_secs` | `Option<i32>`                 | no       | `3600`        |
| `run_mode`     | `Option<String>`              | no       | `scheduled`   |

## Cron Validation

- Cron expressions are parsed with `cron_parser::parse` against the current UTC time.
- Invalid cron expressions must be rejected with `SchedulerError::InvalidCron`.
- `next_run_at` is computed at creation time from the current time.

## State Transitions

A schedule has two primary states controlled by `enabled`:

- **Enabled** (`enabled = true`): registered with the cron scheduler and may trigger.
- **Disabled/Paused** (`enabled = false`): persisted but will not trigger.

Transitions:

- `create_schedule` → enabled.
- `enable_schedule(id)` → enabled.
- `disable_schedule(id)` → disabled.
- `delete_schedule(id)` → removed from store.

## API Contract

### Scheduler library

- `create_schedule(owner, req)` → validate cron, persist, and register if enabled.
- `get_schedule(id)` → return schedule or `NotFound`.
- `list_schedules()` / `list_schedules_for_owner(owner)` → return ordered lists.
- `enable_schedule(id)` → enable and register with scheduler.
- `disable_schedule(id)` → disable in store.
- `delete_schedule(id)` → remove from store.
- `run_now(id)` → immediately execute handler and update `last_triggered_at`.
- `wake_due_schedules()` → trigger enabled schedules whose `next_run_at` is in the past and not yet triggered since that time.
- `get_stats()` → return total and enabled counts.

### HTTP API

#### `GET /schedules`

Returns an array of `ScheduleResponse` objects.

#### `POST /schedules`

Accepts a `CreateScheduleDto`:

```json
{
  "name": "Daily report",
  "schedule": "0 9 * * 1-5",
  "entrypoint": "scripts/daily-report.sh",
  "args": ["--verbose"],
  "env": {"LOG_LEVEL": "info"},
  "timezone": "UTC"
}
```

Returns `201 Created` with the created `ScheduleResponse`, or `400 Bad Request` on invalid input.

#### `GET /schedules/:id`

Returns `200 OK` with the schedule, or `404 Not Found`.

#### `PATCH /schedules/:id`

Accepts an `UpdateScheduleDto` with optional fields:

```json
{
  "name": "Updated name",
  "schedule": "0 10 * * 1-5",
  "entrypoint": "scripts/updated.sh",
  "status": "paused"
}
```

Status values:

- `"active"` → enable the schedule.
- `"paused"` or `"disabled"` → disable the schedule.

Returns `200 OK` with the updated `ScheduleResponse`, or `400/404` on error.

Note: non-status field updates are accepted by the DTO but are not currently applied.

#### `DELETE /schedules/:id`

Returns `204 No Content` on success, or `404 Not Found`.

#### `POST /schedules/:id/run`

Triggers the schedule immediately. Returns `200 OK` with `{ "message": "Schedule triggered" }`, or `404/500` on error.

#### `GET /status`

Returns scheduler status:

```json
{
  "jobs": 10,
  "active": 7,
  "pending_runs": 0,
  "running_runs": 0
}
```

#### `POST /wake`

Triggers all due schedules. Returns:

```json
{
  "triggered": 2,
  "jobs": ["schedule-id-1", "schedule-id-2"]
}
```

## Error Handling

`SchedulerError` variants:

- `Scheduler(String)` — internal scheduler failure.
- `InvalidCron(String)` — invalid cron expression or status value.
- `NotFound(String)` — schedule not found.
- `Store(String)` — SQLite store error.
- `Execution(String)` — job handler execution failure.

HTTP mapping:

- `InvalidCron` → `400 Bad Request`
- `NotFound` → `404 Not Found`
- Others → `500 Internal Server Error`

## JSON Schemas

Formal JSON Schema definitions are provided in `schemas/v1/schedule.json` and `schemas/v1/scheduler-stats.json`.

## Persistence Guarantees

- Schedule definitions are persisted in SQLite.
- `last_triggered_at` and `next_run_at` are updated on trigger and creation.
- Trigger history beyond the latest timestamp is not retained.

## Security

- The scheduler does not implement authentication; it is intended to run behind the Allternit API gateway or within a trusted network.
- Multi-tenancy is supported through the `owner` field; API implementations should enforce ownership checks.
