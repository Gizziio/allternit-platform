# Allternit Cowork Runtime — Architecture Document

## Overview

The Allternit Cowork Runtime implements a 4-plane architecture that separates concerns for durability, scalability, and maintainability.

## Four-Plane Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. PRESENTATION PLANE                                                        │
│    Terminal TUI │ Web UI │ Desktop App                                      │
│    - Attach/detach UX                                                       │
│    - Event rendering                                                        │
│    - Approval interactions                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. CONTROL PLANE                                                             │
│    Run Orchestration │ Schedule Service │ Attachment Registry │ Policy       │
│    - Lifecycle management                                                   │
│    - Cron evaluation                                                        │
│    - Client session tracking                                                │
│    - Policy decisions                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. EXECUTION PLANE                                                           │
│    Worker Runtime │ Queue Dispatcher │ Tool Bridge │ Subagent Orch          │
│    - Job execution                                                          │
│    - Lease management                                                       │
│    - Tool invocation                                                        │
│    - DAG coordination                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. STATE PLANE                                                               │
│    PostgreSQL │ Event Ledger │ Checkpoint Store │ Object Storage           │
│    - Relational metadata                                                    │
│    - Append-only events                                                     │
│    - Execution snapshots                                                    │
│    - Artifacts                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Plane 1: State Plane

### PostgreSQL (Relational Store)

**Tables:**

```sql
-- Core run metadata
tables: runs, jobs, schedules

-- Client attachments
tables: client_attachments

-- Approvals
tables: approval_requests

-- Worker coordination
tables: worker_leases, worker_pools

-- Checkpoints (metadata only, blobs in object storage)
tables: checkpoints

-- Policies
tables: policy_profiles, policy_rules
```

**Tenancy:** Every query filtered by `tenant_id` at the application layer.

### Event Ledger

- Append-only table: `events`
- Per-run monotonic sequence numbers
- Partitioned by `run_id` for query performance
- Cursor-based consumption for replay

### Checkpoint Store

- Metadata in PostgreSQL: `checkpoints` table
- Snapshots in object storage (S3-compatible)
- Deduplication via content hash

### Object Storage

- Checkpoints: `s3://{tenant}/checkpoints/{run_id}/{checkpoint_id}.tar.gz`
- Artifacts: `s3://{tenant}/artifacts/{run_id}/{artifact_id}/{filename}`

## Plane 2: Execution Plane

### Worker Runtime

```rust
#[async_trait]
trait WorkerRuntime {
    /// Acquire a job lease from the queue
    async fn acquire_job(&self) -> Result<Option<JobLease>>;
    
    /// Heartbeat the lease to prevent expiration
    async fn heartbeat(&self, lease: &JobLease) -> Result<()>;
    
    /// Execute a job within the runtime context
    async fn execute(&self, job: Job, context: ExecutionContext) -> Result<JobResult>;
    
    /// Create a checkpoint at the current position
    async fn checkpoint(&self) -> Result<Checkpoint>;
    
    /// Release the lease (success or failure)
    async fn release_lease(&self, lease: JobLease, result: JobResult) -> Result<()>;
}
```

### Queue Dispatcher

- Polls `jobs` table for eligible jobs (state=Queued, lease_expired)
- Atomic lease acquisition via `UPDATE ... WHERE lease_expires_at < now()`
- Distributes to available workers

### Tool Bridge

- Routes tool invocations through Allternit driver interface
- Emits `ToolInvocationStarted/Completed/Failed` events
- Injects policy hooks before destructive actions

### Subagent Orchestration

- Spawns child runs for subagent tasks
- Streams child events to parent
- Coordinates parent checkpoint with child completion

## Plane 3: Control Plane

### Run Orchestration Service

```rust
trait RunOrchestration {
    async fn create_run(&self, spec: RunSpec) -> Result<Run>;
    async fn enqueue_run(&self, run_id: RunId) -> Result<()>;
    async fn transition_state(&self, run_id: RunId, to: RunState) -> Result<()>;
    async fn get_run_status(&self, run_id: RunId) -> Result<RunStatus>;
    async fn cancel_run(&self, run_id: RunId) -> Result<()>;
}
```

### Schedule Service

```rust
trait ScheduleService {
    async fn create_schedule(&self, spec: ScheduleSpec) -> Result<Schedule>;
    async fn evaluate_due_schedules(&self) -> Result<Vec<Schedule>>;
    async fn enqueue_schedule_job(&self, schedule: Schedule) -> Result<Job>;
    async fn compute_next_run(&self, schedule: &Schedule) -> Result<DateTime<Utc>>;
}
```

### Attachment Registry

