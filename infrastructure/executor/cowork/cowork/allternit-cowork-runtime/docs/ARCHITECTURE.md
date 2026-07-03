# allternit-cowork-runtime Architecture

## Goals

1. Provide a Rust-side execution engine for persistent cowork runs.
2. Mirror the Rails DAG/ContextPack model so Rails remains the source of truth for history.
3. Survive client disconnects through checkpoints and reconnect tokens.
4. Stay driver-agnostic: actual execution is delegated to `allternit-vm-executor` and its drivers.

## Components

### `RunManager`

The central coordinator. It holds:

- `Arc<RwLock<HashMap<RunId, Arc<RwLock<Run>>>>>` for runs.
- `Arc<RwLock<HashMap<JobId, Arc<RwLock<Job>>>>>` for jobs.
- `Arc<AttachmentRegistry>` and `Arc<CheckpointManager>`.
- A `mpsc::Sender<CoworkEvent>` for event emission.
- An `Arc<dyn RailsClient>` for backend integration.

Background tasks:

- **Heartbeat task** — periodically marks stale attachments; currently driven by `AttachmentRegistry` internally.
- **Lease renewal task** — placeholder for future distributed lease coordination.

State transitions are validated in `is_valid_run_transition`. Terminal states record `completed_at` and emit a `RunCompleted` event.

### `AttachmentRegistry`

SQLite-backed registry of client attachments.

- Stores attachment rows with state, permissions, last-seen timestamp, replay cursor, and reconnect token.
- Background SQL task marks attachments as `Stale` when `last_seen_at` exceeds `timeout_secs`.
- Supports reattachment by token and cursor-based replay.

The schema is created automatically on first use.

### `CheckpointManager`

Persists execution state as local JSON files and attempts to mirror each checkpoint to Rails as a `ContextPack`.

- Local file name: `<data_dir>/<checkpoint_id>.json`.
- Rails sync is best-effort: failures are logged but do not fail checkpoint creation.
- `recover(run_id)` loads the latest checkpoint and extracts the `event_cursor` field from `cursor_state` for replay.
- `prune(run_id, keep_count)` removes older checkpoints.

### `RailsClient` trait

Decouples the runtime from transport details. Implementations must provide:

- DAG/node creation.
- Run/job state updates.
- Lease request/release.
- Event append.

This allows unit tests to use a fake client and the API server to use an HTTP/reqwest client.

## Data Flow

### Creating a run

1. Caller invokes `RunManager::create_run(spec)`.
2. Runtime asks `RailsClient::create_dag` for a Rails DAG ID.
3. A `Run` is created in `Created` state and stored in memory.
4. `CoworkEvent::RunCreated` is emitted.

### Running a job

1. Caller creates a `Job` via `RunManager::create_job(spec)`.
2. Runtime asks `RailsClient::create_node` for a Rails node ID.
3. Worker code transitions the job through `Queued`, `Leased`, `Starting`, `Running`.
4. On completion/failure the worker transitions the job to a terminal state.

### Checkpointing

1. Worker calls `RunManager::checkpoint(run_id, job_id, step_index, cursor_state)`.
2. `CheckpointManager` writes local JSON and posts a `ContextPack` to Rails.
3. Run's `current_checkpoint_id` is updated.
4. `CoworkEvent::CheckpointCreated` is emitted.

### Recovery

1. Caller invokes `RunManager::recover(run_id)`.
2. Latest checkpoint is loaded.
3. Run transitions to `Recovering`, then typically `Running` once replay completes.

## Concurrency Model

- Each `Run` and `Job` is wrapped in `Arc<RwLock<_>>` so multiple callers can read concurrently.
- `RunManager` methods acquire short-lived locks and clone data for callers to avoid deadlocks.
- `AttachmentRegistry` uses a shared SQLite pool; row-level locking is provided by SQLite.
- Background tasks run in detached `tokio::spawn` handles.

## Future Work

- Persistent run/job storage (currently in-memory only).
- Distributed lease implementation in the lease renewal task.
- Event persistence and replay beyond the checkpoint cursor.
- Metrics and OpenTelemetry integration.
