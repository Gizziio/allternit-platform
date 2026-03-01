# WASM Agentic OS Implementation Plan for A2rchitech

## Executive Summary

Based on thorough analysis of the a2rchitech codebase and research into WASM ecosystem best practices, this is a comprehensive implementation plan for transforming A2rchitech into a WASM-based agentic operating system. The current codebase has solid foundations with 17+ workspace crates covering history, messaging, policy, skills, tools-gateway, and artifact-registry. The key gap is the lack of WASM runtime integration for dynamic tool loading.

---

## Current State Analysis

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| History Ledger (UOCS) | Implemented | `/packages/history/src/lib.rs` |
| Policy Engine | Implemented | `/packages/policy/src/lib.rs` |
| Tool Gateway | Implemented (Native) | `/packages/tools-gateway/src/lib.rs` |
| Skill Registry | Implemented | `/packages/skills/src/lib.rs` |
| Kernel Contracts | Implemented | `/packages/kernel-contracts/src/lib.rs` |
| Artifact Registry | Implemented | `/packages/artifact-registry/src/lib.rs` |
| Runtime Core | Implemented | `/packages/runtime-core/src/lib.rs` |
| Event Bus/Messaging | Implemented | `/packages/messaging/src/lib.rs` |

### What's Missing (Gap Analysis)

| Required Component | Gap Description | Priority |
|-------------------|-----------------|----------|
| **Capsule System** | No content-addressed deployment bundles | P0 |
| **WASM Runtime** | No wasmtime/extism integration | P0 |
| **WIT/ToolABI** | ToolABI exists but not WIT-compatible | P0 |
| **Dynamic Tool Loading** | Tools compiled into kernel | P0 |
| **Cloud Runner** | No primary WASM execution runtime | P1 |
| **Capability System** | No WASI capability grants | P1 |

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                       A2rchitech Kernel                      |
|  +------------------+  +------------------+  +-------------+ |
|  | Policy Engine    |  | Event Ledger     |  | Runtime     | |
|  | (capability-deny)|  | (append-only)    |  | (sessions)  | |
|  +--------+---------+  +--------+---------+  +------+------+ |
|           |                     |                   |        |
|  +--------v---------------------v-------------------v------+ |
|  |                   Tool Gateway (Rust)                   | |
|  |  +----------+  +---------------+  +------------------+  | |
|  |  | ToolABI  |  | WASM Loader   |  | Capability Grant | | |
|  |  | Registry |  | (wasmtime)    |  | System           | | |
|  |  +----------+  +-------+-------+  +------------------+  | |
|  +------------------------+--------------------------------+ |
|                           |                                  |
+---------------------------+----------------------------------+
                            |
            +---------------v---------------+
            |        Capsule Store          |
            |  (content-addressed bundles)  |
            +-------------------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
   +----v----+        +-----v-----+       +-----v-----+
   | Capsule |        | Capsule   |       | Capsule   |
   | Tool A  |        | Tool B    |       | Tool C    |
   | (.wasm) |        | (.wasm)   |       | (.wasm)   |
   +---------+        +-----------+       +-----------+
```

---

## Implementation Phases

### Phase 0: Foundation

**Goal**: Establish WASM runtime infrastructure without breaking existing functionality.

#### 0.1 Add WASM Dependencies

Add to root `Cargo.toml`:
```toml
[workspace.dependencies]
wasmtime = "27.0"
wasmtime-wasi = "27.0"
wit-bindgen = "0.36"
wit-component = "0.220"
sha2 = "0.10"
ed25519-dalek = "2.0"  # For signing
```

#### 0.2 Create `wasm-runtime` Crate

**Location**: `/packages/wasm-runtime/`

```
packages/wasm-runtime/
  Cargo.toml
  src/
    lib.rs           # Main runtime entry
    engine.rs        # Wasmtime engine wrapper
    linker.rs        # Host function linker
    capabilities.rs  # WASI capability grants
    sandbox.rs       # Sandbox configuration
  wit/
    tool-abi.wit     # Tool interface definition
```

#### 0.3 Define WIT Interface for ToolABI

**File**: `/packages/wasm-runtime/wit/tool-abi.wit`

```wit
package a2rchitech:tool-abi@0.1.0;

