# allternit-cowork-runtime

Rust satellite crate for the Allternit cowork execution runtime.

## Purpose

`allternit-cowork-runtime` manages persistent, detachable compute runs that integrate with the Rails backend. It provides the execution-side primitives for:

- **Long-running runs** that survive client disconnects and network partitions.
- **Checkpoint/restore** using Rails `ContextPack` records plus local JSON state.
- **Client attachment** with permissions, heartbeat detection, and reconnect tokens.
- **Run and job lifecycle** state machines that mirror the Rails DAG / node model.
- **Event streaming** for run state transitions, job changes, checkpoints, and attachment activity.

This crate is intended to be consumed by the Allternit API server and by any standalone Rust service that needs to drive cowork execution without depending on the full Rails stack.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Cowork Runtime                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ RunManager  │  │ Attachment   │  │ CheckpointManager│   │
│  │             │  │ Registry     │  │                  │   │
│  │ - runs      │  │              │  │ - local JSON     │   │
│  │ - jobs      │  │ - SQLite     │  │ - Rails Context  │   │
│  │ - state     │  │ - tokens     │  │   Pack sync      │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                    │             │
│         └────────────────┴────────────────────┘             │
│                          │                                  │
│                   RailsClient trait                         │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP / REST
               ┌───────────┴───────────┐
               │    Rails Backend      │
               │   (DAG / ContextPack) │
               └───────────────────────┘
```

- `RunManager` owns the in-memory registry of runs and jobs, drives state transitions, and emits `CoworkEvent`s.
- `AttachmentRegistry` persists attachment state in SQLite and manages reconnect tokens.
- `CheckpointManager` writes local checkpoint state and synchronously creates a matching Rails `ContextPack` when possible.
- `RailsClient` is an async trait; production code supplies an HTTP implementation, tests can supply a stub.

## Integration with Rails

The runtime maps its domain model onto Rails concepts:

| Runtime           | Rails                 |
|-------------------|-----------------------|
| `Run`             | DAG                   |
| `Job`             | DagNode               |
| `Checkpoint`      | ContextPack           |
| `Attachment`      | Session / connection  |

`RailsClient` methods (`create_dag`, `create_node`, `update_run_state`, `update_job_state`, `append_event`) keep Rails in sync with runtime state. The runtime can continue operating using local storage if Rails is temporarily unavailable, but state updates are queued through the trait interface.

## API Summary

### Core types

- `RunId`, `JobId` — UUID-based identifiers.
- `RunMode` — `Interactive`, `Cowork`, `Scheduled`.
- `RunState` — lifecycle states from `Created` through terminal states.
- `JobState` — per-job lifecycle states including `Checkpointing` and `DeadLetter`.
- `Attachment`, `AttachmentState`, `ClientType`, `PermissionSet`.
- `CoworkEvent` — tagged enum of runtime events.

### RunManager

- `new(config, rails_client).await` — create and start background tasks.
- `create_run(spec).await` — create a run and corresponding Rails DAG.
- `get_run(run_id)`, `list_runs(state)` — read run state.
- `transition_run_state(run_id, state)` — validate and apply state transitions.
- `create_job(spec).await` — create a job / Rails node.
- `attach(...)`, `detach(...)`, `reattach(token)` — client attachment.
- `checkpoint(...)`, `list_checkpoints(...)`, `recover(run_id)` — checkpoint operations.
- `cancel(run_id)` — transition a run to `Cancelled`.
- `shutdown()` — graceful shutdown.

### Checkpoints

- `CheckpointManager::new(data_dir, rails_base_url).await`
- `create(...)`, `load(...)`, `list(run_id)`, `get_latest(run_id)`, `delete(...)`, `recover(run_id)`, `prune(run_id, keep_count)`.

## Build & Run

From the workspace root:

```bash
# Check the crate
cargo check -p allternit-cowork-runtime

# Run unit/integration tests
cargo test -p allternit-cowork-runtime

# Build documentation
cargo doc -p allternit-cowork-runtime --no-deps
```

The crate is a library only; executables that use it live in `cmd/`.

## Testing

Integration tests in `tests/integration_tests.rs` cover:

- Run creation and state transitions.
- Job creation and state transitions.
- Checkpoint create/list/recover with a mock Rails client.
- Attachment lifecycle with an in-memory SQLite database.

See `tests/integration_tests.rs` for examples of how to provide a fake `RailsClient`.

## License

MIT — see the workspace `LICENSE` file.
