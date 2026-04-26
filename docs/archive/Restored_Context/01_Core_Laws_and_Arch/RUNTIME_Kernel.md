
# Allternit Agentic OS — Framework / Runtime / Harness Integration Spec

## Purpose
This document consolidates the agreed architecture for mapping **Agent Frameworks, Runtimes, and Harnesses**
into the Allternit Agentic OS, and defines how Allternit exposes these layers through **three user-facing
experience tiers** without fragmenting the underlying system.

This is an integration blueprint, not conceptual commentary.

---

## Core Clarification: These Are NOT “Modes”
Framework, Runtime, and Harness are **distinct architectural layers**, not modes of the same system.

- Different responsibilities
- Different abstraction levels
- Composable, not interchangeable

Correct mental model:
- **Framework** → how agents are constructed
- **Runtime** → how agents execute reliably
- **Harness** → how agents are productized and shipped

---

## Canonical Layer Mapping in Allternit

### 1. Framework Layer — Build Plane
**Concern:** Agent construction & behavior definition

**Responsibilities**
- Agent graph / DSL
- Prompt modules (system, policy, task, examples)
- Tool contracts (schemas, permissions, safety)
- Memory primitives
- UI bindings

**Primary Artifact**
- `AgentSpec`

---

### 2. Runtime Layer — Run Plane
**Concern:** Execution, durability, and recovery

**Responsibilities**
- Checkpointing, resume, retries
- Event bus (LLM, tools, UI, approvals)
- Scheduling & triggers
- Sandboxing & policy enforcement
- Observability & tracing

**Primary Artifacts**
- `RunProfile`
- `RunState`

---

### 3. Harness Layer — Experience Plane
**Concern:** Shipping complete agents

Harness = AgentSpec + RunProfile + UI Schema + Policies (+ Eval)

**Primary Artifact**
- `HarnessSpec`

---

## Three User-Facing Experience Tiers

### Builder Mode
- Full spec + graph editing
- Tool and memory authoring
- Runtime tuning
- Trace and replay access

### Studio Mode
- Guided recipe builder
- Capability cards
- Sliders instead of raw configs
- Safe defaults

### Instant Mode
- Prepackaged harnesses
- Intent → action
- Minimal toggles
- Fastest execution

---

## Run Profiles (Execution Contracts)
- Instant: strict policies, bounded cost
- Studio: expanded but gated
- Builder: full debug access

Same agent, different execution guarantees.

---

## Promotion Lifecycle
Draft → Candidate → Released → Deprecated

Includes versioning, channels, and eval gates.

---

## Evaluation Harness
- Regression tests
- Safety assertions
- Cost/time budgets
- Required for promotion

---

## Provenance & Replay
- Full traces
- State diffs
- Deterministic-ish replay

---

## Packaging
Portable bundle format (`.a2x`) containing:
- AgentSpec
- HarnessSpec
- RunProfiles
- Tool contracts
- UI schema
- Policies
- EvalSpec (optional)

---

## Policy Overlay Model
Policies are layered:
1. Global
2. Workspace
3. Harness
4. User (bounded)

Enforced at runtime.

---

# Integration & Drift Checklist

## 1. Framework Layer
- [ ] Canonical AgentSpec exists
- [ ] Graph-based agent definition
- [ ] Modular prompts
- [ ] Tool schemas enforced
- [ ] Explicit memory primitives

## 2. Runtime Layer
- [ ] Durable execution
- [ ] Checkpoint + resume
- [ ] Unified event stream
- [ ] Runtime policy enforcement

## 3. Harness Layer
- [ ] HarnessSpec exists
- [ ] Versioned releases
- [ ] UI schema defined
- [ ] Pinned run profiles

## 4. Run Profiles
- [ ] Instant / Studio / Builder profiles
- [ ] Tool access differs by profile
- [ ] Budgets enforced

## 5. UI Integration
- [ ] Declarative UI schema
- [ ] Tiered exposure works

## 6. Evaluation
- [ ] EvalSpec defined
- [ ] Promotion gated

## 7. Provenance
- [ ] Trace available
- [ ] Replay supported

## 8. Packaging
- [ ] Import/export supported

## 9. OS Consistency
- [ ] Pattern reused across tools, memory, automations

## 10. Final Drift Test
- [ ] Promote Instant → Studio → New Harness
- [ ] Crash → Resume
- [ ] Replay run

---

## Forward Plan (Committed)
After the Unified Framework UI:
- Zip or file-path access provided
- Full repo audit performed
- Drift identified
- Remediation plan produced
