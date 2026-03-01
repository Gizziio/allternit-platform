# A2R BUILDOUT VISION 2026
## Autonomous Engineering Operating System

**Document Type:** North Star Vision + Strategic Blueprint  
**Date:** 2026-02-19  
**Status:** Canonical - Tier-0 Authority (alongside PROJECT_LAW.md)  
**Owner:** A2R Architecture Team

---

## Executive Summary

### Vision Statement

> **Compute is abundant. Coordination is scarce.**
> 
> A2R is building the **orchestration fabric for autonomous agent swarms** — a hybrid autonomous engineering cloud that transforms external compute into deterministic, governed, parallel engineering throughput.

### Strategic Position

A2R is **NOT**:
- An IDE replacement
- A thin coding assistant wrapper
- A raw compute provider competing with AWS
- A prompt tool

A2R **IS**:
- A multi-tenant autonomous engineering orchestration platform
- A swarm scheduler + policy engine
- A governance + provenance layer
- A BYOC (Bring Your Own Compute) control plane
- A **Harness Operating System** for agentic software development

### Core Thesis

**Parallelism is the exponent. Governance is the control. Externalized compute is the scaling mechanism.**

---

## Part I: Strategic Foundation

### 1.1 The Primitive Layer Thesis

Five primitives have emerged that change the category:

1. **Plugin System** → Dynamic tool registry + capability injection
2. **Long-running autonomy** → Persistent lifecycle + async supervision
3. **Live docs/context injection** → Deterministic context assembly
4. **Safety gating** → Pre-tool policy enforcement
5. **Spec-enforced workflows** → Plan/spec first, TDD enforcement, review gates

**What these represent:**
- Capability Injection Layer
- Autonomous Session Layer
- Context Assembly Layer
- Safety & Policy Layer
- Structured Workflow Layer

**What's missing:**
- Parallelism and distribution
- Worker fleets + node registry
- DAG scheduling + retry semantics
- Quota enforcement at swarm scale
- Failure recovery across nodes

**A2R's leap:** Absorb primitives into a **deterministic distributed orchestration system**.

---

### 1.2 Living Files Doctrine

**Core Premise:** In an agent-first system, the repository is not storage. It is the **cognitive substrate**.

**Living File Definition:** A versioned artifact that:
1. Is referenced by agents during execution
2. Is validated mechanically (CI, lint, contract test, policy gate)
3. Influences behavior or decision-making
4. Is subject to drift detection
5. Can trigger automated remediation

**Five Categories:**

| Category | Purpose | Examples |
|----------|---------|----------|
| **Intent Files** | Define what should exist | `/spec/baseline/*`, `/spec/deltas/*` |
| **Constraint Files** | Define invariants | `/agent/policy.md`, `/ARCHITECTURE.md` |
| **Quality Ledger** | Measure coherence | `/quality/domain-grades.md` |
| **Runtime Legibility** | Expose behavior | `/runtime/observability/*` |
| **Generated Files** | Machine-produced | `/docs/generated/*` |

**Enforcement Rule:** No file may exist without a declared validation surface.

---

### 1.3 Harness Engineering Blueprint

**Three Core Components:**

1. **Context Engineering**
   - Continuously evolving structured knowledge
   - Knowledge base integrated into codebase
   - External context (observability, browser navigation)

2. **Architectural Constraints**
   - Custom linters
   - Structural tests
   - Explicit architectural boundaries

3. **Garbage Collection Agents**
   - Detect documentation drift
   - Find architectural violations
   - Maintain internal consistency

**Adaptive Feedback Loop:**
```
Agent failure →
Root cause analysis →
Harness upgrade →
Re-run task
```

**You are not optimizing prompts. You are optimizing the control plane.**

---

## Part II: System Architecture

