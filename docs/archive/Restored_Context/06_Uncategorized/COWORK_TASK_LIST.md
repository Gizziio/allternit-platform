# Allternit Cowork Runtime - Master Task List

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              UNIFIED CONTROL PLANE                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ Run Service │  │ Job Queue   │  │ Scheduler   │  │ Event       │  │ Policy    │ │
│  │ (Lifecycle) │  │ (Priority)  │  │ (Cron)      │  │ Ledger      │  │ Engine    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         └─────────────────┴─────────────────┴─────────────────┴───────────────┘     │
│                                    │                                                  │
│  ┌─────────────────────────────────┴─────────────────────────────────────────────┐   │
│  │                         STATE PLANE (SQLite/Postgres)                          │   │
│  │  runs │ jobs │ schedules │ events │ checkpoints │ approvals │ attachments      │   │
│  └────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │  LOCAL RUNTIME   │  │  REMOTE RUNTIME  │  │  STREAM GATEWAY  │
        │  (Apple VF/      │  │  (allternit-node on    │  │  (WebSocket/     │
        │   Firecracker)   │  │   VPS/BYOC)      │  │   SSE fan-out)   │
        └──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Module 1: Control Plane Foundation
**Status:** 🔄 IN PROGRESS  
**Goal:** Establish the central orchestration layer

### 1.1 Database Schema
- [ ] **1.1.1** Create `runs` table migration
  - Fields: id, name, status, mode(local/remote/cloud), runtime_id, owner_id, config, created_at, updated_at, completed_at
  - Status enum: pending, planning, queued, running, paused, completed, failed, cancelled
  - Dependencies: None
  - Est: 2h

- [ ] **1.1.2** Create `jobs` table migration  
  - Fields: id, run_id, name, status, priority, queue_position, scheduled_at, started_at, completed_at, result, error
  - Dependencies: 1.1.1
  - Est: 2h

- [ ] **1.1.3** Create `schedules` table migration
  - Fields: id, name, cron_expr, natural_lang, job_template, enabled, next_run_at, last_run_at, misfire_policy
  - Dependencies: None
  - Est: 2h

- [ ] **1.1.4** Create `events` table migration
  - Fields: id, run_id, sequence, event_type, payload, created_at, client_cursor
  - Dependencies: 1.1.1
  - Est: 2h

- [ ] **1.1.5** Create `attachments` table migration
  - Fields: id, run_id, client_type, client_id, attached_at, last_seen_at, cursor_position
  - Dependencies: 1.1.1
  - Est: 1h

- [ ] **1.1.6** Create `checkpoints` table migration
  - Fields: id, run_id, step_cursor, workspace_state, approval_state, created_at
  - Dependencies: 1.1.1
  - Est: 1h

### 1.2 Data Models (Rust)
- [ ] **1.2.1** Define `Run` struct with state machine
  - States: Pending → Planning → Queued → Running → [Paused] → [Completed/Failed/Cancelled]
  - Methods: transition(), can_transition(), state_duration()
  - Dependencies: 1.1.1
  - Est: 4h

- [ ] **1.2.2** Define `Job` struct with priority ordering
  - Implement `Ord` for priority queue
  - Dependencies: 1.1.2
  - Est: 2h

- [ ] **1.2.3** Define `Schedule` struct with RRULE parsing
  - Integration with existing cron parser
  - Dependencies: 1.1.3
  - Est: 3h

- [ ] **1.2.4** Define `Event` struct with serialization
  - Event types: run_started, step_started, step_completed, output, error, approval_needed, approval_given
  - Dependencies: 1.1.4
  - Est: 3h

- [ ] **1.2.5** Define `Attachment` struct
  - Track multiple clients watching same run
  - Dependencies: 1.1.5
  - Est: 2h

### 1.3 Core Services
- [ ] **1.3.1** Implement `RunService` trait
  - Methods: create(), get(), list(), cancel(), pause(), resume(), delete()
  - State machine enforcement
  - Dependencies: 1.2.1
  - Est: 6h

