# Allternit Cowork Always-On Runtime — Planning Deliverables

This document contains the required first outputs before implementation begins:
- A. Spec Delta
- B. Architecture Delta  
- C. Contract Plan
- D. Repo Path Plan
- E. DAG Execution Plan

---

## A. Spec Delta

### New Spec Files to Create

| File | Purpose | Status |
|------|---------|--------|
| `/spec/Vision.md` | High-level product vision for Cowork runtime | NEW |
| `/spec/Requirements.md` | Functional and non-functional requirements | NEW |
| `/spec/Architecture.md` | 4-plane architecture and component interactions | NEW |
| `/spec/AcceptanceTests.md` | End-to-end acceptance criteria | NEW |
| `/spec/Contracts/Run.md` | Run/Job lifecycle contracts | NEW |
| `/spec/Contracts/Event.md` | Event schema definitions | NEW |
| `/spec/Contracts/API.md` | OpenAPI/gRPC API specifications | NEW |
| `/spec/ADRs/001-remote-detachable-cowork.md` | Remote runtime decision | NEW |
| `/spec/ADRs/002-platform-native-scheduler.md` | Scheduler architecture | NEW |
| `/spec/ADRs/003-terminal-control-surface.md` | Terminal as client model | NEW |
| `/spec/ADRs/004-event-ledger-replay.md` | Event sourcing for reconnect | NEW |
| `/spec/ADRs/005-checkpoint-recovery.md` | Checkpoint/restore model | NEW |

### Existing Files to Update

| File | Changes Required |
|------|------------------|
| `/Cargo.toml` | Add new workspace members for cowork-runtime, scheduler, stream-gateway |
| `CLI modulesrc/main.rs` | Add `cowork` subcommand tree |
| `API modulesrc/main.rs` | Add cowork routes, event stream endpoints |

---

## B. Architecture Delta

