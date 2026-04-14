# DAK Runner Architecture

**Version:** 1.0.0  
**Last Updated:** 2026-02-08

This document describes the architecture of the Deterministic Agent Kernel (DAK) Runner and its integration with the broader A2R system.

---

## Table of Contents

1. [System Context](#1-system-context)
2. [Component Architecture](#2-component-architecture)
3. [Data Flow](#3-data-flow)
4. [Integration Points](#4-integration-points)
5. [Security Model](#5-security-model)
6. [Deployment Architecture](#6-deployment-architecture)

---

## 1. System Context

### 1.1 Position in A2R Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   CLI        │  │   Desktop    │  │   Web UI     │              │
│  │   (a2r)      │  │   (Electron) │  │   (Browser)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INTENT LAYER (1-kernel)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Intent Graph Kernel (Rust)                       │  │
│  │   - Intent parsing    - Plan generation   - Graph building   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ DAG + WIH
┌─────────────────────────────────────────────────────────────────────┐
│                   EXECUTION LAYER (1-kernel)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    DAK RUNNER (This Project)                  │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │   DAG        │  │    WIH       │  │   Policy     │        │  │
│  │  │   Parser     │  │   Parser     │  │   Injection  │        │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │  Snapshots   │  │   Monitoring │  │   Reports    │        │  │
│  │  │   Store      │  │  (CB/Retry)  │  │   Schemas    │        │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   CONTROL    │    │    AGENTS    │    │   SERVICES   │
│    PLANE     │    │    FOLDER    │    │              │
├──────────────┤    ├──────────────┤    ├──────────────┤
│  Rails API   │◄──►│  Templates   │    │ Prompt Pack  │
│  - Gates     │    │  Roles       │    │  Service     │
│  - Leases    │    │  Cookbooks   │    │  (Port 3005) │
│  - Receipts  │    │  Specs       │    │              │
│  - Ledger    │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
       ▲                                              
       │    ┌──────────────────────────────────────┐   
       └───►│          3-adapters/                 │   
            │  Rails Adapter, Context Router, etc. │   
            └──────────────────────────────────────┘   
```

### 1.2 Authority Boundaries

```
┌────────────────────────────────────────────────────────────────┐
│                     AUTHORITY MATRIX                            │
├──────────────────┬──────────────────┬──────────────────────────┤
│     Component    │   Can Write      │    Can Read              │
├──────────────────┼──────────────────┼──────────────────────────┤
│ Rails (Control)  │ Ledger, Leases   │ Everything               │
│                  │ Receipts, Gates  │                          │
├──────────────────┼──────────────────┼──────────────────────────┤
│ DAK Runner       │ Runner workspace │ DAGs, WIHs, Policies     │
│ (Execution)      │ (.a2r/runner/*)  │ Snapshots (own)          │
│                  │ Snapshots        │ Tool outputs             │
├──────────────────┼──────────────────┼──────────────────────────┤
│ Agents Folder    │ Nothing          │ Reference only           │
│ (Advisory)       │                  │ (Templates, Specs)       │
└──────────────────┴──────────────────┴──────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Core Components

```
┌──────────────────────────────────────────────────────────────────┐
│                      DAK RUNNER CORE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     API LAYER                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │  │
│  │  │DagParser │ │WIHParser │ │Policy    │ │Snapshot  │      │  │
│  │  │          │ │          │ │Injector  │ │Store     │      │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   EXECUTION ENGINE                          │  │
│  │                                                             │  │
│  │   ┌────────────────────────────────────────────────────┐   │  │
│  │   │              DagExecutor                            │   │  │
│  │   │                                                     │   │  │
│  │   │  ┌─────────────┐    ┌─────────────┐                │   │  │
│  │   │  │Topological  │───►│  Node       │                │   │  │
│  │   │  │Sort (Kahn)  │    │  Executor   │                │   │  │
│  │   │  └─────────────┘    └──────┬──────┘                │   │  │
│  │   │                            │                       │   │  │
│  │   │  ┌─────────────────────────┼────────────────────┐  │   │  │
│  │   │  │    Hooks              │                      │  │   │  │
│  │   │  │  ┌──────────┐  ┌──────┴──────┐  ┌──────────┐ │  │   │  │
│  │   │  │  │PreToolUse│  │ToolExecution│  │PostToolUse│ │  │   │  │
│  │   │  │  └──────────┘  └─────────────┘  └──────────┘ │  │   │  │
│  │   │  └──────────────────────────────────────────────┘  │   │  │
│  │   └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              POLICY & COMPLIANCE LAYER                      │  │
│  │                                                             │  │
│  │   ┌───────────────┐    ┌───────────────┐                   │  │
│  │   │ Policy Bundle │───►│ Gate Checker  │                   │  │
│  │   │   Loader      │    │ (Rails API)   │                   │  │
│  │   └───────────────┘    └───────────────┘                   │  │
│  │          │                                              │  │
│  │          ▼                                              │  │
│  │   ┌───────────────┐    ┌───────────────┐                   │  │
│  │   │  Injection    │    │   Receipt     │                   │  │
│  │   │   Marker      │    │   Emitter     │                   │  │
│  │   │   Generator   │    │   (Rails)     │                   │  │
│  │   └───────────────┘    └───────────────┘                   │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              DETERMINISM LAYER                              │  │
│  │                                                             │  │
│  │   ┌────────────────────────────────────────────────────┐   │  │
│  │   │              SnapshotStore                          │   │  │
│  │   │                                                     │   │  │
│  │   │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │  │
│  │   │  │ Content  │  │ Request  │  │  Index   │        │   │  │
│  │   │  │ Hashing  │  │Normalize │  │  Lookup  │        │   │  │
│  │   │  │(SHA-256) │  │(dedupe)  │  │          │        │   │  │
│  │   │  └──────────┘  └──────────┘  └──────────┘        │   │  │
│  │   └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │   ┌────────────────────────────────────────────────────┐   │  │
│  │   │              ReplayEngine                           │   │  │
│  │   │                                                     │   │  │
│  │   │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │  │
│  │   │  │  Exact   │  │  Fuzzy   │  │ Similarity│        │   │  │
│  │   │  │  Match   │  │  Match   │  │   Match   │        │   │  │
│  │   │  └──────────┘  └──────────┘  └──────────┘        │   │  │
│  │   └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Details

#### DAG Parser & Executor

```
Input: YAML DAG Definition
       │
       ▼
┌─────────────────┐
│   DAG Parser    │
│                 │
│ - Schema        │
│   validation    │
│ - Reference     │
│   resolution    │
│ - Canonical     │
│   form          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DagExecutor    │
│                 │
│ - Topological   │
│   sort (Kahn)   │
│ - Cycle         │
│   detection     │
│ - Parallel      │
│   execution     │
│ - Gate eval     │
└────────┬────────┘
         │
         ▼
Output: Execution Result
```

**Key Algorithms:**
- **Kahn's Algorithm:** O(V + E) topological sort
- **Cycle Detection:** Fail-fast during sort
- **Gate Evaluation:** Pre/post node hooks

#### WIH Parser

```
Input: Markdown + YAML Front Matter
       │
       ▼
┌─────────────────┐
│   WIH Parser    │
│                 │
│ - Front matter  │
│   extraction    │
│ - Schema        │
│   validation    │
│ - Scope         │
│   enforcement   │
└────────┬────────┘
         │
         ▼
Output: WIH Object
        │
        ├── work_item_id
        ├── scope (paths, tools)
        ├── inputs (SoT, reqs)
        ├── outputs (artifacts)
        └── acceptance (gates)
```

#### Policy Injection

```
Input: Policy Bundle + Context
       │
       ▼
┌─────────────────────────┐
│    PolicyInjector       │
│                         │
│  1. Load bundle         │
│  2. Validate hash       │
│  3. Generate marker     │
│  4. Sign marker         │
│  5. Persist marker      │
└───────────┬─────────────┘
            │
            ▼
Output: InjectionMarker
        │
        ├── marker_id (UUID)
        ├── policy_bundle_hash
        ├── context_hash (SHA-256)
        ├── injection_point
        └── signature
```

**Injection Points:**
1. `session_start` - Agent session begins
2. `dag_load` - DAG loaded for execution
3. `node_entry` - Node execution starts
4. `tool_invoke` - Tool about to execute

#### Snapshot Store

```
Input: Tool Request + Response
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ Normalize    │   │ Content Hash │
│ Request      │   │ (SHA-256)    │
│              │   │              │
│ - Remove     │   └──────┬───────┘
│   timestamps │          │
│ - Remove     │          ▼
│   nonces     │   ┌──────────────┐
└──────┬───────┘   │ Deduplication│
       │           │ Check        │
       │           └──────┬───────┘
       │                  │
       └──────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Store to Disk│
                   │ (.a2r/snap/) │
                   └──────────────┘
```

---

## 3. Data Flow

### 3.1 Complete Execution Flow

```
User Intent
     │
     ▼
┌─────────────────────┐
│ Intent Graph Kernel │
│ - Parse intent      │
│ - Generate plan     │
│ - Create DAG        │
└──────────┬──────────┘
           │ DAG + WIH
           ▼
┌─────────────────────┐
│   DAK RUNNER        │
│                     │
│ 1. Parse DAG        │
│ 2. Parse WIH        │
│ 3. Load policies    │
│ 4. Inject markers   │
│ 5. Execute nodes    │
│ 6. Check gates      │
│ 7. Emit receipts    │
│ 8. Store snapshots  │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────┐
│  Rails  │ │ Agents/ │
│ (State) │ │(Prompts)│
└─────────┘ └─────────┘
```

### 3.2 Node Execution Flow

```
Start Node Execution
         │
         ▼
┌─────────────────────┐
│ Inject Policy       │
│ Marker              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Check Gate          │────►│ Rails Gate API      │
│ (PreToolUse)        │     │                     │
└──────────┬──────────┘     │ - Validate lease    │
           │                │ - Check policy      │
     ┌─────┴─────┐          │ - Return decision   │
     ▼           ▼          └─────────────────────┘
┌─────────┐ ┌─────────┐
│ ALLOW   │ │  DENY   │
└────┬────┘ └────┬────┘
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Execute │ │ Return  │
│ Tool    │ │ Error   │
└────┬────┘ └─────────┘
     │
     ▼
┌─────────────────────┐
│ Store Snapshot      │
│ (if configured)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Emit Receipt        │
│ (tool_call_post)    │
└──────────┬──────────┘
           │
           ▼
     Complete
```

### 3.3 Ralph Loop Flow

```
Start Loop
    │
    ▼
┌──────────────┐
│ Spawn        │
│ Builder      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Builder      │
│ Produces     │
│ Artifacts    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Spawn        │
│ Validator    │
└──────┬───────┘
       │
       ▼
┌──────────────┐      ┌──────────┐
│ Validator    │      │  PASS    │
│ Report       │─────►│          │
└──────┬───────┘      └────┬─────┘
       │                   │
       │ FAIL              │
       │                   │
       ▼                   ▼
┌──────────────┐     ┌──────────┐
│ Fix Cycle    │     │ Complete │
│ Count < Max? │     │ WIH      │
└──────┬───────┘     └──────────┘
       │
  ┌────┴────┐
  ▼         ▼
┌──────┐ ┌──────┐
│ Yes  │ │ No   │
└──┬───┘ └──┬───┘
   │        │
   │        ▼
   │   ┌──────────┐
   │   │ Escalate │
   │   │ to User  │
   │   └──────────┘
   │
   └──────(Loop back to Builder)
```

---

## 4. Integration Points

### 4.1 Agents Folder Integration

```
agents/
│
├── AGENTS.md ────────────────────────┐
│   (Agent Law)                        │
│                                      │
├── spec/ ◄────────────────────────────┤
│   ├── DAG_SCHEMA.md ────────────────┤
│   │   (dag/parser.ts implements)     │
│   ├── WIH_SCHEMA.md ────────────────┤
│   │   (wih/parser.ts implements)     │
│   └── BRIDGE_RAILS_RUNNER.md ───────┤
│       (adapters/rails_api.ts)        │
│                                      │
├── roles/ ◄───────────────────────────┤
│   ├── orchestrator.md ──────────────┤
│   ├── builder.md ───────────────────┤
│   ├── validator.md ─────────────────┤
│   │   (Enforced by dag/executor.ts)  │
│   └── reviewer.md                   │
│                                      │
├── packs/templates/ ◄─────────────────┤
│   ├── core/context_prime.j2 ────────┤
│   ├── roles/builder.j2 ─────────────┤
│   ├── roles/validator.j2 ───────────┤
│   │   (Loaded by prompt service)     │
│   └── orch/orchestrator_loop.j2     │
│                                      │
└── cookbooks/ ◄───────────────────────┤
    ├── policy-injection.md ──────────┤
    └── ralph-loop.md ────────────────┘
        (Executed as DAG nodes)
```

### 4.2 Rails API Integration

```typescript
// 3-adapters/rails/rails_api.ts
interface RailsAdapter {
  // Gates
  checkGate(request: GateCheckRequest): Promise<GateCheckResponse>;
  
  // Leases
  requestLease(request: LeaseRequest): Promise<LeaseResponse>;
  releaseLease(leaseId: string): Promise<void>;
  
  // Receipts
  emitReceipt(receipt: Receipt): Promise<ReceiptResponse>;
  getReceipts(query: ReceiptQuery): Promise<Receipt[]>;
  
  // Ledger (read-only for DAK)
  getLedgerEntries(query: LedgerQuery): Promise<LedgerEntry[]>;
}
```

### 4.3 Prompt Pack Service Integration

```
┌─────────────────┐      HTTP      ┌──────────────────┐
│   DAK Runner    │◄──────────────►│ Prompt Pack      │
│                 │   GET /render  │ Service          │
│ - Load template │                │ (Port 3005)      │
│ - Send vars     │                │                  │
│ - Receive       │                │ - Jinja2 render  │
│   rendered      │                │ - Template cache │
└─────────────────┘                └──────────────────┘
```

---

## 5. Security Model

### 5.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized writes | Rails gate checks, lease validation |
| Policy bypass | Signed injection markers, verification |
| Replay attacks | Snapshots with request hashing, nonces |
| Tool injection | ToolRegistry schema validation |
| Privilege escalation | Role separation (builder ≠ validator) |

### 5.2 Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST ZONES                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │    USER      │        │   EXTERNAL   │                  │
│  │   (Untrusted)│        │  (Untrusted) │                  │
│  └──────┬───────┘        └──────┬───────┘                  │
│         │                       │                           │
│         │                       │                           │
│         ▼                       ▼                           │
│  ┌──────────────────────────────────────┐                  │
│  │         DAK RUNNER                   │                  │
│  │       (Sandboxed)                    │                  │
│  │  - Tool snapshots verify integrity   │                  │
│  │  - Policy markers prove compliance   │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │                                           │
│                 │ API calls                                 │
│                 ▼                                           │
│  ┌──────────────────────────────────────┐                  │
│  │           RAILS                      │                  │
│  │       (Trusted Authority)            │                  │
│  │  - Ledger is source of truth         │                  │
│  │  - Gates enforce policy              │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Data Integrity

| Component | Integrity Mechanism |
|-----------|---------------------|
| DAG definitions | Immutable once loaded, hash checked |
| WIH | Signed by orchestrator, verified on load |
| Policy bundles | SHA-256 hash, signature verification |
| Injection markers | Signed, context hash included |
| Snapshots | Content-addressed (SHA-256), tamper-evident |
| Receipts | Signed by Rails, immutable |

---

## 6. Deployment Architecture

### 6.1 Local Development

```
┌──────────────────────────────────────────────┐
│           Local Machine                      │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  DAK Runner (Node.js)                │   │
│  │  - Port: n/a (library)               │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Rails API (Rust/TS)                 │   │
│  │  - Port: 3001                        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Prompt Pack Service (Rust)          │   │
│  │  - Port: 3005                        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Storage: .a2r/ directory                    │
│                                              │
└──────────────────────────────────────────────┘
```

### 6.2 Production Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Namespace: a2r-runner                                │  │
│  │                                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │  │
│  │  │ DAK Runner  │ │ DAK Runner  │ │ DAK Runner  │     │  │
│  │  │  (Pod 1)    │ │  (Pod 2)    │ │  (Pod N)    │     │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │  │
│  │         │                                        │     │  │
│  │         └──────────────┬─────────────────────────┘     │  │
│  │                        │                               │  │
│  │                  Service: dak-runner                  │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┼──────────────────────────────┐  │
│  │  Namespace: a2r-control                                │  │
│  │                        │                               │  │
│  │  ┌─────────────────────┴───────────────────────┐      │  │
│  │  │           Rails API Cluster                 │      │  │
│  │  └─────────────────────────────────────────────┘      │  │
│  │                                                       │  │
│  │  Storage:                                             │  │
│  │  - PVC: a2r-snapshots (shared)                        │  │
│  │  - PVC: a2r-markers (per-pod)                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Scaling Considerations

| Component | Scaling Strategy |
|-----------|-----------------|
| DAK Runner | Horizontal (stateless, use shared snapshot store) |
| Rails API | Horizontal (consistent hashing for leases) |
| Snapshot Store | Vertical (I/O bound) + CDN for distribution |
| Prompt Pack | Horizontal (templates are immutable) |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **DAG** | Directed Acyclic Graph - execution workflow definition |
| **WIH** | Work Item Header - scoped work definition with constraints |
| **DAK** | Deterministic Agent Kernel - this execution runtime |
| **Rails** | Control plane (gates, leases, receipts, ledger) |
| **Ralph Loop** | Bounded fix cycle (builder → validator → builder) |
| **PFS** | Prompt Format Standard - template structure v1 |
| **SoT** | Source of Truth - authoritative document |
| **Receipt** | Tamper-evident record of tool execution |

---

## Appendix B: File Locations

| Artifact | Location |
|----------|----------|
| DAG definitions | `.a2r/graphs/*.json` |
| WIH files | `.a2r/wih/*.json` |
| Snapshots | `.a2r/snapshots/*.json` |
| Markers | `.a2r/markers/**/*.json` |
| Receipts | `.a2r/receipts/**/*.json` |
| Leases | `.a2r/leases/*.json` (Rails-managed) |
| Ledger | `.a2r/ledger/*.json` (Rails-managed) |

---

**END OF ARCHITECTURE DOCUMENT**