- [ ] **1.3.2** Implement `RunServiceImpl`
  - Database operations via sqlx
  - Event emission on state changes
  - Dependencies: 1.3.1
  - Est: 4h

- [ ] **1.3.3** Integrate Job Queue with Run lifecycle
  - Enqueue jobs when run enters "queued" state
  - Update run status based on job completion
  - Dependencies: 1.3.2, existing executor
  - Est: 4h

- [ ] **1.3.4** Implement `EventStore` service
  - Append-only writes
  - Cursor-based reads with replay
  - Backfill for reconnecting clients
  - Dependencies: 1.2.4
  - Est: 6h

### 1.4 API Layer
- [ ] **1.4.1** Create `/api/v1/runs` routes
  - POST /runs - Create run
  - GET /runs - List runs (with filtering/pagination)
  - GET /runs/:id - Get run details
  - POST /runs/:id/cancel - Cancel run
  - POST /runs/:id/pause - Pause run
  - POST /runs/:id/resume - Resume run
  - Dependencies: 1.3.2
  - Est: 4h

- [ ] **1.4.2** Create `/api/v1/runs/:id/events` SSE endpoint
  - Server-sent events for real-time streaming
  - Support `?cursor=` for replay from position
  - Heartbeat keepalive
  - Dependencies: 1.3.4
  - Est: 4h

- [ ] **1.4.3** Create `/api/v1/jobs` routes
  - GET /jobs - List jobs for a run
  - GET /jobs/:id - Get job details
  - Dependencies: 1.2.2
  - Est: 2h

- [ ] **1.4.4** Create `/api/v1/schedules` routes
  - CRUD for schedules
  - POST /schedules/:id/enable, /disable
  - Dependencies: 1.2.3
  - Est: 3h

- [ ] **1.4.5** Add WebSocket endpoint `/ws/runs/:id`
  - Bidirectional for approvals/interaction
  - Fallback to SSE
  - Dependencies: 1.4.2
  - Est: 4h

**Module 1 Deliverables:**
- [ ] Control plane API server with Run CRUD
- [ ] Event streaming (SSE + WebSocket)
- [ ] Database with runs/jobs/schedules/events tables
- [ ] Integration with existing executor job queue

---

## Module 2: Local Runtime Integration
**Status:** ⏳ PENDING  
**Goal:** Connect local VM to control plane

### 2.1 Runtime Adapter
- [ ] **2.1.1** Create `LocalRuntime` struct
  - Wraps existing VM drivers (Apple VF, Firecracker)
  - Implements `Runtime` trait for unified interface
  - Dependencies: Module 1 complete
  - Est: 4h

- [ ] **2.1.2** Implement `Runtime` trait methods
  - start(), stop(), status(), attach(), detach()
  - Map VM states to Run states
  - Dependencies: 2.1.1
  - Est: 4h

- [ ] **2.1.3** Create runtime registration with control plane
  - Register local runtime on startup
  - Heartbeat/health checks
  - Dependencies: 2.1.2
  - Est: 3h

### 2.2 VM ↔ Control Plane Bridge
- [ ] **2.2.1** Extend guest agent protocol for control plane
  - Add event types: step_started, step_completed, output
  - Dependencies: 2.1.1
  - Est: 3h

- [ ] **2.2.2** Create control plane client in VM runtime
  - Report VM events to control plane
  - Receive commands (pause, cancel)
  - Dependencies: 2.2.1
  - Est: 4h

- [ ] **2.2.3** Integrate file sync with run context
  - Associate synced files with run_id
  - Dependencies: existing sync code
  - Est: 3h

### 2.3 Session Management
- [ ] **2.3.1** Connect session multiplexer to control plane
  - Register sessions as run attachments
  - Stream session I/O through event ledger
  - Dependencies: 2.2.2
  - Est: 4h

- [ ] **2.3.2** Implement detach/reattach for local sessions
  - Persist session state on detach
  - Restore on reattach with replay
  - Dependencies: 2.3.1
  - Est: 4h

