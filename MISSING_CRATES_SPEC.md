# Missing Crates Specification

## Required for 7-apps/cli (a2r) to Build

### 1. a2r-session-manager
**Location**: `1-kernel/execution/a2r-session-manager/`
**Purpose**: Session lifecycle management for CLI
**Required Types**:
- `SessionId` - UUID wrapper
- `SessionSpec` - Session creation specification
- `Session` - Session handle with name, status, start_time
- `SessionStatus` - Enum: Creating, Ready, Running, Stopped, Error

**Required Functions**:
```rust
impl SessionManager {
    pub async fn new(use_vm: bool) -> Result<Self>;
    pub async fn create_session(&self, spec: SessionSpec) -> Result<Session>;
    pub async fn list_sessions(&self) -> Result<Vec<Session>>;
    pub async fn destroy_session(&self, id: SessionId) -> Result<()>;
    pub async fn exec(
        &self, 
        session: &Session, 
        command: Vec<String>, 
        env: HashMap<String, String>, 
        timeout_ms: Option<u64>
    ) -> Result<ExecResult>;
}
```

**Dependencies**:
- `a2r-driver-interface` (exists)
- `a2r-process-driver` (exists)
- `a2r-firecracker-driver` (exists)

---

### 2. a2r-apple-vf-driver
**Location**: `1-kernel/execution/a2r-apple-vf-driver/`
**Purpose**: macOS Apple Virtualization Framework driver
**Required Types**:
- `AppleVFDriver` - Implements Driver trait
- `AppleVFConfig` - VM configuration

**Required Implementation**:
```rust
#[async_trait]
impl Driver for AppleVFDriver {
    async fn create(&self, spec: &EnvironmentSpec) -> Result<Box<dyn Environment>>;
    async fn destroy(&self, id: &str) -> Result<()>;
    fn driver_type(&self) -> DriverType {
        DriverType::AppleVirtualization
    }
}
```

**Note**: Can reference TypeScript implementation in `cowork/drivers/apple-vf.ts` for logic

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     7-apps/cli (a2r)                         │
│  Commands: run, sessions, vm, repl, shell, cowork, etc.      │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│            1-kernel/execution/a2r-session-manager            │
│  - Session lifecycle (create, list, destroy)                 │
│  - Command execution dispatch                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│   a2r-process │ │ a2r-fire-   │ │ a2r-apple-  │
│   -driver     │ │ cracker-    │ │ vf-driver   │
│               │ │  driver     │ │  (MISSING)  │
└───────────────┘ └─────────────┘ └─────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│         1-kernel/infrastructure/a2r-driver-interface        │
│              (Trait definitions - EXISTS)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Requiring Updates

### 7-apps/cli/src/sessions/mod.rs
References `a2r_session_manager` - will work once crate exists

### 7-apps/cli/src/driver_selection.rs
References `a2r_apple_vf_driver` - needs driver implementation

### 7-apps/cli/src/commands/run.rs
Line 8: `use a2r_session_manager::types::SessionSpec;`
Line 9: `use a2r_driver_interface::ExecResult;`

### 7-apps/cli/Cargo.toml
```toml
[dependencies]
a2r-session-manager = { path = "../../1-kernel/execution/a2r-session-manager" }
a2r-firecracker-driver = { path = "../../1-kernel/execution/a2r-firecracker-driver" }
a2r-apple-vf-driver = { path = "../../1-kernel/execution/a2r-apple-vf-driver" }
```

---

## Cowork System Clarification

### TypeScript Cowork (1-kernel/cowork/)
- **Purpose**: VM execution environment
- **Scope**: Session management within a running VM
- **Drivers**: Apple VF, Firecracker (VM lifecycle)
- **Protocol**: Host-guest communication

### Rust Cowork (1-kernel/cowork/a2r-*/)
- **Purpose**: Job scheduling and Rails integration
- **Scope**: Multi-tenant task scheduling
- **Scheduler**: Cron-based job dispatch
- **Runtime**: DAG execution with checkpoints

**These are NOT duplicates** - they work together:
1. Rust scheduler triggers a job
2. Job creates a VM session via session-manager
3. VM session uses TypeScript drivers for actual VM
4. Protocol layer handles host-guest communication