interface types {
    record tool-input {
        parameters: string,  // JSON-encoded parameters
        session-id: string,
        tenant-id: string,
        trace-id: option<string>,
        idempotency-key: option<string>,
    }

    record tool-output {
        result: string,      // JSON-encoded result
        execution-time-ms: u64,
        side-effects: list<string>,
    }

    variant tool-error {
        validation-error(string),
        execution-error(string),
        policy-denied(string),
        timeout,
    }
}

interface tool {
    use types.{tool-input, tool-output, tool-error};

    /// Execute the tool with given input
    execute: func(input: tool-input) -> result<tool-output, tool-error>;

    /// Get tool metadata (name, description, schema)
    describe: func() -> string;

    /// Validate input before execution
    validate: func(parameters: string) -> result<_, string>;
}

world tool-component {
    export tool;
}
```

---

### Phase 1: Capsule System

**Goal**: Implement signed, content-addressed deployment bundles.

#### 1.1 Create `capsule` Crate

**Location**: `/packages/capsule/`

```
packages/capsule/
  Cargo.toml
  src/
    lib.rs           # Public API
    manifest.rs      # Capsule manifest parsing
    bundle.rs        # Bundle creation/extraction
    signing.rs       # Ed25519 signing/verification
    content_hash.rs  # SHA-256 content addressing
    store.rs         # Capsule storage backend