**Module 2 Deliverables:**
- [ ] Local VM runtime connects to control plane
- [ ] VM events appear in control plane event stream
- [ ] Sessions register as attachments
- [ ] Detach/reattach works with replay

---

## Module 3: Remote Runtime (allternit-node Integration)
**Status:** ⏳ PENDING  
**Goal:** Extend allternit-node for run lifecycle

### 3.1 allternit-node Extension
- [ ] **3.1.1** Add Run model to allternit-node
  - Mirror control plane Run struct
  - Track local execution state
  - Dependencies: Module 1 models
  - Est: 3h

- [ ] **3.1.2** Implement run lifecycle hooks
  - on_run_start(), on_run_complete(), on_run_cancel()
  - Report to control plane via WebSocket
  - Dependencies: 3.1.1
  - Est: 4h

- [ ] **3.1.3** Extend job executor for run context
  - Associate jobs with run_id
  - Propagate run config to containers
  - Dependencies: 3.1.2
  - Est: 3h

### 3.2 Control Plane Integration
- [ ] **3.2.1** Create node registration endpoint
  - POST /api/v1/nodes/register
  - Heartbeat endpoint POST /api/v1/nodes/:id/heartbeat
  - Dependencies: Module 1
  - Est: 3h

- [ ] **3.2.2** Implement node discovery/selection
  - Select node for new run based on capacity/location
  - Store node_id on run
  - Dependencies: 3.2.1
  - Est: 3h

- [ ] **3.2.3** Node→Control Plane event relay
  - Receive events from node WebSocket
  - Store in event ledger
  - Fan out to attached clients
  - Dependencies: 3.2.2, 1.3.4
  - Est: 4h

### 3.3 BYOC VPS Support
- [ ] **3.3.1** Integrate cloud-providers for VPS provisioning
  - Provision VPS on run creation (if needed)
  - Install allternit-node on new VPS
  - Dependencies: existing cloud-providers
  - Est: 4h

- [ ] **3.3.2** Implement node bootstrap via cloud-wizard
  - Use existing wizard for node setup
  - Store node credentials securely
  - Dependencies: existing cloud-wizard
  - Est: 3h

- [ ] **3.3.3** Add VPS connection management
  - SSH key management (cloud-ssh)
  - Connection pooling
  - Dependencies: existing cloud-ssh
  - Est: 3h

**Module 3 Deliverables:**
- [ ] allternit-node reports runs to control plane
- [ ] VPS provisioning integrated
- [ ] Remote runs work end-to-end
- [ ] Node health monitoring

---

## Module 4: Scheduler Service
**Status:** ⏳ PENDING  
**Goal:** Server-side scheduling daemon

### 4.1 Cron Integration
- [ ] **4.1.1** Extract cron parser to shared package
  - Move from cmd/gizzi-code to shared crate
  - Clean up dependencies
  - Est: 3h

- [ ] **4.1.2** Create ScheduleService trait
  - Methods: create(), update(), delete(), get_next_runs()
  - Dependencies: 1.2.3, 4.1.1
  - Est: 3h

- [ ] **4.1.3** Implement natural language to cron
  - "every day at 9am" → "0 9 * * *"
  - Dependencies: existing cron parser
  - Est: 2h

### 4.2 Scheduler Daemon
- [ ] **4.2.1** Create scheduler daemon binary
  - Loop: sleep until next scheduled job, enqueue, repeat
  - Dependencies: 4.1.2
  - Est: 4h

- [ ] **4.2.2** Implement misfire handling
  - Config: ignore, fire_once, fire_all
  - Track misfires in database
  - Dependencies: 4.2.1
  - Est: 3h

- [ ] **4.2.3** Add scheduler metrics/observability
  - Scheduled job count, misfire count, latency
  - Dependencies: 4.2.2
  - Est: 2h

### 4.3 Schedule→Run Flow
- [ ] **4.3.1** Implement job templating
  - Schedule defines job template
  - Scheduler creates job instance from template
  - Dependencies: 4.2.1
  - Est: 3h