### 2.1 Canonical Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 6: UI / PRESENTATION                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Output      │  │  Agent      │  │  Interactive Visual     │  │
│  │ Studio      │  │  Studio     │  │  Knowledge Graph Engine │  │
│  │ (Marketplace│  │  (Builder)  │  │  (IVKGE)                │  │
│  │  + Publish) │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 5: CONTROL PLANE                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Swarm Orchestration Kernel                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   Swarm     │  │    DAG      │  │    Policy       │    │  │
│  │  │  Scheduler  │  │   Engine    │  │    Engine       │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   Quota +   │  │   Node      │  │   Event Bus +   │    │  │
│  │  │   Billing   │  │  Registry   │  │   Audit Store   │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 4: HARNESS LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   WIH       │  │   Context   │  │   Deterministic         │  │
│  │  Validator  │  │   Pack      │  │   Guardrails            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Tool      │  │   Role      │  │   Evidence              │  │
│  │  Wrapper    │  │  Isolation  │  │   Emitter               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3: EXECUTION FABRIC                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Worker Pools (BYOC / Partner)                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   Kata      │  │  Firecracker│  │   gVisor        │    │  │
│  │  │ Containers  │  │  MicroVMs   │  │   (cost tier)   │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   WASM      │  │   Native    │  │   Browser       │    │  │
│  │  │  (limited)  │  │   Agents    │  │   Automation    │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: DATA PLANE                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   State     │  │   Memory    │  │   Artifact              │  │
│  │   Store     │  │   Store     │  │   Store                 │  │
│  │  (DAG state)│  │  (Vector/   │  │  (Logs, outputs,        │  │
│  │             │  │   Graph)    │  │   code diffs)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: LAW LAYER                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              PROJECT_LAW.md (Tier-0 Authority)             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   SOT.md    │  │  AGENTS.md  │  │  ARCHITECTURE.md │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │              /spec/ (Baseline + Deltas)              │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Agent Types (Production-Validated)

| Type | Trigger | Use Case | Implementation Status |
|------|---------|----------|----------------------|
| **Interactive Coding** | Human-triggered | In-loop sessions | ✅ Partial (needs harness) |
| **Background Agents** | Scheduled/queue | Autonomous PR creators | ⚠️ Partial (needs swarm scheduler) |
| **Cloud Agents** | Webhooks/schedules | Remote VM execution | ❌ Missing (needs edge runner) |
| **24/7 Maintenance** | Continuous | Dependency updates, refactors | ❌ Missing (needs persistent queues) |
| **Swarm / Teams** | Complex tasks | Parallel decomposition | ⚠️ Partial (needs DAG runtime) |
| **Closed-Loop Verification** | Pre-merge | Test, screenshot, validate | ❌ Missing (needs service orchestration) |
| **Agent Hub / Registry** | Task routing | Multi-agent selection | ❌ Missing (needs capability routing) |

---

### 2.3 Hybrid Compute Strategy

**Model A — BYOC (Bring Your Own Compute)**
- Users attach: VPS, cloud account (AWS/GCP/Azure), K8s cluster, on-prem
- A2R runs control plane only
- **Revenue:** Orchestration SaaS subscription

**Model B — Partnered Compute Bundles**
- One-click templates with: DigitalOcean, Vultr, Hetzner, IONOS
- Prebuilt images with A2R runtime preinstalled
- **Revenue:** Affiliate partnerships, marketplace SKUs

**Model C — Minimal Managed Control Plane SaaS**
- A2R hosts: Metadata, scheduler, policy, agent registry, ledger
- Users host: Execution workers
- **Revenue:** Tiered subscriptions based on concurrency/swarm count

**Economic Advantage:**
- Inference costs: **Not carried by A2R** (users bring keys/providers)
- Margins: **Can exceed 80% at scale** (coordination SaaS, not compute hosting)

---

## Part III: Critical Systems

### 3.1 Swarm Runtime Kernel

**Purpose:** Deterministic, policy-bound, cost-governed swarm execution.

**Core Objects:**
- **Swarm:** Execution graph with policy + budget + inputs + agents
- **Node (Task):** Unit of work with dependencies + capabilities + environment
- **Worker:** Sandboxed execution unit (1:1 to Environment Instance)
- **Receipt:** Append-only evidence record with hashes

**Deterministic Scheduling:**
- DAG must be acyclic
- Topological order execution
- READY queue ordered by (priority, then nodeId lexical)
- Worker assignment: smallest available workerId

