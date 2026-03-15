# Missing Crates - CREATED

## Summary

All three missing crates have been created with complete implementations:

### 1. a2r-session-manager ✅
**Location**: `1-kernel/execution/a2r-session-manager/`

**Features**:
- Session lifecycle management (create, list, destroy)
- SQLite persistence for session state
- Platform-appropriate driver selection (Process/Firecracker/AppleVF)
- Automatic cleanup of idle sessions
- Command execution in sessions

**Key Types**:
- `SessionManager` - Main entry point
- `Session` - Session information
- `SessionSpec` - Session creation specification
- `SessionId` - UUID-based session identifier

**Dependencies**:
- `a2r-driver-interface`
- `a2r-process-driver`
- `a2r-firecracker-driver`
- `a2r-apple-vf-driver` (macOS only)
- `sqlx` (SQLite)
- `dashmap` (concurrent hashmap)

---

### 2. a2r-apple-vf-driver ✅
**Location**: `1-kernel/execution/a2r-apple-vf-driver/`

**Features**:
- Apple Virtualization Framework integration
- VM lifecycle management (create, start, stop, destroy)
- VirtioFS shared directory support
- Rosetta 2 support for x86_64 binaries
- Hardware-accelerated virtualization

**Key Types**:
- `AppleVFDriver` - Main driver implementing `ExecutionDriver`
- `AppleVFConfig` - Configuration
- `VirtualMachine` - VM instance management
- `VMConfig` - VM configuration

**Dependencies**:
- `a2r-driver-interface`
- `objc`, `cocoa`, `core-foundation`, `core-graphics` (macOS frameworks)
- `tokio`, `async-trait`

**Platform**: macOS only

---

### 3. Cowork System Integration ✅
**Location**: `1-kernel/cowork/`

#### a2r-cowork-scheduler
- Cron-based job scheduling using `tokio-cron-scheduler`
- SQLite persistence for schedules
- HTTP API (Axum) for management
- Compatible with Rails backend

**Binary**: `a2r-cowork-scheduler`

#### a2r-cowork-runtime
- Persistent execution runtime
- DAG-based job execution
- Checkpoint/restore functionality
- Client attachment management
- Rails backend integration

---

## Workspace Updates

The workspace `Cargo.toml` has been updated to include:
- `a2r-session-manager`
- `a2r-apple-vf-driver`
- `a2r-cowork-scheduler`
- `a2r-cowork-runtime`

## Build Status

```bash
# All new crates compile successfully:
cargo check -p a2r-session-manager
cargo check -p a2r-apple-vf-driver
cargo check -p a2r-cowork-scheduler
cargo check -p a2r-cowork-runtime
```

## Next Steps for CLI

The CLI (`7-apps/cli`) needs updates to use the new APIs:

1. **Update imports**:
   - Change `a2r_session_manager::BubblewrapSessionManager` to `a2r_session_manager::SessionManager`
   - Update `a2r_apple_vf_driver` imports to use correct names (`AppleVFDriver` not `AppleVfDriver`)

2. **Update types**:
   - `ResourceLimits` is in `a2r_session_manager::types` not `a2r_driver_interface`
   - Some streaming types need to be added to driver-interface

3. **Implement missing trait methods**:
   - `exec_streaming` is not part of the `ExecutionDriver` trait yet

These CLI updates are straightforward API alignment tasks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         7-apps/cli (a2r)                         │
│                     (needs minor API updates)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              1-kernel/execution/a2r-session-manager              │
│  ┌─────────────┬─────────────────┬─────────────────────────────┐│
│  │ Process     │ Firecracker     │ Apple VF (macOS)            ││
│  │ Driver      │ Driver          │ Driver                      ││
│  └─────────────┴─────────────────┴─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│         1-kernel/infrastructure/a2r-driver-interface            │
│                    (Trait definitions)                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    1-kernel/cowork/                             │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐│
│  │ a2r-cowork-      │  │ a2r-cowork-runtime                   ││
│  │ scheduler        │  │ (DAG execution, checkpoint/restore)  ││
│  │ (Cron jobs)      │  │                                      ││
│  └──────────────────┘  └──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

*Created: 2026-03-13*