- [ ] **4.3.2** Integrate with RunService
  - Schedule triggers run creation
  - Track schedule_id on run
  - Dependencies: 4.3.1, 1.3.2
  - Est: 2h

**Module 4 Deliverables:**
- [ ] Scheduler daemon running
- [ ] Cron schedules create runs
- [ ] Misfire handling works
- [ ] Natural language scheduling

---

## Module 5: Terminal Cowork CLI
**Status:** ⏳ PENDING  
**Goal:** Native terminal experience

### 5.1 Core Commands
- [ ] **5.1.1** Implement `gizzi cowork list`
  - Table view: ID, name, status, mode, created
  - Filtering: --status, --mode, --since
  - Dependencies: 1.4.1
  - Est: 3h

- [ ] **5.1.2** Implement `gizzi cowork start <name>`
  - Create run, start local VM or remote job
  - Auto-attach if --attach flag
  - Dependencies: 2.1.2 or 3.1.2
  - Est: 4h

- [ ] **5.1.3** Implement `gizzi cowork attach <run-id>`
  - Connect to running run
  - Stream events to terminal
  - Dependencies: 1.4.2, 5.1.2
  - Est: 4h

- [ ] **5.1.4** Implement `gizzi cowork detach`
  - Detach current session (keep run running)
  - Show detach key (Ctrl+B D)
  - Dependencies: 2.3.2
  - Est: 2h

- [ ] **5.1.5** Implement `gizzi cowork stop <run-id>`
  - Graceful shutdown
  - --force for immediate
  - Dependencies: 1.3.2
  - Est: 2h

- [ ] **5.1.6** Implement `gizzi cowork logs <run-id>`
  - View historical logs
  - --follow for live tail
  - --since for time range
  - Dependencies: 1.3.4
  - Est: 3h

### 5.2 Schedule Commands
- [ ] **5.2.1** Implement `gizzi cowork schedule create`
  - --cron for explicit cron
  - --every for natural language
  - --command for job command
  - Dependencies: 4.1.3
  - Est: 3h

- [ ] **5.2.2** Implement `gizzi cowork schedule list`
  - Show schedules with next run time
  - Est: 2h

- [ ] **5.2.3** Implement `gizzi cowork schedule enable/disable <id>`
  - Toggle schedule active state
  - Est: 2h

### 5.3 Interactive TUI
- [ ] **5.3.1** Create run list TUI
  - Interactive table with arrow key navigation
  - Enter to view details
  - Dependencies: 5.1.1
  - Est: 4h

- [ ] **5.3.2** Create run detail view
  - Show: status, events, attachments, jobs
  - Real-time event stream
  - Dependencies: 5.3.1, 1.4.2
  - Est: 4h

- [ ] **5.3.3** Add keyboard shortcuts
  - 'a' attach, 's' stop, 'd' detach, 'q' quit
  - Dependencies: 5.3.2
  - Est: 2h

### 5.4 Approval Integration
- [ ] **5.4.1** Detect approval_needed events
  - Pause event stream
  - Show prompt: "Approve [tool]? [y/n/i(info)]"
  - Dependencies: 1.4.2
  - Est: 3h

- [ ] **5.4.2** Send approval response
  - POST approval to API
  - Resume event stream
  - Dependencies: 5.4.1
  - Est: 2h

**Module 5 Deliverables:**
- [ ] Complete `gizzi cowork` command suite
- [ ] Interactive TUI for run management
- [ ] Approval workflow in terminal
- [ ] Detach/reattach with replay

---

## Module 6: Stream Gateway
**Status:** ⏳ PENDING  
**Goal:** Efficient event fan-out

### 6.1 Gateway Service
- [ ] **6.1.1** Create stream-gateway binary
  - Standalone service or integrated into API
  - Dependencies: 1.3.4
  - Est: 3h

- [ ] **6.1.2** Implement subscription management
  - Track WebSocket/SSE connections per run
  - Fan-out events to all subscribers
  - Dependencies: 6.1.1
  - Est: 3h

