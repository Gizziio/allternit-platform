# N2: Target Architecture Specification

**Version:** 0.1.0-DAG  
**Date:** 2026-02-23  
**Status:** DRAFT  
**Owner:** A2R Architecture Team

---

## 1. Vision Statement

A2R is an **autonomous engineering compute fabric + governance layer** that enables multi-tenant, untrusted agent execution with deterministic outcomes, economic accountability, and enterprise-grade auditability.

### 1.1 Core Definition

```
A2R = Agent-First Execution Fabric + Policy-Governance Layer
```

### 1.2 Primary User Roles

| Role | Responsibilities | Interface |
|------|------------------|-----------|
| **Tenant Admin** | Org setup, billing, policy configuration | Web UI / API |
| **Operator** | Swarm monitoring, incident response, cost oversight | Supervisory UI |
| **Reviewer** | Merge approval, policy violation review | Review UI |
| **Agent (Autonomous)** | Task execution, tool invocation, artifact generation | API / Rails |

### 1.3 Explicit Non-Goals

- ❌ Not an IDE replacement (editors are separate)
- ❌ Not a general-purpose cloud provider (compute is agent-specialized)
- ❌ Not a replacement for existing CI/CD (integrates with them)

---

## 2. Three-Layer Target Architecture

### 2.1 Layer 1: Control Plane (Rails)

**Purpose:** Request routing, policy gates, audit logging, multi-tenant isolation

**Components:**
- **API Gateway** - Authentication, rate limiting, routing
- **Policy Engine** - Real-time policy evaluation
- **Audit Ledger** - Append-only event log
- **Tenant Isolation** - Namespace separation, resource quotas

**Key Invariants:**
```rust
// Every request passes through gate
∀ request ∈ Requests: gate_check(request) → {Allow, Deny, Review}

// Every decision is logged
∀ decision ∈ Decisions: ∃ entry ∈ Ledger: entry.decision == decision

// No cross-tenant data leakage
∀ tenant_a, tenant_b ∈ Tenants: 
  tenant_a ≠ tenant_b ⟹ data(tenant_a) ∩ data(tenant_b) = ∅
```

### 2.2 Layer 2: Execution Plane (Drivers)

**Purpose:** Sandboxed compute, environment management, resource metering

**Components:**
- **Driver Interface** - Abstract execution contract
- **MicroVM Driver** - Firecracker/Kata containers
- **Environment Manager** - Devcontainer/Nix normalization
- **Credential Broker** - Ephemeral scoped credentials
- **Metering Service** - Resource consumption tracking

**Key Invariants:**
```rust
// Execution units are ephemeral
∀ run ∈ Runs: spawn(run) → execute(run) → destroy(run) ⟹ lifecycle_complete

// Resource limits are enforced
∀ run ∈ Runs: consumption(run) ≤ quota(run)

// No long-lived secrets in sandboxes
∀ secret ∈ Secrets, sandbox ∈ Sandboxes:
  lifetime(secret) ≪ lifetime(sandbox)
```

### 2.3 Layer 3: Work Surface (Swarms)

**Purpose:** Agent swarms, task planning, workflow orchestration

**Components:**
- **DAG Executor** - Topological task scheduling
- **Swarm Coordinator** - Multi-agent coordination
- **Scheduler** - Concurrency control, queue management
- **Provenance Tracker** - Artifact lineage, receipts
- **Replay Engine** - Deterministic re-execution

**Key Invariants:**
```rust
// DAGs are acyclic
∀ dag ∈ DAGs: ¬∃ path: start → ... → start

// Parallel runs don't share mutable state
∀ run_a, run_b ∈ Runs:
  concurrent(run_a, run_b) ⟹ mutable_state(run_a) ∩ mutable_state(run_b) = ∅

// Deterministic replay within envelope
∀ run ∈ Runs, envelope ∈ Envelopes:
  replay(run, envelope) ≡ original(run) ± ε
```

---

## 3. Execution Unit Semantics

### 3.1 Execution Unit Definition

```rust
pub struct ExecutionUnit {
    /// Unique identifier
    pub id: ExecutionId,
    
    /// Tenant ownership
    pub tenant: TenantId,
    
    /// Environment specification
    pub env: EnvironmentSpec,
    
    /// Policy constraints
    pub policy: PolicySpec,
    
    /// Resource allocation
    pub resources: ResourceQuota,
    
    /// Lifecycle state
    pub state: ExecutionState,
    
    /// Determinism envelope
    pub envelope: DeterminismEnvelope,
}

pub enum ExecutionState {
    Pending,
    Provisioning,
    Ready,
    Running,
    Completing,
    Complete { receipt: Receipt },
    Failed { reason: FailureReason },
    Quarantined { suspicion: SuspicionLevel },
}
```

