# A2R Cowork Runtime - Progress Report

**Date:** 2026-03-10  
**Status:** Module 1 (Control Plane Foundation) - Core Complete ✅

---

## What Was Built

### Module 1: Control Plane Foundation ✅

#### 1.1 Database Schema
Created `/8-cloud/a2r-cloud-api/migrations/002_cowork_runtime.sql`:
- **runs** table - Core run lifecycle with status tracking
- **jobs** table - Individual jobs within runs with priority queue support
- **schedules** table - Cron-based scheduling with natural language
- **events** table - Append-only event ledger for streaming
- **attachments** table - Multi-client attachment tracking
- **checkpoints** table - Execution snapshots for recovery
- Indexes optimized for common query patterns
- Auto-updating timestamps via triggers

#### 1.2 Data Models
Created `/8-cloud/a2r-cloud-api/src/db/cowork_models.rs`:
- **RunMode** enum - local/remote/cloud execution modes
- **RunStatus** enum - Complete state machine with transition validation
- **Run** struct - Full run record with config JSON
- **Job** struct with **QueuedJob** wrapper for priority ordering
- **Schedule** struct with **MisfirePolicy** support
- **EventType** enum - 25+ event types (lifecycle, output, tool, approval, etc.)
- **Event** struct - Append-only ledger entries
- **Attachment** / **ClientType** - Multi-client tracking
- **Checkpoint** struct - Execution snapshots
- Request/response DTOs for API

#### 1.3 Core Services
Created `/8-cloud/a2r-cloud-api/src/services/run_service.rs`:
- **RunService** trait - Full lifecycle interface
- **RunServiceImpl** - SQLite-backed implementation
- State machine enforcement (validates transitions)
- Methods: create, get, list, update, delete, transition, start, pause, resume, cancel, complete, fail, update_progress, assign_runtime

Created `/8-cloud/a2r-cloud-api/src/services/event_store.rs`:
- **EventStore** trait - Append-only with streaming
- **EventStoreImpl** - SQLite + broadcast channels
- Cursor-based pagination for replay
- Real-time subscription support
- Event utility functions for common event types

#### 1.4 API Routes
Created `/8-cloud/a2r-cloud-api/src/routes/runs.rs`:
- `POST /api/v1/runs` - Create run
- `GET /api/v1/runs` - List runs (with filtering)
- `GET /api/v1/runs/:id` - Get run details
- `PUT /api/v1/runs/:id` - Update run
- `DELETE /api/v1/runs/:id` - Delete run
- `POST /api/v1/runs/:id/start` - Start run
- `POST /api/v1/runs/:id/pause` - Pause run
- `POST /api/v1/runs/:id/resume` - Resume run
- `POST /api/v1/runs/:id/cancel` - Cancel run
- `GET /api/v1/runs/:id/events` - Get events (REST)
- `GET /api/v1/runs/:id/events/stream` - SSE streaming with replay

---

## Files Created/Modified

### New Files
```
8-cloud/a2r-cloud-api/
├── migrations/002_cowork_runtime.sql      # Database schema
├── src/db/cowork_models.rs                # Data models
├── src/services/
│   ├── mod.rs                             # Services module
│   ├── run_service.rs                     # Run lifecycle
│   └── event_store.rs                     # Event ledger
└── src/routes/runs.rs                     # REST API routes
```

### Modified Files
```
8-cloud/a2r-cloud-api/
├── Cargo.toml                             # Added dependencies
├── src/lib.rs                             # Added services, routes
├── src/db/mod.rs                          # Export cowork_models
├── src/routes/mod.rs                      # Added runs module
└── src/error.rs                           # Added NotFound, BadRequest

Cargo.toml (workspace root)                # Added 8-cloud packages
```

---

## Architecture Highlights

### Modular Design
- **RunService trait** - Runtime-agnostic interface
- **EventStore trait** - Streaming backbone
- Both local VM and remote VPS will implement same interfaces

### State Machine
```
Pending → Planning → Queued → Running → [Paused] → [Completed/Failed/Cancelled]
```
- Valid transitions enforced
- Terminal states prevent further changes
- Automatic timestamp tracking

### Event-Driven
- Append-only event ledger
- Cursor-based replay for reconnection
- Broadcast channels for real-time streaming
- 25+ event types covering full lifecycle

---

## Build Status

```
✅ a2r-cloud-api compiles successfully
✅ All new modules integrated
✅ Database migrations ready
⚠️ 6 warnings (unused imports - cleanup needed)
```

---

## Next Steps

### Remaining Module 1 Tasks (Quick wins)
- [ ] `/api/v1/jobs` routes (CRUD for jobs)
- [ ] `/api/v1/schedules` routes (CRUD for schedules)
- [ ] `/ws/runs/:id` WebSocket endpoint

### Module 2: Local Runtime Integration
Connect the existing local VM runtime (Apple VF/Firecracker) to the control plane:
- Create LocalRuntime adapter
- Bridge VM events to EventStore
- Session multiplexer integration
- Test: `gizzi cowork start` creates local VM run

### Module 3: Remote Runtime (a2r-node)
Extend existing a2r-node for run lifecycle:
- Add run hooks to a2r-node
- Node registration with control plane
- BYOC VPS provisioning integration
- Test: Deploy node, create remote run

### Module 4: Scheduler Service
Extract existing cron parser, build scheduler daemon:
- Move cron from gizzi-code to shared package
- Scheduler daemon with misfire handling
- Schedule→Run flow integration
- Test: Cron schedules create runs

### Module 5: Terminal Cowork CLI
Native terminal experience:
- `gizzi cowork` command suite
- Interactive TUI (Ratatui)
- Approval workflow in terminal
- Test: Full cowork lifecycle in CLI

---

## Key Design Decisions

### 1. Unified Control Plane
Single API server handles both local and remote runs:
- Same data models regardless of execution mode
- Same event streaming for all clients
- Runtime details abstracted behind traits

### 2. SQLite Default, Postgres Supported
- SQLite for single-tenant/local deployments
- Postgres for multi-tenant/cloud deployments
- sqlx provides compatibility layer

### 3. Event Ledger Over Direct Coupling
- All state changes emit events
- Services communicate via EventStore
- Enables replay, audit, debugging

### 4. Trait-Based Architecture
- Runtime trait: LocalRuntime, RemoteRuntime implementations
- Easy testing with mock implementations
- Future extensibility (Kubernetes, etc.)

---

## Testing Strategy

### Unit Tests (Included)
- Run status transition validation
- Run terminal state detection
- Job priority ordering

### Integration Tests (Next)
- Full run lifecycle via API
- Event streaming with replay
- Multi-client attachment

### E2E Tests (Future)
- Local VM run end-to-end
- Remote VPS run end-to-end
- Cross-surface continuity (terminal ↔ web)

---

## Ready for Next Phase

The foundation is solid. Next priority:
1. **Quick**: Complete jobs/schedules routes, WebSocket endpoint
2. **Major**: Module 2 (Local Runtime) - Connect existing VM code
3. **Major**: Module 5 (Terminal CLI) - User-facing interface

The architecture is coherent and extensible. All modules plug into the Control Plane via well-defined traits.
