# A2R Cowork Runtime - Architecture Audit & Unified Plan

## Executive Summary

The codebase contains **two distinct runtime architectures** that need to be unified:

1. **Local VM Runtime** (What we just built) - Apple VF/Firecracker VMs on user's machine
2. **Distributed Cloud Runtime** (Existing) - a2r-node agent on VPS with control plane

The DAG describes a **third hybrid architecture** that combines both.

---

## Existing Components Inventory

### 1. Local VM Runtime (Just Built)
**Location:** `1-kernel/cowork/`, `cmd/gizzi-code/src/runtime/automation/cron/`

| Component | Status | Lines | Purpose |
|-----------|--------|-------|---------|
| Apple VF Driver | ✅ | 1,427 | macOS VM management |
| Firecracker Driver | ✅ | 2,012 | Linux microVM management |
| VM Image Manager | ✅ | 1,914 | Download/build VM images |
| Transport Layer | ✅ | 1,800 | VSOCK/VZVirtioSocket |
| Protocol Codec | ✅ | 2,084 | a2r-guest-agent-protocol |
| Desktop VM Manager | ✅ | 3,598 | Electron VM orchestration |
| CLI Socket Client | ✅ | 4,791 | Terminal connection to VM |
| File Sync | ✅ | 3,557 | Host↔VM bidirectional sync |
| Session Multiplexing | ✅ | 4,508 | Multiple isolated sessions |
| Cron Scheduler | ✅ | 3,080 | Job scheduling with SQLite |

**Use Case:** Single-user local development, runs on user's machine

---

### 2. Distributed Cloud Runtime (Existing)
**Location:** `8-cloud/`

| Component | Status | Purpose | Assessment |
|-----------|--------|---------|------------|
| **a2r-node** | ✅ | Agent on user's VPS | **REUSE** - Core execution agent |
| **executor** | ✅ | Job queue service | **REUSE** - Priority queue, job scheduling |
| **a2r-cloud-api** | ✅ | Control plane API | **EXTEND** - Needs run/job/schedule APIs |
| **cloud-providers** | ✅ | Hetzner/DO/AWS/etc | **REUSE** - VPS provisioning |
| **cloud-ssh** | ✅ | SSH key management | **REUSE** - Node communication |
| **multi-region** | ✅ | Failover/replication | **DEFER** - Advanced feature |
| **cloud-wizard** | ✅ | Deployment wizard | **REUSE** - Node bootstrapping |
| **cloud-deploy** | ✅ | Orchestrator | **EXTEND** - Add run lifecycle |

**Use Case:** Multi-tenant cloud deployment, runs on VPS

**Key Files:**
- `8-cloud/a2r-node/src/main.rs` - Node agent with WebSocket reverse tunnel
- `8-cloud/executor/src/job_queue.rs` - Priority job queue
- `8-cloud/a2r-cloud-api/src/db/models.rs` - Deployment/Instance models
- `8-cloud/a2r-cloud-api/src/main.rs` - API server with SQLite/Postgres

---

### 3. Control Plane (Existing)
**Location:** `1-kernel/control-plane/`

| Component | Status | Purpose | Assessment |
|-----------|--------|---------|------------|
| **agent-orchestration** | ✅ | Workflow engine | **EXTEND** - Add run orchestration |
| **workflows** | ✅ | DAG execution | **REUSE** - Subagent orchestration |

---

### 4. Tenant System (Existing)
**Location:** `tenants/`

| Component | Status | Purpose | Assessment |
|-----------|--------|---------|------------|
| **summit_oic** | ✅ | Multi-tenant config | **REUSE** - Tenant isolation pattern |

---

## Gap Analysis: What the DAG Requires vs. What Exists

### DAG Requirement: Run Orchestration Service
**Status:** ❌ MISSING

**What's Needed:**
- Run lifecycle management (create → plan → queue → run → complete/fail)
- Run state machine with transitions
- Run metadata persistence
- Run status aggregation
- Multi-client attachment registry

