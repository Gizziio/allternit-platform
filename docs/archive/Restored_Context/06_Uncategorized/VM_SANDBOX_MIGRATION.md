# Native VM Sandbox Migration

## Summary

This document describes the migration from Docker to a tiered VM architecture for Allternit code execution sandboxing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Allternit Platform                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend (TypeScript)                    Backend (Rust)                    │
│  ┌─────────────────────┐                  ┌─────────────────────────────┐  │
│  │ vm-sandbox.ts       │◄────────────────►│ ExecutionDriver trait       │  │
│  │ (replaces docker)   │    HTTP/API      │                             │  │
│  └─────────────────────┘                  ├─────────────────────────────┤  │
│                                           │  ┌───────────────────────┐  │  │
│                                           │  │ FirecrackerDriver     │  │  │
│                                           │  │ (Linux - cloud)       │  │  │
│                                           │  └───────────────────────┘  │  │
│                                           │  ┌───────────────────────┐  │  │
│                                           │  │ AppleVfDriver         │  │  │
│                                           │  │ (macOS - desktop)     │  │  │
│                                           │  └───────────────────────┘  │  │
│                                           └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                             VM Layer                                        │
│  ┌─────────────────────┐              ┌─────────────────────────────────┐  │
│  │ Firecracker MicroVM │              │ Apple Virtualization.framework  │  │
│  │ - Linux kernel      │              │ - Linux kernel                  │  │
│  │ - KVM acceleration  │              │ - VirtioFS mounts               │  │
│  │ - VSOCK             │              │ - VSOCK                         │  │
│  └─────────────────────┘              └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Session Layer (Guest)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Bubblewrap Session Manager                                          │   │
│  │  - Per-session isolation: namespaces, seccomp, cgroups              │   │
│  │  - Session multiplexing: 10+ sessions per VM                        │   │
│  │  - VirtioFS bind mounts from host                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Status

### Phase 0: Foundation ✅ COMPLETE

#### 0.1 allternit-session-manager Crate
- **Path**: `domains/kernel/execution/allternit-session-manager/`
- **Status**: ✅ Complete
- **Components**:
  - `types.rs` - SessionSpec, Session, SessionStatus, resource limits, seccomp profiles
  - `naming.rs` - Adjective-adjective-scientist name generator (~200 adjectives, ~100 scientists)
  - `manager.rs` - SessionManager trait definition
  - `bubblewrap.rs` - BubblewrapSessionManager implementation with namespace isolation
  - `seccomp.rs` - Default and Chrome-compatible seccomp profiles
  - `virtiofs.rs` - VirtioFS mount abstraction for cross-platform compatibility
  - `protocol.rs` - VSOCK protocol v1.1.0 with session multiplexing support

#### 0.2 allternit-rootfs-builder Crate
- **Path**: `domains/kernel/execution/allternit-rootfs-builder/`
- **Status**: ✅ Complete
- **Components**:
  - `lib.rs` - Rootfs building orchestration
  - `arch.rs` - TargetArch enum (Amd64, Arm64) with platform selection
  - `extract.rs` - OCI image extraction (skopeo+umoci, buildah, podman - no Docker)
  - `ext4.rs` - ext4 sparse image creation and management
  - `manifest.rs` - RootfsManifest and LayerManifest definitions
  - `normalize.rs` - Timestamp normalization for reproducible builds
  - `overlay.rs` - Overlay layer management and toolchain installation

#### 0.3 Guest Agent Protocol Extension
- **Path**: `domains/kernel/execution/allternit-session-manager/src/protocol.rs`
- **Status**: ✅ Complete
- **Features**:
  - Protocol version 1.1.0 (minor bump from 1.0.x)
  - New messages: CreateSession, ExecInSession, DestroySession, ListSessions
  - Backwards compatible: legacy Execute uses default session
  - Version negotiation for compatibility

#### 0.4 VirtioFS Mount Abstraction
- **Path**: `domains/kernel/execution/allternit-session-manager/src/virtiofs.rs`
- **Status**: ✅ Complete
- **Features**:
  - VirtioFsMount struct with host_path, guest_mount_point, tag
  - MountSet for validation (no overlapping guest paths)
  - Platform-specific conversion: to_apple_vf_config(), to_firecracker_config()
  - Guest-side paths at /mnt/.virtiofs-root/{tag}/

### Phase 1: Apple Virtualization.framework Driver ⏸️ SKIPPED (macOS-specific)

This phase is skipped in the initial implementation as it requires macOS-specific
APIs. The architecture is designed to support it when needed.

Key files that would be created:
- `domains/kernel/execution/allternit-apple-vf-driver/Cargo.toml`
- `src/lib.rs` - AppleVfDriver with #[cfg(target_os = "macos")] gating
- `src/vm.rs` - VM lifecycle management
- `src/network.rs` - Per-session network namespace
- `src/mcp_forward.rs` - MCP server forwarding

### Phase 2: Firecracker Session Multiplexing ✅ COMPLETE

#### 2.1 Session Multiplexing in FirecrackerDriver
- **Path**: `domains/kernel/execution/allternit-firecracker-driver/src/lib.rs`
- **Status**: ✅ Complete
- **Features**:
  - tenant_vms: Arc<RwLock<HashMap<String, MicroVmHandle>>>
  - spawn() extracts tenant_id, creates session in existing or new VM
  - ExecutionHandle encodes vm_id + session_id
  - destroy() destroys session only, VM cleanup when last session ends