### 3.2 Lifecycle Phases

```
Pending
    ↓ [scheduler admission control]
Provisioning
    ↓ [driver spawn]
Ready
    ↓ [exec call]
Running
    ↓ [completion or failure]
Completing
    ↓ [artifact collection]
Complete/Failed/Quarantined
    ↓ [cleanup]
Destroyed
```

---

## 4. Security Invariants

### 4.1 Assume Compromise

```rust
// Blast radius is bounded
∀ compromise ∈ Compromises:
  affected(compromise) ⊆ tenant_scope(compromise) ∪ limited_spillover

// Compromised runs can't silently ship
∀ run ∈ Runs:
  quarantined(run) ⟹ ¬can_promote(run)
```

### 4.2 Defense in Depth

| Layer | Mechanism |
|-------|-----------|
| Control | Policy gates, admission control |
| Network | VPC isolation, egress filtering |
| Compute | MicroVM sandboxing, resource limits |
| Data | Encryption at rest, scoped credentials |
| Audit | Immutable logs, provenance chains |

---

## 5. Multi-Tenant Isolation Model

### 5.1 Hierarchy

```
Organization (Org)
    └── Project
            └── Workspace
                    └── Run
                            └── Step
```

### 5.2 Attribution Scope

| Level | Resources | Quota | Billing |
|-------|-----------|-------|---------|
| Org | Aggregate | Budget cap | Invoice |
| Project | Segregated | Allocated | Allocation |
| Workspace | Isolated | Limited | Tracking |
| Run | Metered | Bounded | Attribution |
| Step | Fine-grained | Burst limit | Granular |

### 5.3 Trust Classes

| Class | Description | Isolation Tier |
|-------|-------------|----------------|
| **Internal** | Org-owned agents | Standard (optional gVisor) |
| **Partner** | Verified external | Hardened (Kata required) |
| **Public** | Marketplace agents | Maximum (Firecracker required) |

---

## 6. Event + Telemetry Schemas

### 6.1 Core Event Types

```rust
pub enum PlatformEvent {
    // Lifecycle events
    RunStarted { run: RunId, tenant: TenantId, timestamp: Timestamp },
    RunCompleted { run: RunId, receipt: ReceiptHash, timestamp: Timestamp },
    RunFailed { run: RunId, reason: FailureReason, timestamp: Timestamp },
    
    // Tool execution events
    ToolCalled { run: RunId, tool: ToolId, inputs: InputHash },
    ToolCompleted { run: RunId, tool: ToolId, outputs: OutputHash },
    ToolFailed { run: RunId, tool: ToolId, error: ErrorInfo },
    
    // Policy events
    PolicyChecked { run: RunId, policy: PolicyId, result: CheckResult },
    PolicyViolated { run: RunId, policy: PolicyId, violation: Violation },
    
    // Resource events
    ResourceAllocated { run: RunId, resources: ResourceSpec },
    ResourceConsumed { run: RunId, delta: ConsumptionDelta },
    QuotaExceeded { run: RunId, quota: QuotaType },
}
```

### 6.2 Telemetry Dimensions

| Dimension | Metrics |
|-----------|---------|
| Cost | CPU-seconds, memory-seconds, egress bytes |
| Performance | Spawn latency, execution time, queue depth |
| Reliability | Success rate, retry count, failure categories |
| Security | Policy violations, quarantines, credential rotations |

---

## 7. Driver Interface Contract (N3 Preview)

### 7.1 Core Interface

```rust
#[async_trait]
pub trait ExecutionDriver: Send + Sync {
    /// Spawn a new execution environment
    async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError>;
    
    /// Execute a command in the environment
    async fn exec(&self, handle: &ExecutionHandle, cmd: CommandSpec) -> Result<ExecResult, DriverError>;
    
    /// Stream logs from the environment
    async fn stream_logs(&self, handle: &ExecutionHandle) -> Result<LogStream, DriverError>;
    
    /// Get artifacts produced by the execution
    async fn get_artifacts(&self, handle: &ExecutionHandle) -> Result<Vec<Artifact>, DriverError>;
    
    /// Destroy the execution environment
    async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError>;
    
    /// Get resource consumption
    async fn get_consumption(&self, handle: &ExecutionHandle) -> Result<ResourceConsumption, DriverError>;
    
    /// Optional: Snapshot the environment state
    async fn snapshot(&self, handle: &ExecutionHandle) -> Result<Snapshot, DriverError> {
        Err(DriverError::NotSupported)
    }
    
    /// Optional: Restore from snapshot
    async fn restore(&self, snapshot: Snapshot) -> Result<ExecutionHandle, DriverError> {
        Err(DriverError::NotSupported)
    }
}
```