**Existing to Leverage:**
- `a2r-cloud-api` has Deployment model - extend to Run model
- `executor` has Job model - extend to Run/Job hierarchy

---

### DAG Requirement: Schedule Service
**Status:** ⚠️ PARTIAL

**What's Needed:**
- Cron/RRULE schedule persistence
- Scheduler daemon (not OS cron)
- Misfire handling
- Schedule→Job templating

**Existing to Leverage:**
- `cmd/gizzi-code/src/runtime/automation/cron/` has cron parser
- `executor` has job queue
- Need: Scheduler service that enqueues to job queue

---

### DAG Requirement: Event Ledger
**Status:** ❌ MISSING

**What's Needed:**
- Append-only event store
- Per-run event sequence
- Event replay API
- Cursor-based consumption
- Backfill for reconnecting clients

**Existing to Leverage:**
- `a2r-cloud-api` has `DeploymentEvent` for WebSocket
- Need: Extend to general Event model with persistence

---

### DAG Requirement: Checkpoint Persistence
**Status:** ❌ MISSING

**What's Needed:**
- Execution snapshots
- Step cursor preservation
- Pending approval state
- Workspace diffs
- Restore flow

**Existing:**
- `8-cloud/a2r-cloud-wizard/src/checkpoint_store.rs` exists but is empty

---

### DAG Requirement: Policy/Approval Engine
**Status:** ❌ MISSING

**What's Needed:**
- Tool action classification
- Policy evaluation
- Approval request workflow
- Resume after approval

**Existing:**
- A2R "law layer" mentioned but not located

---

### DAG Requirement: Terminal Cowork Mode
**Status:** ⚠️ PARTIAL

**What's Needed:**
- `gizzi cowork` commands
- Remote attach/detach (not local VM)
- Event stream TUI
- Approval interactions

**Existing to Leverage:**
- `cmd/gizzi-code/src/cli/` has session infrastructure
- `8-cloud/a2r-node` has PTY/terminal support
- Need: Remote connection instead of local socket

---

### DAG Requirement: Stream Gateway
**Status:** ⚠️ PARTIAL

**What's Needed:**
- WebSocket/SSE for event streaming
- Multi-client subscriptions
- Replay from cursor
- Backpressure handling

**Existing to Leverage:**
- `a2r-node` has WebSocket client
- `a2r-cloud-api` has broadcast channel
- Need: Gateway service for fan-out

---

## Unified Architecture Plan

### Two Runtimes, One Control Plane

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          A2R COWORK RUNTIME                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONTROL PLANE (Cloud API)                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Run Orche-  │  │ Schedule    │  │ Approval    │  │ Stream      │ │   │
│  │  │ stration    │  │ Service     │  │ Service     │  │ Gateway     │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │   │
│  │         └─────────────────┴─────────────────┴─────────────────┘      │   │
│  │                           │                                          │   │
│  │  ┌────────────────────────┴────────────────────────┐                │   │
│  │  │         STATE PLANE (Postgres/SQLite)            │                │   │
│  │  │  • Run/Job/Schedule tables                       │                │   │
│  │  │  • Event Ledger                                  │                │   │
│  │  │  • Checkpoint Store                              │                │   │
│  │  │  • Audit Log                                     │                │   │
│  │  └─────────────────────────────────────────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│  │  LOCAL RUNTIME  │      │  VPS RUNTIME    │      │  CLOUD RUNTIME  │     │
│  │  (Option 1)     │      │  (Option 2)     │      │  (Option 3)     │     │
│  ├─────────────────┤      ├─────────────────┤      ├─────────────────┤     │
│  │ • Apple VF      │      │ • a2r-node      │      │ • Kubernetes    │     │
│  │ • Firecracker   │      │ • Docker        │      │ • Nomad         │     │
│  │ • Local VM      │      │ • BYOC VPS      │      │ • Managed       │     │
│  │ • Desktop app   │      │ • Remote exec   │      │ • Multi-region  │     │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CLIENTS (All connect to Control Plane)           │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │ Terminal│  │ Web     │  │ Desktop │  │ Mobile  │  │ API     │   │   │
│  │  │ (CLI)   │  │ (React) │  │ (Elec)  │  │ (Future)│  │ (Prog)  │   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy: Root Out & Reuse

