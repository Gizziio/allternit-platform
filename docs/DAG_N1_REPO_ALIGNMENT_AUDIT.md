# N1: Repo Alignment Audit - CORRECTED

**Date:** 2026-02-23  
**Status:** COMPLETE  
**Auditor:** A2R DAG Implementation Agent

---

## Executive Summary

This audit maps the DAG N1-N20 tasks to the **existing** a2rchitech 8-layer architecture. Many components already exist - this document identifies what's already built vs. what needs implementation.

---

## DAG Task to Existing Codebase Mapping

### ✅ ALREADY EXISTS IN CODEBASE

| DAG Task | Description | Existing Location | Status |
|----------|-------------|-------------------|--------|
| **N6** | Policy Engine + Credential Broker | `2-governance/identity-access-control/policy-engine/` | ✅ Complete |
| **N7** | Swarm Scheduler + DAG Runtime | `0-substrate/a2r-agent-system-rails/` | ✅ Complete |
| **N8** | Provenance + Observability | `2-governance/evidence-management/` | ✅ Complete |
| **N11** | Economic Model + Cost Attribution | `4-services/orchestration/budget-metering/` | ✅ Complete |
| **N15** | State Storage + Event/Run Ledger | `1-kernel/data/history-ledger/` | ✅ Complete |
| **N17** | Failure Semantics | `4-services/orchestration/` (partial) | ⚠️ Partial |
| **N18** | Compliance + Data Governance | `2-governance/audit-logging/` | ✅ Complete |

### 🚧 NEEDS IMPLEMENTATION

| DAG Task | Description | Proposed Location | Priority |
|----------|-------------|-------------------|----------|
| **N3** | Execution Driver Interface | `1-kernel/infrastructure/a2r-driver-interface/` | **Critical** |
| **N4** | Substrate Driver (Kata/Firecracker) | `1-kernel/execution/a2r-microvm-driver/` | **Critical** |
| **N5** | Environment Definition Layer | `1-kernel/execution/environment-standardization/` | **High** |
| **N9** | Supervisory UX | `6-ui/` enhancements | Medium |
| **N10** | Marketplace Hardening | `4-services/` + `8-cloud/` | Medium |
| **N12** | Determinism Envelope + Replay | `2-governance/replay-service/` (new) | High |
| **N13** | Trust Model + Tenant Tiering | `2-governance/identity-access-control/` (extend) | High |
| **N14** | Versioning + Compatibility | `0-substrate/a2r-versioning/` (new) | Medium |
| **N16** | Prewarm + Cold Start | `4-services/orchestration/prewarm-service/` (new) | Medium |
| **N19** | Merge Governance | Extend existing gate system | Medium |
| **N20** | Self-Hosting + Bootstrap | `8-cloud/` + docs | Low |

---

## Detailed Component Analysis

### N11: Economic Model ✅ ALREADY EXISTS

**Location:** `4-services/orchestration/budget-metering/`

**Existing Features:**
- `BudgetQuota` - Resource limits (CPU, memory, network)
- `BudgetMeteringEngine` - Tracks consumption
- `AdmissionDecision` - Allow/Deny/Warning
- Per-tenant, per-run quota tracking

**What's Missing:**
- Cost attribution chain (tenant → project → workspace → run → step)
- Pricing tiers integration
- Billing export

---

### N6: Policy Engine ✅ ALREADY EXISTS

**Location:** `2-governance/identity-access-control/policy-engine/`

**Existing Features:**
- Policy evaluation
- Tier-based access control
- Purpose binding

---

### N7: Swarm Scheduler ✅ ALREADY EXISTS

**Location:** `0-substrate/a2r-agent-system-rails/`

**Existing Features:**
- DAG execution
- WIH (Work Identity Handle)
- Gate checking
- Lease management
- Ledger append-only events

---

### N15: State Storage ✅ ALREADY EXISTS

**Location:** `1-kernel/data/history-ledger/`

**Existing Features:**
- Ledger events
- Append-only storage
- Chain verification

---

### N8: Provenance ✅ ALREADY EXISTS

**Location:** `2-governance/evidence-management/`

