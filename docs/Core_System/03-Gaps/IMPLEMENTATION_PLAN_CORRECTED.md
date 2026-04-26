# Allternit Cowork Runtime - Implementation Plan

## Strategy
**Extend, don't rebuild.** The Rails system exists in an external workspace (check Desktop for current location). This project integrates with it.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Terminal │ Web │ Desktop                                                    │
└────┬────────────────────────────────────────────────────────────────────────┘
     │
┌────┴────────────────────────────────────────────────────────────────────────┐
│ Allternit Rails Service (from Desktop workspace)                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │  Ledger  │ │   Gate   │ │  Leases  │ │   Mail   │ │  Vault   │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                         │
│ │ WorkOps  │ │  Index   │ │ Receipts │ │ Context  │                         │
│ │  (DAGs)  │ │ (SQLite) │ │          │ │  Packs   │                         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴─────────────────────────────────────────┐
│ THIS WORKSPACE - Extensions                                                  │
│                                                                              │
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐         │
│ │   allternit-cowork-runtime   │  │    allternit-scheduler       │         │
│ │   - Run lifecycle            │  │    - Cron evaluation         │         │
│ │   - Attach/detach            │  │    - Schedule triggers       │         │
│ │   - Checkpoints (ContextPack)│  │    - Misfire handling        │         │
│ │   - Event streaming          │  │    - Postgres storage        │         │
│ └──────────────────────────────┘  └──────────────────────────────┘         │
│                                                                              │
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐         │
│ │   VM Execution Bridge        │  │    API Routes                │         │
│ │   - Lease acquisition        │  │    - /cowork/runs/*          │         │
│ │   - Event emission           │  │    - /cowork/attach/*        │         │
│ │   - Checkpoint hooks         │  │    - /cowork/schedules/*     │         │
│ └──────────────────────────────┘  └──────────────────────────────┘         │
│                                                                              │
│ ┌──────────────────────────────┐                                            │
│ │   CLI Cowork Module          │                                            │
│ │   - gizzi cowork start       │                                            │
│ │   - gizzi cowork attach      │                                            │
│ │   - gizzi cowork schedule    │                                            │
│ └──────────────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Rails Integration (1-2 days)

**Goal**: Integrate existing Rails service into this workspace

**Tasks**:
1. Add `allternit-agent-system-rails` as path dependency
2. Create workspace service wrapper
3. Add HTTP API routes for Rails operations
4. WebSocket bridge for Ledger streaming

**Files**:
- `Cargo.toml` - Add Rails workspace member
- `7-apps/api/src/rails_routes.rs` - HTTP routes
- `7-apps/api/src/stream_gateway.rs` - WebSocket streaming

### Phase 2: Cowork Runtime (2-3 days)

**Goal**: Run lifecycle, attach/detach, checkpoints

**Tasks**:
1. Define Run/Job types mapping to Rails primitives
2. Run state machine (Created → Running → Completed/Failed)
3. Attachment registry (who's connected)
4. Checkpoint using ContextPacks
5. Event replay from Ledger

**Files**:
- `allternit-cowork-runtime/src/lib.rs`
- `allternit-cowork-runtime/src/run.rs`
- `allternit-cowork-runtime/src/attachment.rs`
- `allternit-cowork-runtime/src/checkpoint.rs`

### Phase 3: Scheduler (1-2 days)

**Goal**: Cron-based scheduled execution

**Tasks**:
1. Schedule storage (Postgres)
2. Cron expression evaluation
3. Scheduler daemon (periodic tick)
4. Misfire policies
5. Trigger via Rails WorkOps

**Files**:
- `allternit-scheduler/src/lib.rs`
- `allternit-scheduler/src/daemon.rs`
- `allternit-scheduler/src/cron.rs`

### Phase 4: Terminal Cowork (2-3 days)

**Goal**: CLI commands for cowork mode

**Tasks**:
1. `cowork` subcommand tree
2. Run list/detail views
3. Attach with event streaming
4. Schedule management
5. Approval interactions

**Files**:
- `7-apps/cli/src/cowork/mod.rs`
- `7-apps/cli/src/cowork/commands.rs`
- `7-apps/cli/src/cowork/tui.rs`
- `7-apps/cli/src/cowork/client.rs`

### Phase 5: VM Integration (1-2 days)

**Goal**: VM execution emits Rails events

**Tasks**:
1. VM executor acquires leases
2. Emits Ledger events
3. Checkpoint hooks
4. Recovery from ContextPacks

**Files**:
- `allternit-vm-executor/src/rails_bridge.rs`

## Data Model Mapping

### Rails Primitives → Cowork Concepts

| Rails | Cowork | Usage |
|-------|--------|-------|
| `DagState` | `Run` | A cowork run is a DAG of work |
| `DagNode` | `Job` | Individual job in a run |
| `LedgerEvent` | `Event` | All lifecycle events |
| `Lease` | `WorkerLease` | Worker claims job |
| `ContextPack` | `Checkpoint` | Execution snapshot |
| `Gate` + Receipt | `Approval` | Policy-gated pause |
| `Mail` | `EventBus` | Async messages |

### New Types (Cowork Layer)

```rust
// Runtime identifier
pub struct RunId(pub Uuid);

// Run ties together Rails primitives
pub struct Run {
    pub id: RunId,
    pub dag_id: String,           // Rails DAG ID
    pub tenant_id: String,
    pub workspace_id: String,
    pub mode: RunMode,            // Interactive | Cowork | Scheduled
    pub state: RunState,
    pub entrypoint: String,       // Initial prompt/command
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Client attachment
pub struct Attachment {
    pub id: Uuid,
    pub run_id: RunId,
    pub client_type: ClientType,  // Terminal | Web | Desktop
    pub session_token: String,
    pub last_event_cursor: i64,   // Ledger sequence
    pub attached_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
}

// Schedule for cron jobs
pub struct Schedule {
    pub id: Uuid,
    pub workspace_id: String,
    pub name: String,
    pub cron_expr: String,
    pub timezone: String,
    pub enabled: bool,
    pub next_run_at: DateTime<Utc>,
    pub job_template: JobTemplate,
    pub misfire_policy: MisfirePolicy,
}
```

## State Machines

### Run State Machine
```
Created → Planned → Queued → Running → [Paused → Running]
                                            ↓
                                    AwaitingApproval → Running
                                            ↓
                                       Completed/Failed/Cancelled
```

### Job State Machine (Rails DagNode)
```
NEW → READY → RUNNING → DONE/FAILED
```

### Attachment State
```
Attached → Detached → Stale (timeout)
```

## API Routes

### Cowork API
```
POST   /api/v1/cowork/runs              # Create run
GET    /api/v1/cowork/runs              # List runs
GET    /api/v1/cowork/runs/:id          # Get run
POST   /api/v1/cowork/runs/:id/cancel   # Cancel run

WS     /api/v1/cowork/runs/:id/stream   # Event stream
POST   /api/v1/cowork/runs/:id/attach   # Attach client
POST   /api/v1/cowork/runs/:id/detach   # Detach client

GET    /api/v1/cowork/schedules         # List schedules
POST   /api/v1/cowork/schedules         # Create schedule
PATCH  /api/v1/cowork/schedules/:id     # Update schedule
POST   /api/v1/cowork/schedules/:id/trigger  # Manual run
```

## CLI Commands

```bash
# Run management
gizzi cowork start "<prompt>"           # Create and attach
gizzi cowork attach <run-id>            # Reattach to run
gizzi cowork detach                     # Detach (keep running)
gizzi cowork ls                         # List runs
gizzi cowork logs <run-id>              # Show history
gizzi cowork cancel <run-id>            # Stop run

# Schedule management
gizzi cowork schedule create --name "daily" --cron "0 9 * * *" --command "..."
gizzi cowork schedule ls
gizzi cowork schedule pause/resume <id>
gizzi cowork schedule trigger <id>
gizzi cowork schedule delete <id>

# Approvals
gizzi cowork approvals                  # List pending
gizzi cowork approve <id>
gizzi cowork reject <id>
```

## Integration Points

### 1. Rails Service Startup
```rust
// In API server main.rs
let rails = allternit_agent_system_rails::service::ServiceState::new(
    PathBuf::from("/var/lib/allternit")
).await?;
```

### 2. VM Executor Bridge
```rust
// Before VM execution
let lease = rails.leases.acquire(LeaseRequest { ... }).await?;
rails.ledger.emit(event).await?;

// After VM execution
rails.leases.release(lease).await?;
rails.ledger.emit(completion_event).await?;
```

### 3. Event Streaming
```rust
// Subscribe to Ledger events
let events = rails.ledger.query(LedgerQuery {
    since: Some(cursor),
    scope: Some(EventScope::Dag(dag_id)),
}).await?;
```

## Deployment

```yaml
# docker-compose.yml
services:
  allternit-api:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"  # WebSocket
    volumes:
      - /var/lib/allternit:/var/lib/allternit  # Rails data
      
  allternit-scheduler:
    build: .
    command: scheduler
    environment:
      - DATABASE_URL=postgres://.../
```

## Success Criteria

1. ✅ Create run from terminal → runs persist after disconnect
2. ✅ Reattach → see all missed events
3. ✅ Schedule job → executes without client connected
4. ✅ VM crash → recover from ContextPack checkpoint
5. ✅ Cross-surface → same run visible in web/terminal

---

Ready to implement Phase 1?
