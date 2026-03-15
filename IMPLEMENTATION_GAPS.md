# Implementation Gaps Analysis

## ✅ What Works

### 1. Basic CLI Functionality
```bash
$ a2r run -- echo "hello"
→ Using Development mode
→ Created session: unnamed
hello
```
- ✅ Command execution via local process
- ✅ CLI argument parsing
- ✅ Status reporting
- ✅ Session lifecycle (create → exec → destroy)

### 2. Session Manager (a2r-session-manager)
- ✅ SQLite persistence layer
- ✅ Session tracking with proper types
- ✅ Platform-specific driver selection
- ✅ Process driver integration
- ✅ Firecracker driver integration (Linux)

### 3. Apple VF Driver (a2r-apple-vf-driver)
- ✅ Framework availability detection
- ✅ VM configuration types
- ✅ VM lifecycle methods (create, start, stop)
- ⚠️ **NOT IMPLEMENTED**: Actual Virtualization.framework bindings (objc)

### 4. Driver Interface
- ✅ Core trait definitions
- ✅ All required types for CLI compatibility
- ✅ Process driver implementation
- ✅ Firecracker driver integration

---

## ⚠️ Implementation Gaps

### Gap 1: Apple Virtualization.framework Integration
**Severity: HIGH (macOS VM mode doesn't work)**

The `a2r-apple-vf-driver` has the structure but lacks actual Virtualization.framework bindings:

```rust
// Current: Placeholder implementation
pub async fn start(&mut self) -> Result<()> {
    // TODO: Use objc to call VZVirtualMachine.start()
    Ok(())
}
```

**What's Missing:**
- Objective-C bindings using `objc` crate
- `VZVirtualMachineConfiguration` setup
- `VZVirtioSocketDevice` for guest communication
- `VZLinuxBootLoader` configuration
- IPSW restore image handling

**Impact:**
- `a2r run --vm` on macOS will fail or fall back to local execution

---

### Gap 2: Session Persistence in CLI
**Severity: MEDIUM**

The CLI's `LocalSession` creates sessions but doesn't persist them to the session manager's database:

```rust
// Current: Creates ephemeral session
async fn create_session(&self, spec: SessionSpec) -> Result<Session> {
    Ok(Session { ... })  // Not persisted
}
```

**What's Missing:**
- Integration between CLI sessions and `a2r-session-manager`
- The CLI creates its own sessions instead of using `SessionManager::create_session()`

**Impact:**
- `a2r sessions` shows empty list after running commands
- Sessions don't survive CLI restart

---

### Gap 3: Guest Agent Protocol
**Severity: MEDIUM**

The CLI references `a2r_session_manager::protocol::GuestAgentClient` which doesn't exist:

```rust
// macos.rs
use a2r_session_manager::protocol::GuestAgentClient;  // ❌ Not implemented
```

**What's Missing:**
- VSOCK-based guest agent communication
- Protocol definitions (protobuf/json)
- Guest agent server (runs inside VM)

**Impact:**
- VM sessions can't execute commands (no guest communication)
- Desktop app integration broken

---

### Gap 4: Cowork Runtime Integration
**Severity: MEDIUM**

The cowork commands exist but may not fully integrate with `a2r-cowork-runtime`:

**What's Missing:**
- API client for cowork runtime
- Event streaming implementation
- Attachment state management verification

---

### Gap 5: Firecracker Configuration Mismatch
**Severity: LOW**

The CLI expects different Firecracker config than what the driver provides:

```rust
// CLI expects:
FirecrackerConfig {
    firecracker_binary: String,
    jailer_binary: Option<String>,
    runtime_dir: String,
    ...
}

// Driver provides:
FirecrackerConfig {
    firecracker_bin: PathBuf,
    jailer_bin: PathBuf,
    chroot_base_dir: PathBuf,
    ...
}
```

**Impact:**
- Linux VM mode configuration may need adjustment

---

## 🔧 Recommended Fixes

### Short Term (For Basic Usage)
1. **Local execution mode works** - Use for development/testing
2. **Document VM mode limitations** - Make it clear `--vm` is not yet functional
3. **Fix session persistence** - Connect CLI to SessionManager properly

### Medium Term (For Production)
1. **Implement Apple VF bindings**:
   ```rust
   // Add to a2r-apple-vf-driver
   use objc::runtime::{Object, Sel};
   use cocoa::base::id;
   
   // Bind to VZVirtualMachine
   ```

2. **Implement Guest Agent**:
   ```rust
   // Add protocol module to a2r-session-manager
   pub mod protocol {
       pub struct GuestAgentClient;
       // VSOCK communication
   }
   ```

3. **Fix Firecracker Config**:
   - Align CLI expectations with driver implementation

### Long Term
1. **Full cowork runtime integration**
2. **Desktop app socket communication**
3. **VM snapshot/checkpoint support**

---

## ✅ Verified Working Commands

```bash
# These work correctly:
a2r status                    # ✅ Shows platform info
a2r run -- <command>          # ✅ Executes locally
a2r sessions                  # ✅ Lists sessions (empty for now)
a2r --help                    # ✅ Shows help

# These have gaps:
a2r run --vm -- <command>     # ❌ VM mode not implemented
a2r cowork start <task>       # ⚠️ Needs runtime verification
```

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| CLI shell | ✅ Working | Argument parsing, help, status |
| Local execution | ✅ Working | Bubblewrap or direct |
| Session tracking | ⚠️ Partial | In-memory only, not persisted |
| Apple VF VM | ❌ Not working | Needs objc bindings |
| Firecracker VM | ⚠️ Partial | Config mismatch |
| Cowork commands | ⚠️ Partial | Needs runtime verification |
| Session manager | ✅ Working | Database, drivers functional |