```

#### 1.2 Capsule Manifest Schema

**File**: `/spec/capsule/manifest.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "version", "tool_abi", "wasm_component", "signature"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Reverse-DNS identifier (e.g., com.a2rchitech.tools.file-reader)"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "tool_abi": {
      "$ref": "#/definitions/ToolABI"
    },
    "wasm_component": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "hash": { "type": "string" },
        "size_bytes": { "type": "integer" }
      }
    },
    "capabilities": {
      "type": "object",
      "properties": {
        "filesystem": { "$ref": "#/definitions/FsCapability" },
        "network": { "$ref": "#/definitions/NetCapability" },
        "env_vars": { "type": "array", "items": { "type": "string" } }
      }
    },
    "signature": {
      "type": "object",
      "properties": {
        "publisher_id": { "type": "string" },
        "public_key": { "type": "string" },
        "signature": { "type": "string" },
        "timestamp": { "type": "integer" }
      }
    }
  }
}
```

#### 1.3 Capsule Rust Types

**File**: `/packages/capsule/src/manifest.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleManifest {
    pub id: String,                    // Reverse-DNS identifier
    pub version: String,               // Semver
    pub tool_abi: ToolABISpec,         // WIT-compatible interface
    pub wasm_component: WasmComponent, // WASM binary metadata
    pub capabilities: Capabilities,    // Required WASI capabilities
    pub signature: CapsuleSignature,   // Publisher signature
    pub content_hash: String,          // SHA-256 of entire bundle
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolABISpec {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,  // JSON Schema
    pub output_schema: serde_json::Value, // JSON Schema
    pub side_effects: Vec<SideEffect>,
    pub safety_tier: SafetyTier,
    pub idempotency: IdempotencyBehavior,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    pub filesystem: Option<FsCapability>,
    pub network: Option<NetCapability>,
    pub env_vars: Vec<String>,
    pub max_memory_mb: u32,
    pub max_execution_time_ms: u64,
}
```

---

### Phase 2: Tool Registry + Dynamic Loading

**Goal**: Replace static tool registration with dynamic discovery and loading.

#### 2.1 Refactor Tool Gateway

**Modify**: `/packages/tools-gateway/src/lib.rs`

Key changes:
1. Add `WasmToolLoader` as new tool type
2. Integrate with capsule store for resolution
3. Add capability verification before loading

```rust
pub enum ToolType {
    Local,
    Http,
    Mcp,
    Sdk,
    Wasm(WasmToolConfig),  // NEW
}

pub struct WasmToolConfig {
    pub capsule_id: String,
    pub capsule_version: String,
    pub cached_instance: Option<Arc<WasmToolInstance>>,
}

impl ToolGateway {
    pub async fn load_wasm_tool(
        &self,
        capsule_id: &str,
        version: Option<&str>,
    ) -> Result<ToolDefinition, ToolGatewayError> {
        // 1. Resolve capsule from store
        // 2. Verify signature
        // 3. Check policy for capsule capabilities
        // 4. Instantiate WASM component
        // 5. Register as available tool
    }

    pub async fn execute_wasm_tool(
        &self,
        tool_id: &str,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        // 1. Get cached WASM instance or load
        // 2. Grant capabilities per manifest
        // 3. Call tool.execute() via WIT
        // 4. Capture output and side effects
        // 5. Log to history ledger
    }
}
```

#### 2.2 Create Tool Registry Service

**Location**: `/packages/tool-registry/`

```rust
pub struct ToolRegistry {
    capsule_store: Arc<CapsuleStore>,
    wasm_runtime: Arc<WasmRuntime>,
    policy_engine: Arc<PolicyEngine>,
    history_ledger: Arc<Mutex<HistoryLedger>>,

    // Discovery indexes
    by_name: HashMap<String, Vec<CapsuleId>>,
    by_capability: HashMap<String, Vec<CapsuleId>>,
    by_publisher: HashMap<String, Vec<CapsuleId>>,
}

impl ToolRegistry {
    /// Discover tools matching criteria
    pub async fn discover(&self, query: ToolQuery) -> Vec<ToolDescriptor>;

    /// Install capsule from remote source
    pub async fn install(&self, source: CapsuleSource) -> Result<CapsuleId>;

    /// Verify capsule signature and integrity
    pub async fn verify(&self, capsule_id: &str) -> Result<VerificationResult>;

    /// Enable/disable tool for tenant
    pub async fn set_enabled(&self, tenant_id: &str, tool_id: &str, enabled: bool);
}
```

---

### Phase 3: Policy Integration

**Goal**: Extend policy engine for capability-based security.

#### 3.1 Extend Policy Types

**Modify**: `/packages/policy/src/lib.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityGrant {
    pub grant_id: String,
    pub capsule_id: String,
    pub tenant_id: String,
    pub granted_capabilities: Vec<Capability>,
    pub constraints: Vec<CapabilityConstraint>,
    pub expires_at: Option<u64>,
    pub granted_by: String,
    pub granted_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Capability {
    Filesystem(FsCapability),
    Network(NetCapability),
    Environment(EnvCapability),
    Clock,
    Random,
    Subprocess(SubprocessCapability),
}

impl PolicyEngine {
    pub async fn evaluate_capsule_load(
        &self,
        capsule: &CapsuleManifest,
        requester: &Identity,
    ) -> Result<CapabilityGrant, PolicyError>;

    pub async fn check_capability(
        &self,
        grant: &CapabilityGrant,
        requested: &Capability,
    ) -> Result<bool, PolicyError>;
}
```

#### 3.2 Default-Deny Capability Model

Following WASI's capability-based security:

```rust
pub struct DefaultDenyPolicy {
    /// Capsules have ZERO capabilities by default
    pub fn minimal() -> Capabilities {
        Capabilities {
            filesystem: None,
            network: None,
            env_vars: vec![],
            max_memory_mb: 64,
            max_execution_time_ms: 5000,
        }
    }

    /// Capabilities must be explicitly granted
    pub fn grant(&mut self, cap: Capability) -> Result<(), PolicyError> {
        // Verify requester has authority to grant
        // Log to audit trail
        // Return granted capability
    }
}
```

---

### Phase 4: WASM Runtime Implementation

**Goal**: Full wasmtime integration with host function bindings.

#### 4.1 WasmRuntime Implementation

**File**: `/packages/wasm-runtime/src/engine.rs`

```rust
use wasmtime::*;
use wasmtime_wasi::*;

pub struct WasmRuntime {
    engine: Engine,
    linker: Linker<ToolHostState>,
    component_cache: RwLock<HashMap<String, Component>>,
}

pub struct ToolHostState {
    wasi: WasiCtx,
    policy_engine: Arc<PolicyEngine>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    capability_grant: CapabilityGrant,
}

impl WasmRuntime {
    pub fn new(config: WasmRuntimeConfig) -> Result<Self> {
        let mut wasmtime_config = Config::new();
        wasmtime_config.wasm_component_model(true);
        wasmtime_config.async_support(true);

        let engine = Engine::new(&wasmtime_config)?;
        let mut linker = Linker::new(&engine);

        // Add WASI preview 2 support
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        // Add custom host functions
        Self::add_host_functions(&mut linker)?;

        Ok(Self {
            engine,
            linker,
            component_cache: RwLock::new(HashMap::new()),
        })
    }

    fn add_host_functions(linker: &mut Linker<ToolHostState>) -> Result<()> {
        // Host function: log to history
        linker.func_wrap_async("a2rchitech:host", "log", |caller, message: String| {
            Box::new(async move {
                let state = caller.data();
                state.history_ledger.lock().unwrap()
                    .append(serde_json::json!({"log": message}))?;
                Ok(())
            })
        })?;

        // Host function: check capability
        linker.func_wrap_async("a2rchitech:host", "check_capability",
            |caller, cap_type: String| {
                Box::new(async move {
                    let state = caller.data();
                    state.policy_engine.check_capability(
                        &state.capability_grant,
                        &Capability::from_string(&cap_type)?,
                    ).await
                })
            }
        )?;

        Ok(())
    }

    pub async fn instantiate_tool(
        &self,
        capsule: &CapsuleManifest,
        wasm_bytes: &[u8],
        grant: CapabilityGrant,
    ) -> Result<WasmToolInstance> {
        // 1. Compile component
        let component = Component::from_binary(&self.engine, wasm_bytes)?;

        // 2. Create WASI context with granted capabilities
        let wasi = self.build_wasi_ctx(&grant)?;

        // 3. Create host state
        let state = ToolHostState {
            wasi,
            policy_engine: self.policy_engine.clone(),
            history_ledger: self.history_ledger.clone(),
            capability_grant: grant,
        };

        // 4. Instantiate
        let mut store = Store::new(&self.engine, state);
        let instance = self.linker.instantiate_async(&mut store, &component).await?;

        Ok(WasmToolInstance { store, instance })
    }
}
```

---

### Phase 5: Event Ledger Enhancement

**Goal**: Extend history ledger for WASM execution audit trail.

#### 5.1 New Event Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WasmEvent {
    CapsuleLoaded {
        capsule_id: String,
        version: String,
        content_hash: String,
        signature_verified: bool,
    },
    CapsuleUnloaded {
        capsule_id: String,
        reason: String,
    },
    CapabilityGranted {
        capsule_id: String,
        capability: Capability,
        granted_by: String,
    },
    CapabilityDenied {
        capsule_id: String,
        capability: Capability,
        reason: String,
    },
    ToolExecutionStarted {
        capsule_id: String,
        tool_id: String,
        input_hash: String,
        session_id: String,
    },
    ToolExecutionCompleted {
        capsule_id: String,
        tool_id: String,
        output_hash: String,
        execution_time_ms: u64,
        side_effects: Vec<String>,
    },
    ToolExecutionFailed {
        capsule_id: String,
        tool_id: String,
        error: String,
    },
}
```

---

### Phase 6: Cloud Runner

**Goal**: Primary execution runtime for WASM tools.

**Location**: `/packages/cloud-runner/`

```rust
pub struct CloudRunner {
    wasm_runtime: Arc<WasmRuntime>,
    tool_registry: Arc<ToolRegistry>,
    policy_engine: Arc<PolicyEngine>,
    scheduler: Arc<Scheduler>,

    // Resource pools
    execution_pool: ExecutionPool,
    memory_pool: MemoryPool,
}

impl CloudRunner {
    pub async fn execute(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, CloudRunnerError> {
        // 1. Resolve capsule
        let capsule = self.tool_registry.resolve(&request.tool_id).await?;

        // 2. Get capability grant from policy
        let grant = self.policy_engine.evaluate_capsule_load(
            &capsule,
            &request.identity,
        ).await?;

        // 3. Acquire execution slot
        let slot = self.execution_pool.acquire().await?;

        // 4. Load and execute
        let instance = self.wasm_runtime.instantiate_tool(&capsule, grant).await?;
        let result = instance.call_execute(request.input).await?;

        // 5. Release slot
        slot.release();

        Ok(result)
    }
}
```

---

### Phase 7: Python Gateway

**Goal**: Python as external gateway only, not embedded in kernel.

**Location**: `/gateways/python/`

```python
# Python MCP gateway for external integrations
import grpc
from a2rchitech_pb2 import ToolRequest, ToolResponse

class A2rchitechGateway:
    """Python gateway for external tool integrations.

    This is NOT part of the kernel - it's a client that submits
    tool requests to the Rust kernel over gRPC.
    """

    def __init__(self, kernel_address: str):
        self.channel = grpc.insecure_channel(kernel_address)
        self.stub = ToolGatewayStub(self.channel)

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict,
        session_id: str,
    ) -> dict:
        """Submit tool execution request to kernel."""
        request = ToolRequest(
            tool_id=tool_id,
            parameters=json.dumps(parameters),
            session_id=session_id,
        )
        response = await self.stub.Execute(request)
        return json.loads(response.result)
```

---

### Phase 8: Migration + Testing

**Goal**: Migrate existing tools to WASM, comprehensive testing.

#### 8.1 Tool Migration Guide

1. **Create WIT interface** for existing tool
2. **Implement tool in Rust** targeting `wasm32-wasip2`
3. **Build capsule** with `cargo component build`
4. **Sign capsule** with publisher key
5. **Register in tool registry**
6. **Test in sandbox** before production

#### 8.2 Test Matrix

| Test Category | Description |
|--------------|-------------|
| Capability Isolation | WASM can't access non-granted resources |
| Signature Verification | Invalid signatures rejected |
| Policy Enforcement | Default-deny works correctly |
| Replay Determinism | Same inputs produce same outputs |
| Resource Limits | Memory/CPU limits enforced |
| Event Ledger | All executions audited |

---

## File Changes Summary

### New Crates

| Crate | Purpose |
|-------|---------|
| `/packages/wasm-runtime/` | Wasmtime integration |
| `/packages/capsule/` | Capsule bundling/signing |
| `/packages/tool-registry/` | Dynamic tool discovery |
| `/packages/cloud-runner/` | Primary WASM executor |

### Modified Crates

| Crate | Changes |
|-------|---------|
| `/packages/tools-gateway/` | Add WasmToolLoader |
| `/packages/policy/` | Add capability grants |
| `/packages/history/` | Add WASM event types |
| `/packages/kernel-contracts/` | Add WIT-compatible ToolABI |

### New Spec Files

| File | Purpose |
|------|---------|
| `/spec/capsule/manifest.schema.json` | Capsule manifest schema |
| `/spec/tool-abi/tool-abi.wit` | WIT interface definition |
| `/spec/capabilities/default-deny.md` | Capability model spec |

---

## Dependencies to Add

```toml
# In workspace Cargo.toml
[workspace.dependencies]
wasmtime = "27.0"
wasmtime-wasi = "27.0"
wit-bindgen = "0.36"
wit-component = "0.220"
ed25519-dalek = { version = "2.0", features = ["std"] }
```

---

## Success Criteria

1. **Tools NOT compiled into kernel** - All tools loaded dynamically as WASM
2. **Default-deny security** - No capabilities without explicit grant
3. **Signed capsules** - All tools cryptographically signed
4. **Full audit trail** - Every execution logged to history ledger
5. **Deterministic replay** - Same inputs produce same outputs
6. **Policy integration** - Policy engine gates all tool loading/execution

---

## Research Sources

- [Extism Plugin System](https://extism.org/docs/concepts/plug-in-system/)
- [wasmCloud Lattice Architecture](https://wasmcloud.com/docs/concepts/lattice/)
- [Wasmtime Component Model](https://docs.wasmtime.dev/api/wasmtime/component/index.html)
- [WASI Capability-Based Security](https://marcokuoni.ch/blog/15_capabilities_based_security/)
- [Microsoft Wassette](https://github.com/microsoft/wassette)
- [WIT Reference](https://component-model.bytecodealliance.org/design/wit.html)

---

## Critical Files for Implementation

1. **`/packages/tools-gateway/src/lib.rs`** - Core logic to modify for WASM tool loading integration
2. **`/packages/kernel-contracts/src/lib.rs`** - ToolABI contracts to extend with WIT-compatible interfaces
3. **`/packages/policy/src/lib.rs`** - Policy engine to extend with capability grants
4. **`/packages/artifact-registry/src/lib.rs`** - Pattern to follow for capsule store implementation
5. **`/spec/A2rchitech_SkillsSystem_FullSpec.md`** - Specification reference for skill/tool architecture
