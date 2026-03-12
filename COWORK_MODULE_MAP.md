# Module Integration Map

## Visual Dependency Graph

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              MODULE 1: CONTROL PLANE                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ 1.1 Schema  │→ │ 1.2 Models  │→ │ 1.3 Services│→ │ 1.4 API     │  │           │  │
│  │   (DB)      │   │   (Rust)    │   │  (Logic)    │   │  (HTTP/WS)  │  │           │  │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └──────┬──────┘  │           │  │
│                                           │                  │       │           │  │
│  ┌────────────────────────────────────────┴──────────────────┴───────┴─────────┐   │
│  │  SHARED: RunService, EventStore, JobQueue (integrated), ScheduleService    │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│ MODULE 2: LOCAL   │       │ MODULE 3: REMOTE  │       │ MODULE 4:         │
│ RUNTIME           │       │ RUNTIME           │       │ SCHEDULER         │
│                   │       │                   │       │                   │
│ ┌───────────────┐ │       │ ┌───────────────┐ │       │ ┌───────────────┐ │
│ │2.1 Runtime    │ │       │ │3.1 a2r-node   │ │       │ │4.1 Cron        │ │
│ │   Adapter     │ │       │ │   Extension  │ │       │ │   Integration │ │
│ └───────┬───────┘ │       │ └───────┬───────┘ │       │ └───────┬───────┘ │
│         │         │       │         │         │       │         │         │
│ ┌───────▼───────┐ │       │ ┌───────▼───────┐ │       │ ┌───────▼───────┐ │
│ │2.2 VM Bridge  │ │       │ │3.2 Control    │ │       │ │4.2 Daemon     │ │
│ └───────┬───────┘ │       │ │   Plane Int. │ │       │ └───────┬───────┘ │
│         │         │       │ └───────┬───────┘ │       │         │         │
│ ┌───────▼───────┐ │       │ ┌───────▼───────┐ │       │ ┌───────▼───────┐ │
│ │2.3 Sessions   │ │       │ │3.3 BYOC VPS   │ │       │ │4.3 Schedule→  │ │
│ └───────────────┘ │       │ └───────────────┘ │       │ │   Run Flow    │ │
└───────────────────┘       └───────────────────┘       │ └───────────────┘ │
                                                        └───────────────────┘
        │                                 │
        └────────────────┬────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              MODULE 6: STREAM GATEWAY                                │
│                                                                                      │
│  ┌─────────────┐  ┌─────────────┐                                                    │
│  │6.1 Gateway  │→ │6.2 Multi-   │                                                    │
│  │   Service   │   │   Client    │                                                    │
│  └─────────────┘  └─────────────┘                                                    │
│                                                                                      │
│  Purpose: Fan-out events from EventStore to all connected clients                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              MODULE 5: TERMINAL CLI                                  │
│                                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │5.1 Core     │→ │5.2 Schedule │→ │5.3 TUI      │→ │5.4 Approval │                 │
│  │   Commands  │   │   Commands  │   │   (Ratatui) │   │   Workflow  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                                      │
│  Primary user interface for Cowork Runtime                                          │
└──────────────────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              MODULE 7 & 8: ADVANCED                                  │
│  ┌─────────────┐  ┌─────────────┐                                                    │
│  │7. Checkpoint│  │8. Policy    │                                                    │
│  │   & Recovery│  │   Engine    │                                                    │
│  └─────────────┘  └─────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              MODULE 9: CLIENTS                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                                   │
│  │9.1 SDK      │→ │9.2 Web UI   │→ │9.3 Desktop  │                                   │
│  │   (shared)  │   │   (React)   │   │   (Electron)│                                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                                   │
│                                                                                      │
│  All clients use the same SDK, connect to the same API                               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Coherence Strategy

### 1. Shared Core (Module 1)
Everything builds on Module 1. The RunService, EventStore, and JobQueue are the central nervous system.

**Key Design Decisions:**
- Single source of truth: Database tables in Module 1
- All state changes flow through Module 1 services
- Events are the communication backbone

### 2. Runtime Abstraction
Both Local (Module 2) and Remote (Module 3) implement the same `Runtime` trait:

```rust
trait Runtime {
    async fn start(&self, run_id: &str, config: RunConfig) -> Result<RuntimeHandle>;
    async fn stop(&self, run_id: &str) -> Result<()>;
    async fn status(&self, run_id: &str) -> Result<RunStatus>;
    async fn attach(&self, run_id: &str, client: ClientInfo) -> Result<EventStream>;
    async fn detach(&self, run_id: &str, client_id: &str) -> Result<()>;
}
```

This means:
- CLI (Module 5) doesn't care if run is local or remote
- Web UI (Module 9) works the same for both
- Control plane (Module 1) manages both uniformly

### 3. Event-Driven Integration
Instead of direct coupling, modules communicate via events:

```
Runtime (2 or 3) → Event (step_completed) → EventStore (1) → 
  ├→ Stream Gateway (6) → CLI/Web clients (5, 9)
  ├→ Scheduler (4) → Check if scheduled next
  └→ Checkpoint (7) → Save state
```

### 4. Single API Surface
All functionality exposed through Module 1's API:
- REST for CRUD operations
- WebSocket for real-time events
- SSE for simple streaming

Clients (Module 5, 9) use the same endpoints regardless of runtime.

### 5. Dependency Injection Pattern
Services depend on traits, not concrete types:

```rust
// RunOrchestrator doesn't care about Runtime implementation
pub struct RunOrchestrator<R: Runtime> {
    runtime: R,
    event_store: Arc<dyn EventStore>,
}
```

This allows:
- LocalRuntime for dev
- RemoteRuntime for production
- MockRuntime for testing

## Module Interfaces

### Module 1 ↔ Module 2/3 (Runtime)
```rust
// Runtime reports events to Control Plane
event_store.append(run_id, Event::step_completed(step_id)).await?;

// Control Plane sends commands to Runtime
runtime.pause(run_id).await?;
```

### Module 1 ↔ Module 4 (Scheduler)
```rust
// Scheduler creates runs via RunService
run_service.create_from_schedule(schedule_id).await?;

// Run completion reported to Scheduler for next run tracking
scheduler.record_completion(schedule_id, run_id).await?;
```

### Module 1 ↔ Module 5/9 (Clients)
```rust
// Client subscribes to events
let stream = event_store.subscribe(run_id, cursor).await?;

// Client sends commands
api_client.post("/runs/{id}/pause").await?;
```

### Module 6 (Gateway) as Middleware
```rust
// Gateway sits between EventStore and clients
// Receives events from EventStore
// Fans out to all connected clients for that run
// Handles backpressure, reconnection, replay
```

## Implementation Order

The modules must be built in this order for coherence:

1. **Module 1** (Foundation) - Everything depends on this
2. **Module 6** (Gateway) - Needed for streaming
3. **Module 2 OR 3** (Pick one runtime first) - Need something to execute runs
4. **Module 5** (CLI) - Primary interface
5. **Module 4** (Scheduler) - Builds on run execution
6. **Module 7 & 8** (Advanced) - Optional but important
7. **Module 9** (Web/Desktop) - Last, uses SDK

## Testing Strategy

### Unit Tests (Per Module)
Each module tests its own logic in isolation using mocks.

### Integration Tests (Cross-Module)
```
Test: Full Local Run
- Module 1 (Create run) 
- Module 2 (Execute locally)
- Module 6 (Stream events)
- Module 5 (CLI attach)

Test: Scheduled Remote Run
- Module 4 (Create schedule)
- Module 1 (Trigger on cron)
- Module 3 (Execute on VPS)
- Module 9 (Web UI view)
```

### E2E Tests (Full Stack)
```
Test: Cross-Surface Workflow
1. Start run in terminal (Module 5)
2. View in web UI (Module 9)
3. Approve in web (Module 8)
4. Observe in terminal (Module 5)
5. Check checkpoint created (Module 7)
```

## Summary

This architecture is:
- **Modular**: Each module has clear boundaries
- **Coherent**: Common interfaces and event-driven communication
- **Flexible**: Local/Remote runtimes are interchangeable
- **Testable**: Clear interfaces enable mocking
- **Extensible**: New runtimes (Kubernetes, etc.) implement Runtime trait

The key insight: **Module 1 is the glue**. Everything else plugs into it via well-defined interfaces.