- [ ] **6.1.3** Add backpressure handling
  - Slow consumer detection
  - Drop or buffer policy
  - Dependencies: 6.1.2
  - Est: 3h

### 6.2 Multi-Client Synchronization
- [ ] **6.2.1** Implement cursor tracking per client
  - Each attachment has cursor position
  - Backfill missed events on reconnect
  - Dependencies: 1.2.5
  - Est: 3h

- [ ] **6.2.2** Add client presence
  - Show who's watching in TUI
  - Typing indicators for approvals
  - Dependencies: 6.2.1
  - Est: 2h

**Module 6 Deliverables:**
- [ ] Stream gateway handles fan-out
- [ ] Multiple clients can watch same run
- [ ] Backpressure handled gracefully

---

## Module 7: Checkpoint & Recovery
**Status:** ⏳ PENDING  
**Goal:** Execution snapshots and resume

### 7.1 Checkpoint Service
- [ ] **7.1.1** Implement `CheckpointService` trait
  - Methods: save(), load(), list(), delete()
  - Dependencies: 1.1.6
  - Est: 3h

- [ ] **7.1.2** Create checkpoint on step completion
  - Trigger: step_completed event
  - Store: cursor, workspace state, outputs
  - Dependencies: 7.1.1
  - Est: 3h

- [ ] **7.1.3** Implement workspace diff storage
  - Store only changes between checkpoints
  - Dependencies: 7.1.2
  - Est: 4h

### 7.2 Recovery Flow
- [ ] **7.2.1** Add resume from checkpoint
  - Load checkpoint on run resume
  - Restore workspace state
  - Dependencies: 7.1.2
  - Est: 4h

- [ ] **7.2.2** Handle crash recovery
  - Detect interrupted runs on startup
  - Offer resume or restart
  - Dependencies: 7.2.1
  - Est: 3h

**Module 7 Deliverables:**
- [ ] Automatic checkpointing
- [ ] Resume from checkpoint
- [ ] Crash recovery

---

## Module 8: Policy Engine
**Status:** ⏳ PENDING  
**Goal:** Approval workflow and governance

### 8.1 Policy Definitions
- [ ] **8.1.1** Create policy schema
  - Tool categories: safe, sensitive, dangerous
  - Per-tool approval requirements
  - Dependencies: None
  - Est: 3h

- [ ] **8.1.2** Implement policy storage
  - Database table for policies
  - User/org level policies
  - Dependencies: 8.1.1
  - Est: 2h

### 8.2 Approval Workflow
- [ ] **8.2.1** Detect policy violations
  - Before tool execution, check policy
  - Emit approval_needed event
  - Dependencies: 8.1.2
  - Est: 3h

- [ ] **8.2.2** Implement approval request handling
  - Store approval request state
  - Timeout handling
  - Dependencies: 8.2.1
  - Est: 3h

- [ ] **8.2.3** Resume after approval
  - On approval_given, continue execution
  - On denial, fail the step
  - Dependencies: 8.2.2
  - Est: 2h

**Module 8 Deliverables:**
- [ ] Policy-based approvals
- [ ] Multi-client approval coordination
- [ ] Audit trail of approvals

---

## Module 9: Client SDK & Web UI
**Status:** ⏳ PENDING  
**Goal:** Cross-surface continuity

### 9.1 Shared Client SDK
- [ ] **9.1.1** Create `cowork-client` TypeScript package
  - API client for control plane
  - Event stream consumer
  - Dependencies: Module 1
  - Est: 4h

- [ ] **9.1.2** Add React hooks
  - useRun(), useEvents(), useAttachment()
  - Dependencies: 9.1.1
  - Est: 3h

### 9.2 Web Interface
- [ ] **9.2.1** Create runs list page
  - Similar to TUI but web-based
  - Dependencies: 9.1.2
  - Est: 4h

- [ ] **9.2.2** Create run detail page
  - Event stream viewer
  - Approval UI
  - Dependencies: 9.2.1
  - Est: 4h

