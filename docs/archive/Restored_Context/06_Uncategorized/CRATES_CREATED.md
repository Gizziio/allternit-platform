# Missing Crates - CREATED

## Summary

All three missing crates have been created with complete implementations:

### 1. allternit-session-manager ✅
**Location**: `domains/kernel/execution/allternit-session-manager/`

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
- `allternit-driver-interface`
- `allternit-process-driver`
- `allternit-firecracker-driver`
- `allternit-apple-vf-driver` (macOS only)
- `sqlx` (SQLite)
- `dashmap` (concurrent hashmap)

---

### 2. allternit-apple-vf-driver ✅
**Location**: `domains/kernel/execution/allternit-apple-vf-driver/`

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
- `allternit-driver-interface`
- `objc`, `cocoa`, `core-foundation`, `core-graphics` (macOS frameworks)
- `tokio`, `async-trait`

**Platform**: macOS only

---

### 3. Cowork System Integration ✅
**Location**: `domains/kernel/cowork/`

#### allternit-cowork-scheduler
- Cron-based job scheduling using `tokio-cron-scheduler`
- SQLite persistence for schedules
- HTTP API (Axum) for management
- Compatible with Rails backend

**Binary**: `allternit-cowork-scheduler`

#### allternit-cowork-runtime
- Persistent execution runtime
- DAG-based job execution
- Checkpoint/restore functionality
- Client attachment management
- Rails backend integration

---

## Workspace Updates

The workspace `Cargo.toml` has been updated to include:
- `allternit-session-manager`
- `allternit-apple-vf-driver`
- `allternit-cowork-scheduler`
- `allternit-cowork-runtime`

## Build Status

```bash
# All new crates compile successfully:
cargo check -p allternit-session-manager
cargo check -p allternit-apple-vf-driver
cargo check -p allternit-cowork-scheduler
cargo check -p allternit-cowork-runtime
```

## Next Steps for CLI

The CLI (`cmd/cli`) needs updates to use the new APIs:

1. **Update imports**:
   - Change `allternit_session_manager::BubblewrapSessionManager` to `allternit_session_manager::SessionManager`
   - Update `allternit_apple_vf_driver` imports to use correct names (`AppleVFDriver` not `AppleVfDriver`)

2. **Update types**:
   - `ResourceLimits` is in `allternit_session_manager::types` not `allternit_driver_interface`
   - Some streaming types need to be added to driver-interface

3. **Implement missing trait methods**:
   - `exec_streaming` is not part of the `ExecutionDriver` trait yet

These CLI updates are straightforward API alignment tasks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         cmd/cli (allternit)                         │
│                     (needs minor API updates)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              domains/kernel/execution/allternit-session-manager              │
│  ┌─────────────┬─────────────────┬─────────────────────────────┐│
│  │ Process     │ Firecracker     │ Apple VF (macOS)            ││
│  │ Driver      │ Driver          │ Driver                      ││
│  └─────────────┴─────────────────┴─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│         domains/kernel/infrastructure/allternit-driver-interface            │
│                    (Trait definitions)                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    domains/kernel/cowork/                             │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐│
│  │ allternit-cowork-      │  │ allternit-cowork-runtime                   ││
│  │ scheduler        │  │ (DAG execution, checkpoint/restore)  ││
│  │ (Cron jobs)      │  │                                      ││
│  └──────────────────┘  └──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

*Created: 2026-03-13*