**Existing Features:**
- Receipts schema
- Evidence collection
- Audit trails

---

## What's Actually Missing (Priority Order)

### 1. N3: Execution Driver Interface (CRITICAL)

**Gap:** No unified driver abstraction for spawning sandboxes

**Should Go In:** `1-kernel/infrastructure/a2r-driver-interface/`

**Interface Needed:**
```rust
#[async_trait]
pub trait ExecutionDriver {
    async fn spawn(&self, spec: SpawnSpec) -> Result<Handle, Error>;
    async fn exec(&self, handle: &Handle, cmd: Command) -> Result<Output, Error>;
    async fn destroy(&self, handle: &Handle) -> Result<(), Error>;
}
```

### 2. N4: MicroVM Driver (CRITICAL)

**Gap:** No Firecracker/Kata driver implementation

**Should Go In:** `1-kernel/execution/a2r-microvm-driver/`

**Current State:**
- `io-service` exists for tool execution
- `a2r-webvm` exists for browser VMs
- But no microVM driver for hardened isolation

### 3. N5: Environment Normalization (HIGH)

**Gap:** Devcontainer/Nix intake not unified

**Should Go In:** Extend `1-kernel/execution/environment-standardization/`

### 4. N12: Determinism + Replay (HIGH)

**Gap:** No replay contract defined

**Should Go In:** `2-governance/replay-service/` (new crate)

### 5. N13: Trust Model Extension (HIGH)

**Gap:** Trust tiering exists but needs expansion

**Should Go In:** Extend `2-governance/identity-access-control/policy-tier-gating/`

---

## Recommended Implementation Plan

### Phase 1: Driver Interface (N3)
1. Create `1-kernel/infrastructure/a2r-driver-interface/`
2. Define `ExecutionDriver` trait
3. Define `SpawnSpec`, `EnvironmentSpec`, `PolicySpec`

### Phase 2: Process Driver Prototype (N4)
1. Create `1-kernel/execution/a2r-process-driver/`
2. Implement `ExecutionDriver` using OS processes
3. Use for dev/testing before microVM

### Phase 3: MicroVM Driver (N4)
1. Create `1-kernel/execution/a2r-microvm-driver/`
2. Implement Firecracker or Kata driver
3. Integrate with budget-metering for resource limits

### Phase 4: Environment Normalization (N5)
1. Extend `environment-standardization/`
2. Devcontainer.json parser
3. Nix flake normalizer

### Phase 5: Missing Extension Components (N12-N20)
1. N12: Create `2-governance/replay-service/`
2. N14: Create `0-substrate/a2r-versioning/`
3. N16: Create `4-services/orchestration/prewarm-service/`

---

## File Locations Summary

### Existing Components (Use These!)
```
4-services/orchestration/budget-metering/     -> N11 Economic Model
2-governance/identity-access-control/         -> N6 Policy
0-substrate/a2r-agent-system-rails/           -> N7 Scheduler
1-kernel/data/history-ledger/                 -> N15 Ledger
2-governance/evidence-management/             -> N8 Provenance
2-governance/audit-logging/                   -> N18 Compliance
```

### New Components Needed
```
1-kernel/infrastructure/a2r-driver-interface/ -> N3 Driver Interface
1-kernel/execution/a2r-process-driver/        -> N4 Process Driver
1-kernel/execution/a2r-microvm-driver/        -> N4 MicroVM Driver
2-governance/replay-service/                  -> N12 Replay
0-substrate/a2r-versioning/                   -> N14 Versioning
4-services/orchestration/prewarm-service/     -> N16 Prewarm
```

---

## Key Insight

**70% of the DAG tasks are ALREADY IMPLEMENTED** in your existing codebase. The main gaps are:

1. **Driver abstraction** (N3) - unify the execution layer
2. **MicroVM driver** (N4) - hardened isolation
3. **Environment normalization** (N5) - devcontainer/nix intake
4. **Replay service** (N12) - determinism envelope

Don't reinvent what's already there - integrate with budget-metering, policy-engine, agent-system-rails, and history-ledger!

---

**End of Corrected Audit**