**Conflict Arbitration:**
1. Prefer higher-priority node
2. If equal: prefer node with stronger evidence (tests + narrower diff)
3. Otherwise: split into separate PRs

**Budget Enforcement:**
- Max wall clock time
- Max CPU-seconds, memory-seconds, egress
- Max spawned EIs, retries
- Admission control denies when budget exhausted

**Failure Model:**
- BOOT_FAIL, SETUP_FAIL, SERVICE_FAIL, CHECK_FAIL, TEST_FAIL
- POLICY_VIOLATION, TIMEOUT, SUSPECTED_COMPROMISE
- Quarantine on SUSPECTED_COMPROMISE (freeze artifacts, block merge)

**Status:** ⚠️ **Spec Complete, Implementation Partial**
- ✅ Spec defined in `A2R_Swarm_Runtime_Kernel_Spec_v1`
- ⚠️ DAK Runner has partial implementation
- ❌ Missing: HTTP mode, lease auto-renewal, receipt query API

---

### 3.2 Output Studio + Marketplace

**Purpose:** Post-processing, composition, rendering, publishing for agent outputs.

**Core Components:**
- **Asset Library:** Typed units (text, markdown, image, audio, video, dataset, chart, diagram)
- **Canvas/Timeline Editor:** Composition surfaces
- **Transform Pipeline:** DAG of Assets + Transforms
- **Plugin System:** Transforms, panels, templates, render backends, connectors
- **Render Receipts:** Traceability + reproducibility

**Marketplace Categories:**
- Multimodal transformers
- Visualization engines
- Template packs
- Render backends
- Publishing connectors
- Compliance/audit exporters
- Inspector overlays

**Status:** ⚠️ **Spec Complete, Implementation Not Started**
- ✅ Full spec in `A2R_OUTPUT_STUDIO_SPEC.md`
- ❌ Zero implementation

---

### 3.3 Interactive Visual Knowledge Graph Engine (IVKGE)

**Purpose:** Turn any visual (diagram, canvas, rendered graph) into explainable, editable data object with stable IDs and provenance.

**Core Scene Model:**
- **Scene:** Versioned graph with stable IDs
- **Entity:** Type, label, geometry, attributes, confidence, provenance_refs
- **Relation:** From/to, type, confidence, provenance_refs
- **Evidence:** Kind, pointer, hash, captured_at

**Interaction Loop:**
1. Point (click, lasso, highlight)
2. Ask (what is this? how does it work? why?)
3. Refine (zoom, select subparts, follow edges)
4. Edit (rename, correct, split/merge, add relation)
5. Export (shareable artifact + data)

**Export Formats:**
- `scene.json` (canonical graph)
- `overlay.svg` (geometry + IDs + labels)
- `graph.graphml` or `graph.json`
- `artifact.html` (shareable interactive viewer)
- `artifact.md` (doc with citations + snapshots)

**Status:** ⚠️ **Spec Complete, Implementation Not Started**
- ✅ Full spec in `A2R_IVKGE_Interactive_Visual_Knowledge_Graph_Engine_2026-02-18.md`
- ❌ Zero implementation

---

### 3.4 A2A Deterministic Review Protocol

**Roles:**
- Implementer
- Self-Reviewer
- Structural Reviewer
- Tester
- Security Reviewer
- Policy Gate
- Garbage Collector (background)

**State Machine:**
```
TASK_CREATED →
IMPLEMENTATION_RUNNING →
SELF_REVIEW →
STRUCTURAL_VALIDATION →
TEST_EXECUTION →
SECURITY_SCAN →
POLICY_EVALUATION →
MERGE_READY →
MERGED
```

**Human Required Only If:**
- Spec conflict
- Architectural violation requiring re-design
- Risk tier exceeds threshold
- Ethical/legal ambiguity

**Status:** ⚠️ **Protocol Defined, Implementation Not Started**
- ✅ Protocol defined in `livingfilestheory.md`
- ❌ Zero implementation

---

### 3.5 Entropy Compression Engine (Garbage Collection)

