# Cowork Runtime Specification

## Scope

This document specifies the behavior, data model, and API contract of `allternit-cowork-runtime`.

## Data Model

### Run

A `Run` represents a single logical execution session.

| Field                 | Type              | Description                                           |
|-----------------------|-------------------|-------------------------------------------------------|
| `id`                  | `RunId` (UUID)    | Unique runtime identifier.                            |
| `tenant_id`           | `String`          | Tenant owner.                                         |
| `workspace_id`        | `String`          | Workspace context.                                    |
| `initiator`           | `String`          | Actor that started the run.                           |
| `mode`                | `RunMode`         | `interactive`, `cowork`, or `scheduled`.              |
| `state`               | `RunState`        | Current lifecycle state.                              |
| `entrypoint`          | `String`          | Command or script to execute.                         |
| `dag_id`              | `String`          | Rails DAG identifier.                                 |
| `current_job_id`      | `Option<JobId>`   | Active job, if any.                                   |
| `current_checkpoint_id`| `Option<String>` | Most recent checkpoint.                               |
| `policy_profile`      | `String`          | Policy profile name.                                  |
| `created_at`          | `DateTime<Utc>`   | Creation time.                                        |
| `updated_at`          | `DateTime<Utc>`   | Last update time.                                     |
| `completed_at`        | `Option<DateTime<Utc>>` | Terminal completion time.                       |

### Job

A `Job` is a unit of work within a run, mapped to a Rails DAG node.

| Field            | Type                  | Description                                      |
|------------------|-----------------------|--------------------------------------------------|
| `id`             | `JobId` (UUID)        | Unique identifier.                               |
| `run_id`         | `RunId`               | Parent run.                                      |
| `dag_node_id`    | `String`              | Rails node identifier.                           |
| `job_type`       | `String`              | Type/kind of job.                                |
| `priority`       | `i32`                 | Execution priority.                              |
| `state`          | `JobState`            | Current job state.                               |
| `lease_owner`    | `Option<String>`      | Worker holding the lease.                        |
| `lease_expires_at`| `Option<DateTime<Utc>>` | Lease expiration.                              |
| `retry_count`    | `i32`                 | Failed attempts so far.                          |
| `max_retries`    | `i32`                 | Maximum retries allowed.                         |
| `timeout_sec`    | `i32`                 | Execution timeout.                               |
| `payload`        | `serde_json::Value`   | Input parameters.                                |
| `created_at`     | `DateTime<Utc>`       | Creation time.                                   |
| `updated_at`     | `DateTime<Utc>`       | Last update.                                     |
| `started_at`     | `Option<DateTime<Utc>>` | Actual start time.                             |
| `completed_at`   | `Option<DateTime<Utc>>` | Terminal time.                                 |

### Checkpoint

A `Checkpoint` captures execution state.

| Field               | Type                    | Description                                      |
|---------------------|-------------------------|--------------------------------------------------|
| `id`                | `String`                | Checkpoint UUID.                                 |
| `run_id`            | `RunId`                 | Parent run.                                      |
| `job_id`            | `Option<JobId>`         | Associated job.                                  |
| `step_index`        | `i32`                   | Step index.                                      |
| `pack_id`           | `String`                | Rails ContextPack identifier.                    |
| `cursor_state`      | `serde_json::Value`     | Serialized agent cursor / memory state.          |
| `pending_approvals` | `Vec<String>`           | Pending policy approvals.                        |
| `artifact_refs`     | `Vec<String>`           | Artifact references.                             |
| `created_at`        | `DateTime<Utc>`         | Creation time.                                   |

### Attachment

An `Attachment` represents a client connected to a run.

| Field                | Type                 | Description                                      |
|----------------------|----------------------|--------------------------------------------------|
| `id`                 | `Uuid`               | Attachment identifier.                           |
| `run_id`             | `RunId`              | Parent run.                                      |
| `client_type`        | `ClientType`         | `terminal`, `web`, or `desktop`.                 |
| `client_session_id`  | `String`             | Client-provided session ID.                      |
| `state`              | `AttachmentState`    | `attached`, `detached`, `stale`, `revoked`.      |
| `permissions`        | `PermissionSet`      | Read/write/approve/admin flags.                  |
| `last_seen_at`       | `DateTime<Utc>`      | Last heartbeat.                                  |
| `replay_cursor`      | `String`             | Ledger replay cursor.                            |
| `reconnect_token`    | `String`             | Token for reconnection.                          |
| `created_at`         | `DateTime<Utc>`      | Creation time.                                   |

## State Machines

### Run States

```
Created -> Planned -> Queued -> Running -> Completed
   |          |          |          |          |
   +--------> Cancelled  +----> Recovering -> Failed
                       |          |
                       v          v
                     Paused <- AwaitingApproval
```

Valid transitions are enforced by `RunManager::is_valid_run_transition`:

- `Created` → `Planned`, `Cancelled`
- `Planned` → `Queued`, `Cancelled`
- `Queued` → `Running`, `Recovering`, `Cancelled`
- `Running` → `Paused`, `AwaitingApproval`, `Completed`, `Failed`, `Cancelled`
- `Paused` → `Running`, `Cancelled`
- `AwaitingApproval` → `Running`, `Cancelled`
- `Recovering` → `Running`, `Failed`
- Terminal states (`Completed`, `Failed`, `Cancelled`) cannot transition.

### Job States

Job states follow a similar model. Terminal states are `Completed`, `Failed`, `DeadLetter`, and `Cancelled`.

## API Contract

### RailsClient

All methods return `anyhow::Result<_>`.

- `create_dag(run_id, spec)` → `String` (Rails DAG ID)
- `create_node(dag_id, job_id, spec)` → `String` (Rails node ID)
- `update_run_state(dag_id, state)` → `()`
- `update_job_state(node_id, state)` → `()`
- `request_lease(resource_id, owner_id)` → `bool`
- `release_lease(resource_id, owner_id)` → `()`
- `append_event(event)` → `()`

### Events

`CoworkEvent` is a tagged enum with `type` field:

- `run.created`
- `run.state_changed`
- `run.completed`
- `job.created`
- `job.state_changed`
- `checkpoint.created`
- `attachment.attached`
- `attachment.detached`

## Error Handling

`CoworkError` variants map to HTTP status codes via `http_status_code()`:

- 404 — not found (run, job, attachment, checkpoint)
- 409 — conflict (invalid transition, not attachable, lease failure)
- 401 — unauthorized (invalid attachment token)
- 500 — internal errors (Rails, storage, serialization, IO, DB)

## Persistence Guarantees

- Run/job state is currently in-memory; a restart loses active runs unless they are reloaded via `load_run`.
- Attachment state is persisted in SQLite.
- Checkpoint local state is persisted in JSON files.
- Rails `ContextPack` creation is best-effort; local state is considered authoritative.

## Security

- Attachment permissions gate read/write/approve/admin access.
- Reconnect tokens are UUIDs stored hashed only in the local SQLite database (plain UUIDs are returned once at attachment time).
- Policy profiles are stored on the run and enforced by the worker implementation.
