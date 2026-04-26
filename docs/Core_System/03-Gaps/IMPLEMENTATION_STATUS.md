# Allternit Cowork Runtime - Implementation Status

**Last Updated:** 2026-04-04

---

## Current State Summary

| Component | Status | Location |
|-----------|--------|----------|
| Workspace | ✅ Exists | `~/Desktop/allternit-workspace/allternit/` |
| Kernel Drivers | ✅ Exists | `domains/kernel/service/` |
| API Structure | ✅ Exists | `api/kernel/`, `api/gateway/`, etc. |
| Services | ✅ Exists | `services/orchestration/`, etc. |
| **Cowork Runtime** | ❌ Missing | Needs to be added |
| **Scheduler** | ❌ Missing | Needs to be added |
| **CLI Cowork** | ❌ Missing | Needs to be added |

---

## What Exists

### 1. Specification & Planning ✅
- `/spec/Vision.md` - Product vision
- `/spec/Requirements.md` - Functional requirements
- `/spec/Architecture.md` - 4-plane architecture
- `/spec/AcceptanceTests.md` - 14 acceptance tests
- `/spec/ADRs/` - 5 ADRs

### 2. Workspace Infrastructure ✅
**Location:** `~/Desktop/allternit-workspace/allternit/`

**Kernel Execution (domains/kernel/):**
- `allternit-driver-interface/` - Driver interface trait
- `allternit-session-manager/` - Session management
- `allternit-firecracker-driver/` - Firecracker VM driver
- `allternit-apple-vf-driver/` - Apple Virtualization driver
- `allternit-process-driver/` - Process-based driver

**API Layer (api/):**
- `api/kernel/rails-service/` - Rails execution engine
- `api/kernel/presentation-kernel/` - UI rendering
- `api/gateway/browser/` - Browser gateway
- `api/gateway/routing/` - IO service

**Services (services/):**
- `services/orchestration/` - Orchestration services
- `services/runtime/` - Runtime services
- `services/registry/` - Registry service

### 3. Rebranding ✅
- All documentation uses `allternit` branding
- No allternit/allternit references in current docs

---

## What's Missing

### Cowork Runtime
The key components for detachable, persistent execution don't exist:

| Component | Purpose | Proposed Location |
|-----------|---------|-------------------|
| `allternit-cowork-runtime` | Run lifecycle, attachments, checkpoints | `services/cowork/runtime/` |
| `allternit-scheduler` | Cron evaluation, schedule triggers | `services/cowork/scheduler/` |
| Cowork CLI | `gizzi cowork` commands | `cmd/gizzi-code/src/cowork/` |

---

## Workspace Structure

### ACTUAL Current Structure
```
~/Desktop/allternit-workspace/allternit/
├── Cargo.toml                    # Workspace root
├── domains/                      # Domain logic
│   ├── kernel/                   # Kernel execution
│   │   ├── drivers/
│   │   └── service/
│   ├── agent/
│   ├── governance/
│   └── ...
├── api/                          # API layer
│   ├── kernel/
│   ├── gateway/
│   ├── cloud/
│   └── ...
├── services/                     # Services
│   ├── orchestration/
│   ├── runtime/
│   └── ...
└── cmd/                          # Commands
    ├── gizzi-code/
    └── gizzi-core/
```

### Proposed Additions
```
services/cowork/                  # NEW
├── runtime/                      # allternit-cowork-runtime
│   └── src/
│       ├── lib.rs
│       ├── types.rs
│       ├── run.rs
│       ├── attachment.rs
│       └── checkpoint.rs
└── scheduler/                    # allternit-scheduler
    └── src/
        ├── lib.rs
        ├── daemon.rs
        └── cron.rs

cmd/gizzi-code/src/cowork/        # NEW
├── mod.rs
├── commands.rs
├── client.rs
└── tui.rs
```

---

## Implementation Phases

### Phase 1: Add Cowork Runtime Crate (Week 1)
**Create:** `services/cowork/runtime/`
- Run/Job/Attachment types
- Run lifecycle management
- Attachment registry
- Checkpoint system

### Phase 2: Add Scheduler Crate (Week 2)
**Create:** `services/cowork/scheduler/`
- Cron expression evaluation
- Schedule persistence
- Misfire handling

### Phase 3: Add CLI Cowork Module (Week 2-3)
**Create:** `cmd/gizzi-code/src/cowork/`
- `gizzi cowork start` - Create and attach
- `gizzi cowork attach <id>` - Reattach with replay
- `gizzi cowork detach` - Detach without stopping
- `gizzi cowork ls` - List runs

### Phase 4: Integrate with Rails (Week 3-4)
- Connect to `api/kernel/rails-service/`
- Add event streaming
- Implement WebSocket gateway

---

## Key Design Decisions

1. **Use Existing Workspace:** Add to `~/Desktop/allternit-workspace/allternit/`
2. **Follow Existing Patterns:** Place in `services/` like other services
3. **Integrate with Kernel:** Use existing kernel drivers from `domains/kernel/`
4. **Reuse Rails:** Connect to existing `api/kernel/rails-service/`

---

## Next Steps

1. **Navigate to Workspace:**
   ```bash
   cd ~/Desktop/allternit-workspace/allternit/
   ```

2. **Create Cowork Service Directory:**
   ```bash
   mkdir -p services/cowork/runtime/src
   mkdir -p services/cowork/scheduler/src
   ```

3. **Add to Workspace Cargo.toml:**
   ```toml
   "services/cowork/runtime",
   "services/cowork/scheduler",
   ```

4. **Implement Runtime Core:**
   - Define types
   - Implement attachment registry
   - Create checkpoint system

---

## Acceptance Criteria

- [ ] Create run from terminal → persists after disconnect
- [ ] Reattach → see missed events
- [ ] Schedule job → executes without client
- [ ] VM crash → recover from checkpoint
- [ ] Cross-surface → same run in web + terminal

---

**Status:** Workspace exists. Ready to add cowork runtime components.