**Golden Principles:**
- No unvalidated external data
- Boundary parsing required
- Shared utilities over duplication
- Structured logging mandatory
- No silent catch
- Max file size threshold
- Strict dependency direction

**GC Agents (Run Daily):**
1. Detect duplicate utilities
2. Detect untyped boundary usage
3. Detect dependency violations
4. Detect missing observability
5. Detect stale documentation
6. Improve test coverage gaps

**Entropy Score:**
- Calculated from: rule violations, drift rate, test coverage delta, documentation mismatch
- Recorded in: `/quality/entropy-score.md`

**Status:** ❌ **Not Implemented**
- ✅ Spec defined in `livingfilestheory.md`
- ❌ Zero implementation

---

## Part IV: Implementation Status

### 4.1 Current State (From Gap Analysis)

| Layer | Spec'd | Implemented | Coverage | Status |
|-------|--------|-------------|----------|--------|
| **LAW Documents** | 5 | 1 (AGENTS.md) | 20% | 🔴 Critical |
| **Protocols** | 4 | 1 (partial) | 25% | 🔴 Critical |
| **Integration Specs** | 3 | 0 | 0% | 🔴 Critical |
| **Critical Services** | 5 | 2 | 40% | 🔴 Critical |
| **UI Components** | 40 canonical views | 25 | 62% | 🟡 Good |

### 4.2 Missing Critical Implementations

| Component | Priority | Effort | Impact |
|-----------|----------|--------|--------|
| **LAW Consolidation** | P0 | 2 days | 🔴 Critical |
| **IO Binary Decision** | P0 | 1 day | 🔴 Critical |
| **ARCHITECTURE.md Update** | P0 | 1 day | 🔴 Critical |
| **Capsule Framework Registry** | P0 | 3 days | 🔴 Critical |
| **Swarm Scheduler** | P1 | 2 weeks | 🔴 Critical |
| **Policy Service** | P1 | 2 weeks | 🔴 Critical |
| **Harness Layer** | P1 | 3 weeks | 🔴 Critical |
| **Output Studio** | P2 | 4 weeks | 🟡 High |
| **IVKGE** | P2 | 3 weeks | 🟡 High |
| **A2A Review Protocol** | P2 | 2 weeks | 🟡 High |
| **Entropy Compression** | P2 | 1 week | 🟡 High |

---

## Part V: 24-Month Roadmap

### Months 0-6: Swarm Orchestration SaaS (Entry Wedge)

**Goal:** Launch orchestration SaaS with BYO-VPS model.

**Features:**
- Worker registration + node registry
- DAG execution + queue semantics
- Swarm templates (starter)
- Policy enforcement (baseline)
- Basic dashboards
- Tiered subscriptions

**Revenue:** Founders, indie devs, early technical adopters

**Focus:** Reliability > features

---

### Months 6-12: Verticalized Swarm Templates + Marketplace

**Add Packaged Swarms:**
- Engineering Swarm
- Research Swarm
- Business Ops Swarm

**Monetize:**
- Template marketplace fees
- Premium orchestration features
- Higher concurrency tiers
- First enterprise SLAs

---

### Months 12-18: Autonomous Engineering Cloud (Premium Vertical)

**Differentiate with Spec-Driven Execution:**
- Spec → DAG auto-builder
- Code-review isolation roles
- Security gating
- Commit-to-spec traceability
- CI simulation

**Pricing Target:** **$199–$999/month per team** (expand with enterprise tiers)

---

### Months 18-24: Infrastructure Layer Formalization (Ecosystem Moat)

**Harden + Standardize:**
- Public Agent Runtime Spec
- Tool Contract Protocol
- Orchestration API
- SDK for third-party swarms

**Revenue Expands Into:**
- Enterprise licensing
- Managed orchestration clusters
- Marketplace commissions

---

## Part VI: Success Metrics

### Technical KPIs

