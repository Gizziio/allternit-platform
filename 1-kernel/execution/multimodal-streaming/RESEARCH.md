# WebRTC Library Research

## GAP-36: WebRTC Library Selection

### Evaluated Options

#### 1. webrtc-rs
- **Pros**: 
  - Pure Rust implementation
  - Native async/await support
  - No FFI bindings required
  - Good integration with tokio
  - Active development
- **Cons**:
  - Relatively newer codebase
  - Some advanced features still maturing
  - Smaller community than C++ alternatives
- **Verdict**: ✅ SELECTED - Best fit for Rust-native a2rchitech stack

#### 2. livekit
- **Pros**:
  - Production-ready SFU
  - Excellent performance at scale
  - Comprehensive client SDKs
- **Cons**:
  - Go-based server (external dependency)
  - Requires separate infrastructure
  - More complex deployment
- **Verdict**: ❌ Not selected - External service dependency

#### 3. mediasoup
- **Pros**:
  - High performance SFU
  - Node.js/Rust/C++ bindings available
  - Battle-tested in production
- **Cons**:
  - Requires mediasoup-worker C++ process
  - FFI complexity
  - Heavyweight for embedded use
- **Verdict**: ❌ Not selected - Too heavy for kernel module

### Decision

Selected: **webrtc-rs** v0.12.0

Rationale:
1. Native Rust fits a2rchitech architecture
2. No external service dependencies
3. Suitable for both client and server WebRTC
4. Clean async API integrates with existing codebase

### Dependencies Added

```toml
[dependencies]
webrtc = "0.12"
opus = "0.3"  # For audio codec support (with STUB_APPROVED for full impl)
```

---

## Implementation Notes

### WIH: GAP-37
- **Owner**: T2-A1
- **Dependencies**: GAP-36 (WebRTC selection)
- **Deadline**: Phase 1 completion
- **Status**: In Progress

### Coordination
- T2-A2 owns VisionChannel (GAP-38)
- T2-A3 owns FullDuplexController
- Shared types.rs interface defined first