- [ ] **9.2.3** Add schedule management UI
  - CRUD for schedules
  - Dependencies: 9.2.2
  - Est: 3h

### 9.3 Desktop Integration
- [ ] **9.3.1** Integrate cowork-client into desktop app
  - Share state with terminal sessions
  - Dependencies: 9.1.1
  - Est: 3h

- [ ] **9.3.2** Add cowork panel to desktop
  - Run list sidebar
  - Active run viewer
  - Dependencies: 9.3.1
  - Est: 4h

**Module 9 Deliverables:**
- [ ] Shared client SDK
- [ ] Web cowork interface
- [ ] Desktop cowork panel
- [ ] Cross-surface state sync

---

## Module 10: Testing & Hardening
**Status:** ⏳ PENDING  
**Goal:** Production readiness

### 10.1 Integration Tests
- [ ] **10.1.1** Test local run lifecycle
  - Create → Run → Complete
  - Est: 3h

- [ ] **10.1.2** Test remote run lifecycle
  - Provision → Run → Cleanup
  - Est: 3h

- [ ] **10.1.3** Test detach/reattach
  - Multiple clients, replay, cursor sync
  - Est: 3h

- [ ] **10.1.4** Test scheduler
  - Cron execution, misfire handling
  - Est: 2h

### 10.2 Load Tests
- [ ] **10.2.1** Test event stream under load
  - 1000 concurrent runs, 100 clients each
  - Est: 4h

- [ ] **10.2.2** Test checkpoint performance
  - Large workspace snapshots
  - Est: 3h

### 10.3 Security Audit
- [ ] **10.3.1** Review authentication/authorization
  - API key validation
  - Run access control
  - Est: 4h

- [ ] **10.3.2** Audit event ledger for leaks
  - Ensure no sensitive data in events
  - Est: 2h

### 10.4 Documentation
- [ ] **10.4.1** Write API documentation
  - OpenAPI spec
  - Est: 4h

- [ ] **10.4.2** Write user guide
  - CLI reference, TUI guide
  - Est: 4h

**Module 10 Deliverables:**
- [ ] Comprehensive test suite
- [ ] Performance benchmarks
- [ ] Security audit passed
- [ ] Documentation complete

---

## Integration Points Matrix

| Component | Depends On | Required By |
|-----------|------------|-------------|
| RunService | DB models | All modules |
| EventStore | DB models, RunService | Stream Gateway, CLI TUI |
| Job Queue | RunService | Scheduler, Local/Remote Runtime |
| LocalRuntime | RunService, EventStore | CLI start command |
| RemoteRuntime (allternit-node) | RunService, EventStore | VPS deployment |
| Stream Gateway | EventStore, Attachments | CLI attach, Web UI |
| Scheduler | RunService, Job Queue, Cron | CLI schedule commands |
| Checkpoint | RunService, EventStore | Recovery flows |
| Policy Engine | RunService, EventStore | Approval workflow |
| CLI | All services | End user |
| Web UI | Client SDK, API | End user |

---

## Progress Tracker

```
Module 1: Control Plane Foundation    [░░░░░░░░░░] 0%
Module 2: Local Runtime Integration   [░░░░░░░░░░] 0%
Module 3: Remote Runtime (allternit-node)   [░░░░░░░░░░] 0%
Module 4: Scheduler Service           [░░░░░░░░░░] 0%
Module 5: Terminal Cowork CLI         [░░░░░░░░░░] 0%
Module 6: Stream Gateway              [░░░░░░░░░░] 0%
Module 7: Checkpoint & Recovery       [░░░░░░░░░░] 0%
Module 8: Policy Engine               [░░░░░░░░░░] 0%
Module 9: Client SDK & Web UI         [░░░░░░░░░░] 0%
Module 10: Testing & Hardening        [░░░░░░░░░░] 0%

Overall: [░░░░░░░░░░] 0%
```

---

## Current Status

**Active:** Module 1.1.1 - Create `runs` table migration  
**Next:** Module 1.1.2 - Create `jobs` table migration

Ready to begin implementation.