| Metric | Target | Current |
|--------|--------|---------|
| **Swarm Scale** | 10,000 concurrent agents | 0 |
| **DAG Determinism** | Same inputs → same outputs | ⚠️ Partial |
| **Policy Enforcement** | 100% of tool calls gated | ⚠️ Partial (DAK only) |
| **Harness Coverage** | 100% of changes validated | ❌ 0% |
| **Entropy Score** | < 5% drift/month | ❌ Not measured |
| **GC Cadence** | Daily automated sweeps | ❌ Not implemented |

### Business KPIs

| Metric | Month 6 | Month 12 | Month 18 | Month 24 |
|--------|---------|----------|----------|----------|
| **Active Swarms** | 100 | 1,000 | 5,000 | 20,000 |
| **Monthly Revenue** | $10K | $100K | $500K | $2M |
| **Gross Margin** | 70% | 80% | 85% | 90% |
| **Enterprise Customers** | 0 | 5 | 25 | 100 |
| **Marketplace GMV** | $0 | $50K | $500K | $5M |

---

## Part VII: Non-Negotiable Invariants

### Architectural Invariants

1. **Journal is the only authoritative record** - If not journaled, it did not happen
2. **All execution flows through registered tools** - Renderers never invoke tools
3. **Capsules are agent-generated runtime instances** - Spawned via frameworks
4. **Canvases are declarative projections** - Over journaled events/artifacts
5. **Prompts are compiled directives** - Raw text is never executed
6. **Deterministic DAG execution** - Given fixed inputs + policy
7. **Parallelism without shared mutable state** - Explicit channels only
8. **Budget-aware scheduling** - Quotas, kill switches
9. **Evidence-first outputs** - Receipts, artifacts, lineage
10. **Multi-tenant safety** - Trust-tiered behavior

### LAW Invariants

1. **No Silent Assumptions** (LAW-GRD-001)
2. **No Silent State Mutation** (LAW-GRD-002)
3. **No Backwards Compatibility by Default** (LAW-GRD-003)
4. **Plan ≠ Execute** (LAW-GRD-004)
5. **No "Just Make It Work"** (LAW-GRD-005)
6. **PRD-First Development** (LAW-ORG-001)
7. **Command-ify Everything** (LAW-ORG-002)
8. **Context Reset Discipline** (LAW-ORG-003)
9. **Baseline + Deltas Model** (LAW-META-001)
10. **Single Source of Truth** (LAW-META-002)

---

## Part VIII: Immediate Next Steps (P0 - This Week)

### 8.1 LAW Consolidation

**Task:** Consolidate all LAW documents under single authority

**Actions:**
1. Move PROJECT_LAW.md to repo root (`/PROJECT_LAW.md`)
2. Merge ONTOLOGY_LAW.md into appendix
3. Deprecate archived LAW documents
4. Update all references

**Owner:** Architecture Team  
**Effort:** 2 days  
**Impact:** 🔴 Critical

---

### 8.2 Architecture Truth-Telling

**Task:** Update ARCHITECTURE.md to reflect actual services

**Actions:**
1. Remove Policy Service (3003) OR commit to implement
2. Remove Task Executor (3510) OR commit to implement
3. Add IO binary decision + spec
4. Add Presentation Kernel spec
5. Add Directive Compiler spec

**Owner:** Architecture Team  
**Effort:** 1 day  
**Impact:** 🔴 Critical

---

### 8.3 Harness Layer Implementation (Phase 1)

**Task:** Implement minimal harness gates

**Actions:**
1. WIH parser + JSON-schema validator
2. Policy engine enforcing role isolation + risk tier
3. Tool registry wrapper enforcing schema + preconditions
4. Evidence emitter writing evidence JSON
5. CI scripts for validation
6. GitHub Actions workflow

**Owner:** Backend Team  
**Effort:** 2 weeks  
**Impact:** 🔴 Critical

---

### 8.4 Swarm Scheduler (Minimal)

**Task:** Implement deterministic DAG scheduler

**Actions:**
1. DAG validation + topological sort
2. READY queue management
3. Worker allocation
4. Receipt emission
5. Budget enforcement hooks

**Owner:** Backend Team  
**Effort:** 3 weeks  
**Impact:** 🔴 Critical

---

## Appendix A: Repository Structure (Target)