### REUSE (Don't Rewrite)

1. **a2r-node** (`8-cloud/a2r-node/`)
   - Keep: WebSocket reverse tunnel, Docker runtime, PTY/terminal
   - Extend: Add run lifecycle hooks, checkpoint awareness
   - Path: `8-cloud/a2r-node/src/runner.rs` (new)

2. **executor** (`8-cloud/executor/`)
   - Keep: JobQueue, Job model, Priority system
   - Extend: Add Run hierarchy, lease management
   - Path: Extend existing files

3. **cloud-api** (`8-cloud/a2r-cloud-api/`)
   - Keep: DB models, Deployment pattern, WebSocket events
   - Extend: Add Run/Job/Schedule/Event models
   - Path: `src/routes/runs.rs`, `src/routes/jobs.rs`, `src/routes/schedules.rs`

4. **VM Drivers** (`1-kernel/cowork/drivers/`)
   - Keep: Apple VF, Firecracker implementations
   - Integrate: As "Local Runtime" option
   - Path: `1-kernel/cowork/runtime/local/`

5. **Protocol** (`1-kernel/cowork/protocol/`)
   - Keep: a2r-guest-agent-protocol codec
   - Reuse: Between local VM and remote node
   - Path: Move to shared package

6. **Cron** (`cmd/gizzi-code/src/runtime/automation/cron/`)
   - Keep: Parser, natural language, retry logic
   - Integrate: Into Schedule Service
   - Path: Extract to shared package

### EXTEND (Build On)

1. **Run Orchestration Service**
   - Base: `a2r-cloud-api` structure
   - New: Run state machine, multi-client attachments
   - Path: `8-cloud/a2r-cloud-api/src/runs/`

2. **Event Ledger**
   - Base: `DeploymentEvent` pattern
   - New: Append-only event store with replay
   - Path: `8-cloud/a2r-cloud-api/src/events/`

3. **Schedule Service**
   - Base: Cron parser + executor job queue
   - New: Scheduler daemon, misfire handling
   - Path: `8-cloud/scheduler/src/`

4. **Stream Gateway**
   - Base: WebSocket in a2r-node + broadcast in API
   - New: Fan-out gateway with replay
   - Path: `8-cloud/stream-gateway/src/`

### NEW (Net Build)

1. **Checkpoint Store** - `8-cloud/checkpoint/src/`
2. **Policy Engine** - `8-cloud/policy/src/`
3. **Terminal Cowork SDK** - `packages/cowork-client/src/`
4. **Unified CLI** - `cmd/gizzi-code/src/cli/cowork.rs`

---

## File Reorganization Plan

### Current Structure
```
8-cloud/
├── a2r-node/          # VPS agent
├── executor/          # Job queue
├── a2r-cloud-api/     # Control plane API
├── cloud-providers/   # VPS provisioning
└── ...

1-kernel/cowork/
├── drivers/           # VM drivers
├── transport/         # VSOCK/VirtioSocket
├── protocol/          # Guest agent protocol
├── sync/              # File sync
└── sessions/          # Session multiplexing

cmd/gizzi-code/
└── src/runtime/automation/cron/  # Cron scheduler
```

### Proposed Structure
```
runtime/
├── local/             # Local VM runtime (from 1-kernel/cowork)
├── remote/            # VPS runtime (a2r-node)
└── shared/
    ├── protocol/      # Guest agent protocol
    └── cron/          # Cron parser (from cmd/gizzi-code)

control-plane/
├── api/               # Cloud API (from 8-cloud/a2r-cloud-api)
├── scheduler/         # Schedule service (NEW)
├── orchestrator/      # Run orchestration (NEW)
├── event-ledger/      # Event store (NEW)
└── policy/            # Policy engine (NEW)

packages/
├── cowork-client/     # Shared client SDK (NEW)
└── contracts/         # Types/schemas

cli/
└── src/
    └── cowork/        # Terminal cowork commands (NEW)
```