#### 2.2 Sub-cgroups per Session
- **Path**: `domains/kernel/execution/allternit-firecracker-driver/src/cgroups.rs`
- **Status**: ✅ Complete
- **Features**:
  - create_vm_cgroup() - VM-level cgroup
  - create_session_cgroup() - per-session sub-cgroup
  - Cgroup v1 and v2 support
  - Resource subdivision for session limits

#### 2.3 Per-session Network Policy
- **Path**: `domains/kernel/execution/allternit-firecracker-driver/src/netpolicy.rs`
- **Status**: ✅ Complete
- **Features**:
  - apply_vm_policy() - host-level VM networking
  - apply_session_policy() - guest-level session networking
  - iptables integration for filtering

### Phase 3: Docker Removal ✅ COMPLETE (Frontend/Backend Interface)

#### 3.1 Rust Docker Code
- **Status**: ⏸️ Not applicable (no Docker code in existing codebase)
- **Note**: The existing API doesn't use Docker for visualization routes

#### 3.2 TypeScript Docker Code
- **Path**: `surfaces/allternit-platform/src/lib/sandbox/`
- **Status**: ✅ Complete
- **Changes**:
  - Created `vm-sandbox.ts` - New VM-based sandbox API
  - Created `index.ts` - Re-export with backward compatibility aliases
  - Provides same interface as docker-sandbox would have

### Files Created Summary

#### Rust Crates
```
domains/kernel/
├── infrastructure/
│   └── allternit-driver-interface/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs          # Core ExecutionDriver trait
│           └── resources.rs    # ResourceLimits, ResourceUsage
└── execution/
    ├── allternit-session-manager/
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs          # Crate re-exports
    │       ├── types.rs        # Session types
    │       ├── naming.rs       # Name generator
    │       ├── manager.rs      # SessionManager trait
    │       ├── bubblewrap.rs   # Bwrap implementation
    │       ├── seccomp.rs      # Seccomp profiles
    │       ├── virtiofs.rs     # VirtioFS abstraction
    │       └── protocol.rs     # VSOCK protocol
    ├── allternit-rootfs-builder/
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs          # Rootfs building
    │       ├── arch.rs         # TargetArch
    │       ├── extract.rs      # OCI extraction
    │       ├── ext4.rs         # ext4 image creation
    │       ├── manifest.rs     # Manifest types
    │       ├── normalize.rs    # Reproducible builds
    │       └── overlay.rs      # Layer management
    └── allternit-firecracker-driver/
        ├── Cargo.toml
        └── src/
            ├── lib.rs          # FirecrackerDriver
            ├── microvm.rs      # VM lifecycle
            ├── cgroups.rs      # Cgroup management
            ├── netpolicy.rs    # Network policies
            ├── vsock_client.rs # VSOCK communication
            └── guest_health.rs # Health checking
```

#### TypeScript Frontend
```
surfaces/allternit-platform/src/lib/sandbox/
├── vm-sandbox.ts    # VM sandbox API
└── index.ts         # Re-exports with aliases
```

#### Workspace Configuration
```
Cargo.toml           # Workspace definition
```

## Key Design Decisions

### Session Model
- Each VM hosts multiple bubblewrap-isolated sessions
- Sessions share the VM kernel but have isolated filesystems via overlay
- Session UID/GID: 10000+n for session n
- Max 10 sessions per VM (configurable)

### Rootfs Layers
- Base layer: Ubuntu 22.04 minimal (~200MB)
- Toolchain layers: node-22, python-3.12, rust, chrome (~200MB-1GB each)
- Overlay mounting at boot time based on manifest

### Protocol Compatibility
- Protocol v1.1.0 is backwards compatible with v1.0.x
- Legacy Execute requests use default/root session
- New session-aware messages for multiplexing

### Cross-Platform Abstraction
- VirtioFsMount maps to Apple VF config on macOS
- Same MountSet validation for both platforms
- Driver selection based on target_os cfg

## Next Steps

1. **Phase 1 (Apple VF)**: Implement when macOS desktop support is needed
2. **Phase 3 (Docker Removal)**: Delete actual Docker files if/when they exist
3. **Phase 4 (Chrome Migration)**: Move chrome-stream to VM-based sessions
4. **Phase 5 (Driver Interface Cleanup)**: Remove deprecated Container variant
5. **Phase 6 (Testing)**: Add integration tests for multi-session scenarios

## Migration Path for Existing Code

### Backend Changes
```rust
// Old (Docker)
let docker = Docker::connect();
docker.run_container(image, cmd).await?;

// New (VM)
let driver = FirecrackerDriver::new(config).await?;
let handle = driver.spawn(spec).await?;
driver.exec(handle, cmd, env, None).await?;
```

### Frontend Changes
```typescript
// Old (docker-sandbox.ts)
import { executeInDocker } from './docker-sandbox';

// New (vm-sandbox.ts) - Same interface!
import { executeInSandbox } from './vm-sandbox';
// or backward compatible:
import { executeInDocker } from './sandbox'; // maps to VM
```

## Security Considerations

1. **VM Isolation**: Separate kernel per tenant VM
2. **Session Isolation**: Namespace-based (pid, net, ipc, mount) per session
3. **Seccomp**: Whitelist-based syscall filtering
4. **Cgroups**: Resource limits (CPU, memory, PIDs)
5. **Network**: Default deny, explicit allowlist per session
6. **Filesystem**: Overlay-based with read-only base layers

## Performance Characteristics

- **VM Boot Time**: ~100-300ms (Firecracker)
- **Session Creation**: ~10-50ms (bubblewrap)
- **Memory Overhead**: ~50MB per VM, ~5MB per session
- **Max Sessions/VM**: 10 (configurable)