```
/
├── PROJECT_LAW.md              # Tier-0 Constitutional Law
├── SOT.md                      # Source of Truth
├── AGENTS.md                   # Agent Law (subset of PROJECT_LAW)
├── ARCHITECTURE.md             # System Architecture
├── CODEBASE.md                 # Codebase Map
├── CHANGEPOINTS.md             # Change History
│
├── /spec/                      # Specification Layer
│   ├── Vision.md
│   ├── Requirements.md
│   ├── Architecture.md
│   ├── AcceptanceTests.md
│   ├── Contracts/
│   ├── Deltas/                 # Append-only changes
│   └── HarnessEngineering.md
│
├── /agent/                     # Agent Control Plane
│   ├── POLICY.md
│   ├── ROLE_MATRIX.md
│   ├── TOOLS_REGISTRY.json
│   ├── review-protocol.md
│   ├── golden-principles.md
│   └── garbage-collection.md
│
├── /quality/                   # Quality Ledger
│   ├── domain-grades.md
│   └── entropy-score.md
│
├── /runtime/                   # Runtime Legibility
│   ├── observability/
│   ├── metrics/
│   └── traces/
│
├── /evidence/                  # Evidence Store
│   ├── runs/
│   ├── prs/
│   └── drift/
│
├── /context_packs/             # Context Engineering
│   └── task_<wih_id>.md
│
├── /harness/                   # Harness Engineering
│   ├── schemas/
│   ├── policies/
│   ├── lints/
│   ├── gc_agents/
│   └── ci/
│
├── /kernel/                    # Execution Kernel
│   ├── a2r-kernel/
│   ├── capsule-system/
│   ├── agent-systems/
│   └── infrastructure/
│       └── a2r-harness/
│
├── /services/                  # Platform Services
│   ├── a2r-operator/
│   ├── gateway/
│   ├── memory/
│   ├── registry/
│   ├── orchestration/
│   │   └── swarm-scheduler/
│   └── ml-ai-services/
│       ├── voice-service/
│       ├── prompt-pack-service/
│       └── pattern-service/
│
├── /apps/                      # Applications
│   ├── api/
│   ├── cli/
│   ├── shell-electron/
│   └── shell-ui/
│
└── /docs/                      # Documentation
    ├── _active/                # Active development docs
    ├── _completed/             # Completed reference docs
    └── _archive/               # Historical archive
```

---

## Appendix B: Document Cross-Reference

| Document | Location | Purpose |
|----------|----------|---------|
| **PROJECT_LAW.md** | `docs/_archive/legacy-specs/organized/Architecture/LAW/` | Tier-0 Constitutional Law |
| **ONTOLOGY_LAW.md** | `docs/_archive/legacy-specs/organized/a2rchitech-specs(temporary)/LAW/` | Entity Definitions |
| **AGENTS.md** | `5-agents/AGENTS.md` | DAK Runner Law (active) |
| **Guardrails.md** | `docs/_archive/legacy-specs/organized/Architecture/LAW/` | Guardrails & Templates |
| **SOT.md** | `docs/_archive/legacy-specs/organized/Architecture/UNIFIED/` | Source of Truth |
| **ARCHITECTURE.md** | Root | System Architecture |
| **A2R_Swarm_Runtime_Kernel_Spec_v1** | Brainstorm folder | Swarm Runtime Spec |
| **A2R_OUTPUT_STUDIO_SPEC.md** | Brainstorm folder | Output Studio Spec |
| **A2R_IVKGE_...** | Brainstorm folder | Visual Knowledge Graph Spec |
| **livingfilestheory.md** | Brainstorm folder | Living Files Doctrine |
| **harness-engineering.md** | Brainstorm folder | Harness Blueprint |
| **COMPREHENSIVE_GAP_ANALYSIS.md** | `docs/_active/` | Gap Analysis Report |
| **CONSOLIDATED_BUILDOUT_PLANS.md** | `docs/` | Buildout Plans (to be updated) |
| **IMPLEMENTATION_STATUS_REPORT.md** | `docs/_active/` | Implementation Status |

---

**End of Document**
