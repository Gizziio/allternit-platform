# A2rchitech Session Summary — Claude Task System vs Governed Agent Swarms

**Topic:** Mapping Anthropic’s Claude Task System to A2rchitech’s Swarm-Oriented Orchestration Architecture  
**Date:** 2026-01-26  
**Scope:** Multi-agent DAG scheduling, persistence, recursive delegation, verification layers, and UX parity targets.

---

## 1. What Claude Actually Shipped (De-Hyped)

Claude Code’s new “task system” is not merely todo tracking. It provides four structural primitives:

### Core Capabilities
| Capability | Description |
|-----------|------------|
| Persistent DAG | Tasks stored outside chat sessions; survive terminal restarts |
| Dependency Enforcement | `blockedBy` edges enforce order structurally |
| Context Isolation | Each task spawns a fresh agent with its own token window |
| Parallel Scheduling | All unblocked tasks run simultaneously |
| Auto Model Routing | Lightweight models for search, heavy models for reasoning |

**Key Shift:**  
> Cognition moved from transient LLM context → durable symbolic structures (graphs + artifacts).

---

## 2. What Problem This Solves

Classic failure mode:

- Plan lives in chat
- Context window saturates
- Dependencies forgotten
- Humans re-anchor
- Drift accumulates

Claude’s approach:

| Old | New |
|----|----|
| Plan in prompt | Plan in persistent graph |
| Sequential execution | Parallel scheduling |
| Memory fragile | Durable |
| Order implicit | Order enforced |

---

## 3. What Is Not Novel

Architecturally:

- DAG schedulers → Airflow / Temporal
- Worker pools → Ray / Celery
- Hierarchical planning → HTN planners
- Build graphs → `make`
- Agent recursion → AutoGPT-era designs

**Novelty = productization + UX**, not research.

---

## 4. Recursive Swarms — Reality Check

CJ Hess proposes agents spawning agents recursively (“layer 4”).

Feasible only with:

- Immutable specs
- Contract-driven IO
- Acceptance tests
- Security sandboxes
- Cost governance
- Human release gates

Without these, recursion produces faster garbage.

---

## 5. A2rchitech vs Claude: Feature-Level Mapping

### Orchestration Layer

| Claude Task System | A2rchitech |
|------------------|-----------|
| Task DAG | Work Item Header (WIH) + /spec Deltas |
| Persistent tasks on disk | /SOT.md + repo-native law |
| blockedBy edges | AcceptanceTests gating |
| Sub-agents per task | Router-assigned Agents (Architect / Implementer / Tester / Security) |
| Auto scheduling | Brain Runtime Registry |
| Model routing | Multi-LLM Router |
| IDE UI | Capsule + AG-UI shells |
| Task artifacts | Artifact model (diff/log/image/doc) |

---

### Governance & Safety (Claude lacks / A2rchitech has)

| Control | Claude | A2rchitech |
|--------|-------|-----------|
| Spec baseline | ❌ | ✅ |
| Append-only deltas | ❌ | ✅ |
| Repo law enforcement | ❌ | ✅ |
| Contract schemas | ❌ | ✅ |
| CI gating | ❌ | ✅ |
| Threat models | ❌ | ✅ |
| Audit logs | Partial | First-class |
| Tool permission tiers | Partial | Formal |

---

### Strategic Positioning

- **Claude:** velocity-first swarm scheduler.
- **A2rchitech:** industrial-grade autonomous software factory.

---

## 6. What Claude Does Better Right Now

These are gaps to close:

### UX Advantages to Replicate

1. **Instant DAG visualization**
2. **One-keystroke task view**
3. **Trivial persistence env var**
4. **Zero-config parallel spawn**
5. **Auto model tiering**
6. **IDE-native integration**

---

## 7. Required A2rchitech Parity Modules

### MoX-A2R-Swarm-001 — Swarm Control Plane
- DAG runtime engine
- Recursive agent spawning
- Budget caps per subtree
- Deadlock detection
- Cost telemetry

### MoX-A2R-Swarm-002 — Persistent Graph Store
- SQLite/Postgres task graph
- Artifact registry
- Resume-from-crash semantics
- Multi-session attach

### MoX-A2R-Swarm-003 — DAG UI Capsule
- Visual dependency editor
- Live execution states
- Artifact drill-down
- Cost per node
- Contract links

### MoX-A2R-Swarm-004 — Recursive Delegation Policy
- Depth limits
- Budget ceilings
- Spec inheritance
- Auto-promotion to human review
- Risk escalation rules

---

## 8. Architecture Principle Reinforced

This session reconfirms A2rchitech’s core thesis:

> Durable structures > context windows.

Execution must be anchored in:

- specs
- contracts
- tests
- laws
- artifacts
- audit logs

---

## 9. Strategic Takeaways

- Claude proved the UX path.
- Governance remains unsolved.
- Verification is the long-term moat.
- Orchestration engineering replaces prompt engineering.
- A2rchitech is positioned above IDE-level copilots.

---

## 10. Follow-On Build Targets

Immediate:

- DAG engine prototype
- Task persistence store
- Swarm visualization capsule
- Recursive delegation rules
- Budget governor
- Artifact lifecycle manager

Mid-term:

- Multi-repo orchestration
- Distributed swarm execution
- Security-isolated sandboxes
- Economic scheduler
- Compliance/audit export

---

## 11. Session Classification

**Domain:** A2rchitech Core Architecture  
**Sub-Topic:** Swarm Orchestration vs Claude Task Runtime  
**Importance:** High — validates design direction and surfaces UX parity targets.

---