---

## Phase-by-Phase Implementation

### Phase 0: Spec & Architecture (This Document)
✅ **COMPLETE** - Architecture audit and unified plan

### Phase 1: Foundation (Week 1)
**Goal:** Establish control plane foundation

**Tasks:**
1. Extend `a2r-cloud-api` with Run/Job/Schedule/Event models
2. Create database migrations for new tables
3. Implement basic Run CRUD APIs
4. Integrate executor job queue with Run hierarchy

**Deliverables:**
- Run lifecycle APIs (create, get, list, cancel)
- Job queue integration
- Event persistence

### Phase 2: Local Runtime Integration (Week 2)
**Goal:** Connect local VM runtime to control plane

**Tasks:**
1. Create "Local Runtime" adapter that wraps VM drivers
2. Implement local↔control-plane protocol
3. Add local run creation via CLI
4. File sync integration

**Deliverables:**
- `gizzi cowork start` creates local VM run
- Run state synced to control plane
- Terminal attaches to local VM

### Phase 3: VPS Runtime (Week 3)
**Goal:** Enable remote VPS execution

**Tasks:**
1. Extend `a2r-node` with run lifecycle hooks
2. Implement node→control-plane event streaming
3. Add VPS provisioning via cloud-providers
4. Multi-client attachment registry

**Deliverables:**
- Deploy node to VPS
- Create remote run
- Terminal attaches to remote run

### Phase 4: Scheduler (Week 4)
**Goal:** Server-side scheduling

**Tasks:**
1. Create Schedule Service daemon
2. Integrate cron parser
3. Implement misfire handling
4. Schedule→Job→Run flow

**Deliverables:**
- `gizzi cowork schedule create`
- Scheduled jobs run without client
- Cron with natural language

### Phase 5: Terminal Cowork (Week 5)
**Goal:** Native terminal experience

**Tasks:**
1. Implement cowork CLI commands
2. Build TUI for run list/detail
3. Event streaming display
4. Approval interactions

**Deliverables:**
- Full `gizzi cowork` command suite
- TUI with live event stream
- Detach/reattach with replay

### Phase 6: Web/Desktop (Week 6)
**Goal:** Cross-surface continuity

**Tasks:**
1. Build cowork-client SDK
2. Web cowork screens
3. Desktop integration
4. Cross-surface tests

**Deliverables:**
- Start in terminal, view in web
- Approve in desktop, observe in terminal
- Shared client state

### Phase 7: Advanced Features (Week 7-8)
**Goal:** Policy, checkpoints, hardening

**Tasks:**
1. Policy engine integration
2. Checkpoint persistence
3. Recovery from failure
4. Security hardening

**Deliverables:**
- Approval workflow
- Crash recovery
- Security audit

---

## Decision Log

### Decision 1: Local vs Remote Runtime
**Decision:** Support both via unified control plane
**Rationale:** Users need local for dev, remote for always-on

### Decision 2: Reuse a2r-node vs New Build
**Decision:** Extend a2r-node
**Rationale:** It already has WebSocket tunnel, Docker, PTY - 80% of what's needed

### Decision 3: SQLite vs Postgres for Events
**Decision:** Support both (SQLite for local/single-tenant, Postgres for cloud/multi-tenant)
**Rationale:** Flexibility for different deployment modes

### Decision 4: Cron Implementation
**Decision:** Extract existing cron to shared package, build scheduler service around it
**Rationale:** Don't rewrite working code

---

## Next Steps

1. **Begin Phase 1:** Extend a2r-cloud-api with Run/Job/Event models
2. **Create database migrations** for new tables
3. **Implement Run CRUD APIs**
4. **Integrate with executor job queue**

Ready to begin implementation.