```rust
trait AttachmentRegistry {
    async fn attach(&self, run_id: RunId, client: ClientInfo) -> Result<Attachment>;
    async fn detach(&self, attachment_id: AttachmentId) -> Result<()>;
    async fn mark_stale(&self, attachment_id: AttachmentId) -> Result<()>;
    async fn list_attachments(&self, run_id: RunId) -> Result<Vec<Attachment>>;
    async fn generate_reconnect_token(&self, attachment_id: AttachmentId) -> Result<String>;
}
```

### Policy Engine

```rust
trait PolicyEngine {
    async fn evaluate(&self, action: Action, context: Context) -> Result<PolicyDecision>;
}

enum PolicyDecision {
    Allow,
    RequireApproval(ApprovalRequest),
    Deny(String),
}
```

## Plane 4: Presentation Plane

### Terminal Cowork

Commands:
```
gizzi cowork start <prompt>          # Create + attach
gizzi cowork attach <run-id>         # Reattach with replay
gizzi cowork detach                  # Detach, leave running
gizzi cowork ls                      # List runs
gizzi cowork logs <run-id>           # Show history
gizzi cowork pause/resume/cancel     # Control runs
gizzi cowork approvals               # Show pending
gizzi cowork approve/reject <id>     # Resolve
gizzi cowork schedule *              # Schedule management
```

### Web/Desktop

Shared TypeScript SDK provides:
- `CoworkClient` for API interactions
- `EventStream` for WebSocket/SSE streaming
- `ReplayBuffer` for cursor management
- React hooks: `useRun()`, `useEventStream()`, `useApprovals()`

## Data Flows

### Run Creation Flow

```
1. Client: POST /api/v1/runs
2. Control Plane: Create run record (state=Created)
3. Control Plane: Plan → Enqueue (state=Queued)
4. State Plane: Insert job record
5. Queue Dispatcher: Acquire lease
6. Execution Plane: Execute job
7. Event Ledger: Emit events
8. Stream Gateway: Broadcast to attached clients
```

### Reconnect Flow

```
1. Client: WS /api/v1/runs/:id/stream
2. Stream Gateway: Authenticate, get last cursor
3. Event Ledger: Query events from cursor
4. Stream Gateway: Replay missed events
5. Stream Gateway: Subscribe to new events
6. Client: Receive replay + live stream
```

### Scheduled Job Flow

```
1. Scheduler Daemon: Periodic tick (1 min)
2. Schedule Service: SELECT due schedules
3. Schedule Service: Enqueue job per schedule
4. Queue Dispatcher: Normal job flow
5. Schedule Service: Compute next_run_at
```

### Recovery Flow

```
1. Worker crash detected (lease timeout)
2. Queue Dispatcher: Mark job as recoverable
3. Recovery Manager: Find latest checkpoint
4. Recovery Manager: Restore context
5. Recovery Manager: Resume from checkpoint
6. Event Ledger: Emit recovery event
```

## Component Interactions

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Terminal  │────▶│   Stream    │◀────│   Event     │
│   Client    │◀────│   Gateway   │────▶│   Ledger    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Control   │────▶│    Run      │────▶│  PostgreSQL │
│   API       │     │ Orchestration│     │  (metadata) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Worker    │◀────│    Queue    │────▶│    Job      │
│   Runtime   │────▶│  Dispatcher │◀────│   Queue     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Object    │
                    │   Storage   │
                    │(checkpoints)│
                    └─────────────┘
```

## Deployment Architecture

### Single VPS (BYOC Model)

```
┌─────────────────────────────────────────┐
│           User's BYOC VPS               │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │  API    │  │Scheduler│  │ Stream  │ │
│  │ Server  │  │ Daemon  │  │ Gateway │ │
│  │ :3000   │  │ (cron)  │  │ :3001   │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
│       └─────────────┴─────────────┘     │
│                     │                   │
│       ┌─────────────┴─────────────┐     │
│       │      PostgreSQL           │     │
│       │      (Docker/local)       │     │
│       └─────────────┬─────────────┘     │
│                     │                   │
│       ┌─────────────┴─────────────┐     │
│       │     MinIO / S3-compat     │     │
│       │     (optional, for VPS)   │     │
│       └───────────────────────────┘     │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Worker  │  │ Worker  │  │ Worker  │ │
│  │ Pool 1  │  │ Pool 2  │  │ Pool 3  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| API Server | 3000 | HTTP |
| Stream Gateway | 3001 | WebSocket |
| PostgreSQL | 5432 | TCP |
| MinIO (S3) | 9000 | HTTP |

## Security Model

### Authentication

- JWT tokens for API access
- Signed reconnect tokens for stream reattachment
- Token expiration and rotation

### Authorization

- RBAC: read, write, approve, admin per workspace
- Policy engine for action classification
- Tenancy isolation at query level

### Data Protection

- Secrets redacted from events (pattern matching)
- Encrypted checkpoints at rest (optional)
- TLS for all client connections

---

*Last updated: 2026-03-09*