### 7.2 Driver Capabilities

```rust
pub struct DriverCapabilities {
    /// Driver type
    pub driver_type: DriverType,
    
    /// Isolation level
    pub isolation: IsolationLevel,
    
    /// Supported environment specs
    pub env_specs: Vec<EnvSpecType>,
    
    /// Resource limits
    pub max_resources: ResourceSpec,
    
    /// Feature flags
    pub features: DriverFeatures,
}

pub enum DriverType {
    MicroVM,      // Firecracker, Kata
    Container,    // gVisor, standard containers
    Process,      // OS processes (dev only)
    Wasm,         // WebAssembly
}

pub enum IsolationLevel {
    Maximum,  // MicroVM + network isolation
    Hardened, // Container + seccomp
    Standard, // Container
    Limited,  // Process (dev only)
}
```

---

## 8. Schema Versioning Strategy

### 8.1 Versioned Components

| Component | Version Scheme | Compatibility |
|-----------|---------------|---------------|
| Environment Spec | SemVer | Backward 2 minor versions |
| Driver Interface | SemVer | Backward 1 major version |
| Policy Schema | SemVer | Backward 1 minor version |
| Scheduler Semantics | Date-based | Backward 1 quarter |
| Receipt Format | Hash-based | Immutable |

### 8.2 Negotiation Protocol

```rust
// Driver advertises capabilities
pub struct DriverHandshake {
    pub driver_id: String,
    pub version: SemVer,
    pub supported_env_specs: Vec<EnvSpecVersion>,
    pub supported_policy_versions: Vec<PolicyVersion>,
    pub capabilities: DriverCapabilities,
}

// Control plane selects compatible configuration
pub struct ExecutionNegotiation {
    pub selected_env_spec: EnvSpecVersion,
    pub selected_policy_version: PolicyVersion,
    pub compatibility_mode: Option<CompatibilityMode>,
}
```

---

## 9. Multi-Driver Strategy

### 9.1 Driver Selection Matrix

| Use Case | Driver | Isolation | Cost |
|----------|--------|-----------|------|
| Public marketplace agents | Firecracker | Maximum | Higher |
| Partner integrations | Kata | Hardened | Medium |
| Internal org agents | gVisor | Standard | Lower |
| Dev/testing | Process | Limited | Minimal |
| WASM workloads | Wasmtime | Standard | Low |

### 9.2 Migration Path

```
Current: WebVM + Local Executor
    ↓
Phase 1: Add gVisor driver (standard isolation)
    ↓
Phase 2: Add Kata driver (hardened isolation)
    ↓
Phase 3: Add Firecracker driver (maximum isolation)
    ↓
Future: Heterogeneous scheduling based on trust tier
```

---

## 10. No Localhost Assumptions

### 10.1 Deployment Targets

| Target | Assumption | Strategy |
|--------|------------|----------|
| Single-node dev | Localhost | Explicit dev mode flag |
| Single-node prod | Private network | Bind to private IPs |
| Multi-node prod | Service mesh | Kubernetes + sidecars |
| Edge | Disconnected | Bundled control plane |

### 10.2 Service Discovery

```rust
pub enum ServiceLocation {
    /// Explicit endpoint (dev/single-node)
    Direct { endpoint: Url },
    
    /// Service mesh endpoint (prod)
    Mesh { service: String, namespace: String },
    
    /// Discovery via control plane
    Discovered { service_type: ServiceType },
}
```

---

## 11. Deliverables

| Document | Location | Status |
|----------|----------|--------|
| Architecture Spec | `spec/DAG_N2_TARGET_ARCHITECTURE_SPEC.md` | ✅ Draft |
| Security Model | `spec/DAG_N2_SECURITY_MODEL.md` | 🚧 Pending |
| Telemetry Spec | `spec/DAG_N2_TELEMETRY.md` | 🚧 Pending |
| Driver Interface | `spec/Contracts/ExecutionDriver.schema.json` | 🚧 Pending |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **DAG** | Directed Acyclic Graph - a workflow representation with dependencies |
| **WIH** | Work Identity Handle - active execution context for a DAG node |
| **Rails** | Policy gates and constraints that guide execution |
| **Swarm** | A coordinated group of agents working on related tasks |
| **Capsule** | A packaged, versioned unit of code/configuration |
| **Receipt** | Cryptographic proof of execution with inputs, outputs, and attestations |
| **Envelope** | The boundary of deterministic behavior for replay |
| **Quarantine** | Isolated state for suspected compromised executions |

---

**End of N2 Target Architecture Specification**