### Current Allternit Architecture (Existing)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ CLI (allternit)   │  │ Web UI      │  │ Desktop App │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      CONTROL (Partial)                           │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │ API (viz,       │  │ Session Manager (VM lifecycle)      │   │
│  │  sandbox)       │  └─────────────────────────────────────┘   │
│  └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      EXECUTION (Existing)                        │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │ Firecracker  │ │ Apple VF     │ │ Session Manager         │  │
│  │ Driver       │ │ Driver       │ │ (bubblewrap, vsock)     │  │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        STATE (Existing)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SQLite (local sessions.db) - per-client only             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Target Architecture (With Cowork Runtime)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PRESENTATION PLANE                                │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐    │
│  │ Terminal Cowork     │ │ Web Cowork UI       │ │ Desktop Cowork      │    │
│  │ (gizzi cowork *)    │ │ (/cowork/* routes)  │ │ (shared SDK)        │    │
│  │ - attach/detach     │ │ - run list/detail   │ │ - cross-surface     │    │
│  │ - TUI console       │ │ - schedule manager  │ │   continuity        │    │
│  │ - approval inbox    │ │ - approval queue    │ │                     │    │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTROL PLANE (New + Extended)                       │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Run Orchestration  │  │ Schedule Service   │  │ Attachment Registry│     │
│  │ Service            │  │                    │  │                    │     │
│  │ - create/enqueue   │  │ - CRUD schedules   │  │ - client sessions  │     │
│  │ - lifecycle mgmt   │  │ - cron evaluation  │  │ - reconnect tokens │     │
│  │ - policy gating    │  │ - misfire handling │  │ - presence tracking│     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Approval Service   │  │ Policy Engine      │  │ Metadata API       │     │
│  │ - request/resolve  │  │ (Allternit Law Layer)    │  │ (extended)         │     │
│  │ - timeout handling │  │ - action classify  │  │ - run queries      │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXECUTION PLANE (New)                                 │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Worker Runtime     │  │ Queue Dispatcher   │  │ Tool Bridge        │     │
│  │ (VM/container)     │  │                    │  │                    │     │
│  │ - lease jobs       │  │ - dequeue/lease    │  │ - route to Allternit     │     │
│  │ - execute tasks    │  │ - heartbeat check  │  │   tools            │     │
│  │ - checkpoint hooks │  │ - retry logic      │  │ - emit receipts    │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐                              │
│  │ Subagent Orch      │  │ Scheduler Daemon   │                              │
│  │ - parent/child     │  │ (background svc)   │                              │
│  │ - DAG execution    │  │ - periodic tick    │                              │
│  └────────────────────┘  └────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STATE PLANE (New)                                   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL (metadata, schedules, runs, jobs, approvals, checkpoints)  │  │
│  │ - relational data with tenancy isolation                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Event Ledger (append-only) │  │ Object Storage (checkpoints, artifacts)│ │
│  │ - per-run event streams    │  │ - blob storage for snapshots           │ │
│  │ - replay/resume support    │  │ - artifact references                  │ │
│  └────────────────────────────┘  └────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Queue/Lease Store          │  │ Read Models (materialized views)       │ │
│  │ - job queue state          │  │ - run summaries                        │ │
│  │ - worker leases            │  │ - dashboards                           │ │
│  └────────────────────────────┘  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Mapping to Existing Allternit

| New Component | Maps to Existing | Strategy |
|---------------|------------------|----------|
| Worker Runtime | `allternit-vm-executor`, `allternit-session-manager` | EXTEND - add checkpoint hooks, lease awareness |
| Tool Bridge | `allternit-driver-interface` | REUSE - extend with receipt emission |
| Policy Engine | New integration point | NEW - integrate with future Allternit Law Layer |
| Event Ledger | New | NEW - add event store abstraction |
| Attachment Registry | `persistence.rs` SessionStore | EXTEND - generalize to client attachments |
| PostgreSQL layer | `sqlite` in persistence.rs | REPLACE - Postgres for server-side durability |

---

## C. Contract Plan

### Domain Entities (Rust structs + DB schema)

```rust
// Core Identifiers
struct RunId(Uuid);
struct JobId(Uuid);
struct ScheduleId(Uuid);
struct CheckpointId(Uuid);
struct EventId(Uuid);
struct ApprovalId(Uuid);
struct WorkerId(Uuid);
struct WorkspaceId(String);
struct TenantId(String);

// Run - primary cowork execution unit
struct Run {
    run_id: RunId,
    tenant_id: TenantId,
    workspace_id: WorkspaceId,
    initiator: UserId,
    mode: RunMode,        // Interactive | Cowork | Scheduled
    state: RunState,      // enum with state machine
    entrypoint: String,   // initial task/prompt
    plan_ref: Option<String>,
    current_job_id: Option<JobId>,
    current_checkpoint_id: Option<CheckpointId>,
    policy_profile: PolicyProfileId,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// Job - individual unit of work within a run
struct Job {
    job_id: JobId,
    run_id: RunId,
    job_type: JobType,    // Task | ToolInvocation | Subagent | Checkpoint
    priority: i32,
    queue: String,        // queue name for routing
    state: JobState,      // enum with state machine
    lease_owner: Option<WorkerId>,
    lease_expires_at: Option<DateTime<Utc>>,
    retry_count: i32,
    max_retries: i32,
    timeout_sec: i32,
    idempotency_key: String,
    payload: Json,        // job-specific data
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// Schedule - cron/periodic job trigger
struct Schedule {
    schedule_id: ScheduleId,
    workspace_id: WorkspaceId,
    tenant_id: TenantId,
    name: String,
    enabled: bool,
    cron_expr: String,    // standard cron
    timezone: String,     // IANA timezone
    next_run_at: Option<DateTime<Utc>>,
    last_run_at: Option<DateTime<Utc>>,
    misfire_policy: MisfirePolicy,  // Skip | RunOnce | CatchUp | Coalesce
    job_template: JobTemplate,      // template for creating jobs
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// Checkpoint - execution snapshot
struct Checkpoint {
    checkpoint_id: CheckpointId,
    run_id: RunId,
    job_id: JobId,
    step_index: i32,
    snapshot_ref: String,           // object storage reference
    workspace_diff_ref: Option<String>,
    cursor_state: Json,             // execution cursor/position
    pending_approvals: Vec<ApprovalId>,
    artifact_refs: Vec<String>,
    created_at: DateTime<Utc>,
}

// Event - append-only event log entry
struct Event {
    event_id: EventId,
    run_id: RunId,
    job_id: Option<JobId>,
    sequence_no: i64,       // monotonic per run
    event_type: EventType,  // enum
    payload: Json,
    timestamp: DateTime<Utc>,
}

// Approval Request - policy-gated pause
struct ApprovalRequest {
    approval_id: ApprovalId,
    run_id: RunId,
    job_id: JobId,
    action_type: ActionType,
    severity: Severity,     // Info | Warning | Critical
    summary: String,
    payload_ref: String,    // reference to full action details
    state: ApprovalState,   // Pending | Approved | Rejected | Expired
    requested_at: DateTime<Utc>,
    resolved_at: Option<DateTime<Utc>>,
    resolved_by: Option<UserId>,
    resolution_reason: Option<String>,
}

// Client Attachment - UI client connection
struct ClientAttachment {
    attachment_id: Uuid,
    run_id: RunId,
    client_type: ClientType,    // Terminal | Web | Desktop
    client_session_id: String,
    attachment_state: AttachmentState,  // Attached | Detached | Stale | Revoked
    permissions: PermissionSet,         // read, write, approve
    last_seen_at: DateTime<Utc>,
    replay_cursor: i64,         // event sequence position
    reconnect_token: String,
    created_at: DateTime<Utc>,
}

// Worker Lease - job execution claim
struct WorkerLease {
    lease_id: Uuid,
    job_id: JobId,
    worker_id: WorkerId,
    leased_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    heartbeat_at: DateTime<Utc>,
}
```

### State Machines

#### Run State Machine
```
States: Created, Planned, Queued, Running, AwaitingApproval, Paused, 
       Recovering, Completed, Failed, Cancelled

Transitions:
  Created → Planned          (planning complete)
  Planned → Queued           (enqueue for execution)
  Queued → Running           (worker picked up)
  Running → AwaitingApproval (policy gate triggered)
  Running → Paused           (explicit pause)
  Running → Checkpointing    (creating checkpoint)
  Running → Completed        (success)
  Running → Failed           (error, no more retries)
  AwaitingApproval → Running (approved)
  AwaitingApproval → Failed  (rejected/timed out)
  Paused → Running           (resume)
  Paused → Cancelled         (cancel)
  Failed → Recovering        (recovery initiated)
  Recovering → Running       (checkpoint restored)
  Any → Cancelled            (explicit cancel)
```

#### Job State Machine
```
States: Scheduled, Queued, Leased, Starting, Running, Checkpointing,
       AwaitingApproval, RetryBackoff, Completed, Failed, DeadLetter, Cancelled

Transitions:
  Scheduled → Queued         (ready to execute)
  Queued → Leased            (worker claimed)
  Leased → Starting          (worker preparing)
  Starting → Running         (execution began)
  Running → Checkpointing    (creating checkpoint)
  Running → AwaitingApproval (approval required)
  Running → Completed        (success)
  Running → RetryBackoff     (transient failure)
  Running → Failed           (terminal failure)
  RetryBackoff → Queued      (retry)
  Failed → DeadLetter        (max retries exceeded)
  Any → Cancelled            (explicit cancel)
```

### Event Types

```rust
enum EventType {
    // Run lifecycle
    RunCreated,
    RunPlanned,
    RunQueued,
    RunStarted,
    RunPaused,
    RunAwaitingApproval,
    RunRecovering,
    RunCompleted,
    RunFailed,
    RunCancelled,
    
    // Job lifecycle
    JobScheduled,
    JobQueued,
    JobLeased,
    JobStarted,
    JobCheckpointCreated,
    JobRetryScheduled,
    JobCompleted,
    JobFailed,
    JobDeadLettered,
    
    // Client attachment
    ClientAttached,
    ClientDetached,
    ClientStale,
    
    // Tool execution
    ToolInvocationStarted,
    ToolInvocationCompleted,
    ToolInvocationFailed,
    
    // Approvals
    ApprovalRequested,
    ApprovalApproved,
    ApprovalRejected,
    ApprovalExpired,
    
    // Artifacts
    ArtifactCreated,
    
    // Scheduler
    SchedulerTick,
    SchedulerJobEnqueued,
    SchedulerMisfireDetected,
    
    // Output streaming
    TokenStream,
    ShellStdout,
    ShellStderr,
    LogMessage,
}
```

### API Endpoints

#### Run Management
```
POST   /api/v1/runs                    - Create run
GET    /api/v1/runs                    - List runs
GET    /api/v1/runs/:id                - Get run details
POST   /api/v1/runs/:id/pause          - Pause run
POST   /api/v1/runs/:id/resume         - Resume run
POST   /api/v1/runs/:id/cancel         - Cancel run
POST   /api/v1/runs/:id/recover        - Initiate recovery
GET    /api/v1/runs/:id/events         - Get run events (with cursor)
GET    /api/v1/runs/:id/artifacts      - List run artifacts
```

#### Attachment/Streaming
```
WS     /api/v1/runs/:id/stream         - WebSocket event stream
POST   /api/v1/runs/:id/attach         - Attach client
POST   /api/v1/runs/:id/detach         - Detach client
POST   /api/v1/runs/:id/replay         - Replay events from cursor
GET    /api/v1/runs/:id/attachments    - List active attachments
```

#### Schedule Management
```
POST   /api/v1/schedules               - Create schedule
GET    /api/v1/schedules               - List schedules
GET    /api/v1/schedules/:id           - Get schedule
PUT    /api/v1/schedules/:id           - Update schedule
DELETE /api/v1/schedules/:id           - Delete schedule
POST   /api/v1/schedules/:id/enable    - Enable schedule
POST   /api/v1/schedules/:id/disable   - Disable schedule
POST   /api/v1/schedules/:id/trigger   - Manual trigger
GET    /api/v1/schedules/:id/preview   - Preview next fire times
```

#### Approvals
```
GET    /api/v1/approvals               - List approvals
GET    /api/v1/approvals/pending       - List pending approvals
POST   /api/v1/approvals/:id/approve   - Approve action
POST   /api/v1/approvals/:id/reject    - Reject action
```

#### Checkpoints
```
GET    /api/v1/runs/:id/checkpoints    - List checkpoints
GET    /api/v1/checkpoints/:id         - Get checkpoint metadata
POST   /api/v1/runs/:id/restore        - Restore from checkpoint
```

---

## D. Repo Path Plan

### New Crates/Modules

```
/Cargo.toml                              - Add workspace members
/spec/                                   - New directory for specifications

# Control Plane (new crates)
/2-control-plane/
├── allternit-run-orchestration/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── run_service.rs      - Run lifecycle management
│       ├── state_machine.rs    - Run/Job state machines
│       └── validation.rs       - Transition validation
│
├── allternit-scheduler/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── scheduler_daemon.rs - Background scheduler service
│       ├── cron_parser.rs      - Cron expression handling
│       └── misfire_handler.rs  - Misfire policy implementation
│
├── allternit-attachment-registry/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── registry.rs         - Client attachment tracking
│       └── tokens.rs           - Reconnect token management
│
└── allternit-policy-engine/
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── engine.rs           - Policy evaluation
        ├── actions.rs          - Action classification
        └── rules.rs            - Policy rules

# Execution Plane (new crates)
/3-execution-plane/
├── allternit-worker-runtime/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── worker.rs           - Worker implementation
│       ├── lease_manager.rs    - Lease acquisition/renewal
│       ├── checkpoint.rs       - Checkpoint hooks
│       └── context.rs          - Task execution context
│
├── allternit-queue-dispatcher/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── dispatcher.rs       - Queue consumption
│       ├── lease_store.rs      - Lease persistence
│       └── retry_policy.rs     - Retry logic
│
├── allternit-tool-bridge/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── bridge.rs           - Tool routing
│       ├── receipts.rs         - Receipt emission
│       └── hooks.rs            - Policy hook injection
│
└── allternit-subagent-orch/
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── orchestrator.rs     - Parent/child run coordination
        └── dag.rs              - DAG execution

# State Plane (new crates)
/4-state-plane/
├── allternit-event-ledger/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── ledger.rs           - Event persistence
│       ├── replay.rs           - Replay/resume logic
│       └── ordering.rs         - Sequence guarantees
│
├── allternit-checkpoint-store/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── store.rs            - Checkpoint persistence
│       ├── snapshot.rs         - Snapshot management
│       └── restore.rs          - Restore logic
│
├── allternit-db-schema/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── migrations/         - SQL migrations
│       ├── entities.rs         - Diesel/sqlx entities
│       └── tenancy.rs          - Tenant isolation
│
└── allternit-read-models/
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── run_summary.rs      - Materialized run views
        └── dashboard.rs        - Dashboard queries

# Stream Gateway (new crate)
/5-stream-gateway/
├── allternit-stream-gateway/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── websocket.rs        - WS connection handling
│       ├── sse.rs              - SSE endpoint
│       ├── auth.rs             - Stream authentication
│       └── backpressure.rs     - Flow control

# Terminal Cowork (CLI extension)
CLI module
└── src/
    └── cowork/
        ├── mod.rs              - Cowork command module
        ├── commands.rs         - Subcommand definitions
        ├── tui/
        │   ├── mod.rs
        │   ├── run_list.rs     - Run list view
        │   ├── run_detail.rs   - Run detail/console view
        │   ├── approvals.rs    - Approval inbox view
        │   └── events.rs       - Event rendering
        ├── client.rs           - API client
        ├── attach.rs           - Attach/detach logic
        └── replay.rs           - Event replay handling
```

### Modified Files

```
CLI modulesrc/main.rs                 - Add 'cowork' subcommand
CLI modulesrc/commands/mod.rs         - Add cowork module
CLI moduleCargo.toml                  - Add cowork dependencies

API modulesrc/main.rs                 - Add cowork routes
API modulesrc/cowork_routes.rs        - New: cowork API routes
API moduleCargo.toml                  - Add cowork dependencies

/Cargo.toml                             - Add new workspace members
```

---

## E. DAG Execution Plan

### Phase 0: Spec + Architecture Audit (1-2 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T0.1 Write spec files | None | `/spec/*.md` files |
| T0.2 Define architecture | T0.1 | Architecture diagram |
| T0.3 Gap audit | T0.2 | Gap analysis report |
| T0.4 Create ADRs | T0.1 | `/spec/ADRs/*.md` |

### Phase 1: Contracts + Persistence (3-4 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T1.1 Domain model schemas | T0.1 | Entity definitions |
| T1.2 State machines | T1.1 | State machine code |
| T1.3 DB migrations | T1.1 | SQL migration files |
| T1.4 Event ledger | T1.1 | Event store impl |
| T1.5 Queue/lease model | T1.1 | Queue abstraction |
| T1.6 Checkpoint persistence | T1.1 | Checkpoint store |

### Phase 2: Control + Execution (4-5 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T2.1 Run orchestration | T1.1, T1.2 | Run service |
| T2.2 Schedule service | T1.3 | Scheduler service |
| T2.3 Attachment registry | T1.5 | Registry service |
| T2.4 Worker runtime | T1.5, T1.6 | Worker impl |
| T2.5 Queue dispatcher | T1.5, T2.4 | Dispatcher |
| T2.6 Tool bridge | T2.4 | Tool integration |
| T2.7 Policy engine | T2.1 | Policy evaluation |

### Phase 3: Continuity (3-4 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T3.1 Stream gateway | T1.4 | WS/SSE gateway |
| T3.2 Replay/resume | T1.4, T3.1 | Replay logic |
| T3.3 Approval workflow | T2.7 | Approval service |
| T3.4 Scheduler daemon | T2.2 | Background scheduler |
| T3.5 Recovery manager | T1.6, T2.4 | Recovery logic |

### Phase 4: Terminal Cowork (3-4 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T4.1 CLI command surface | T2.1, T2.3 | `gizzi cowork` commands |
| T4.2 TUI run list | T4.1 | Run list view |
| T4.3 TUI run detail | T4.2, T3.1 | Console view |
| T4.4 Attach/detach UX | T2.3, T3.2 | Reconnect flow |
| T4.5 Terminal approvals | T3.3 | Approval TUI |

### Phase 5: Web/Desktop Cowork (3-4 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T5.1 Shared client SDK | T3.1 | TypeScript SDK |
| T5.2 Cowork screens | T5.1 | React components |
| T5.3 Cross-surface | T4.4, T5.2 | Continuity tests |

### Phase 6: Hardening (3-4 days)

| Task | Dependencies | Deliverable |
|------|--------------|-------------|
| T6.1 Retries/DLQ | T2.5 | Dead letter handling |
| T6.2 Observability | All | Metrics, logs, traces |
| T6.3 Tenancy | All | Isolation enforcement |
| T6.4 Security | All | Secret redaction, ACLs |
| T6.5 Acceptance tests | All | E2E test suite |
| T6.6 Packaging | All | Deployment manifests |

### Critical Path

```
T0.1 → T0.2 → T1.1 → T1.2 → T1.3 → T2.1 → T2.2 → T2.4 → T2.5 → T3.1 → T3.2 → T3.4 → T4.1 → T4.4 → T6.5
  ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓      ↓
Spec → Arch → Data → State→  DB  → Run → Sched→ Work→ Queue→ Stream→Replay→Sched→ CLI →Attach→  E2E
```

### Minimum V1 Cut

For the smallest serious version, implement:
- T0.1–T1.3 (spec + data model + DB)
- T2.1, T2.2, T2.3 (control plane basics)
- T2.4, T2.5 (execution basics)
- T3.1, T3.2 (streaming + replay)
- T3.4 (scheduler daemon)
- T4.1, T4.4 (terminal cowork + attach)
- T6.5 (basic acceptance tests)

---

## Sign-off

This plan is ready for implementation. All sections are specified to the level required for production-grade development without placeholders.
