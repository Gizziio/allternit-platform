# A://RCHITECH — Target Architecture Spec (N2)
## Version 1.0 (2026-02-24)

### 1. The 3-Layer Model

A://RCHITECH is structured into three strictly decoupled layers.

#### Layer 1: Kernel (The Execution Fabric)
*   **Goal:** Provide isolated, ephemeral, and observable compute environments.
*   **Substrates:** Host Process (current), Kata Containers (N4), Firecracker (N4), WebVM (N4).
*   **Invariants:**
    *   No shared state between concurrent runs.
    *   One run = One disposable environment.
    *   Mandatory resource limits (CPU/RAM/IO).
    *   Mandatory output capture (stdout/stderr/artifacts).

#### Layer 2: Control Plane (Governance & Orchestration)
*   **Goal:** Enforce safety, manage budgets, and coordinate autonomous agents.
*   **Core Systems:**
    *   **Policy Engine:** Deny-by-default, policy-as-code enforcement.
    *   **Budget Metering:** Real-time quota and cost tracking.
    *   **Swarm Scheduler:** Dependency-aware task orchestration.
    *   **Replay Engine:** Deterministic run capture and playback.
*   **Invariants:**
    *   Assume Layer 1 is compromised; Layer 2 must be the root of trust.
    *   Every tool call must be policy-checked before Layer 1 execution.
    *   Short-lived, scoped credentials only.

#### Layer 3: Experience (The Supervisory UX)
*   **Goal:** Enable humans to monitor, approve, and audit autonomous swarms.
*   **Core Systems:**
    *   **Shell UI:** TUI/GUI for real-time observation.
    *   **Operator Dashboard:** Multi-tenant fleet management.
    *   **Audit Viewer:** Evidence-backed run receipts and lineage.
*   **Invariants:**
    *   UI is for *Supervision*, not just development.
    *   Approval gates for high-risk policy violations.

---

### 2. Tenant Isolation Model

*   **Tenant:** A billing and policy boundary (e.g., an Organization).
*   **Project:** A logical grouping of workflows and resources.
*   **Workspace:** A specific environment configuration and state.
*   **Run:** A single execution instance of a workflow or task.

**Isolation Hierarchy:**
1.  **Network:** Tenants cannot communicate unless explicitly peered.
2.  **Compute:** Different tenants never share the same VM/Sandbox.
3.  **Storage:** Encrypted-at-rest with tenant-specific keys.

---

### 3. Core Contracts

#### Execution Driver Interface (N3)
```rust
pub trait ExecutionDriver: Send + Sync {
    async fn spawn(&self, spec: SpawnSpec) -> Result<InstanceId, DriverError>;
    async fn execute(&self, id: &InstanceId, cmd: CommandSpec) -> Result<ExecutionResult, DriverError>;
    async fn destroy(&self, id: &InstanceId) -> Result<(), DriverError>;
    async fn stats(&self, id: &InstanceId) -> Result<ResourceStats, DriverError>;
}
```

#### Policy Request Contract
```json
{
  "tenant_id": "org_123",
  "actor": "agent_alpha",
  "action": "file_write",
  "resource": "/etc/shadow",
  "context": {
    "safety_tier": "critical"
  }
}
```

---

### 4. Security Invariants
1.  **Deny-by-Default:** Every action requires an explicit allow rule.
2.  **Provenance:** No artifact exists without a citeable source and run receipt.
3.  **Ephemeral Secrets:** No persistent API keys in sandboxes; use short-lived tokens.
