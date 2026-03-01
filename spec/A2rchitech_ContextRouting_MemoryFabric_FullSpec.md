# /spec/layers/context-routing-memory/FullSpec.md
# A2rchitech Context Routing + Memory Fabric Specification
## Precision Hydration, Consolidation, Decay, Meta-Evolution

Status: Canonical  
Layer: L5 Context Routing + Memory Fabric  
Scope: All agent reasoning, workflows, skills, learning pipelines

---

## 1. Purpose

Context Routing and Memory Fabric together form the **cognitive substrate** of A2rchitech.

Their combined purpose is to:
- deliver *only* the right information at the right time
- prevent context sprawl and hallucination
- preserve provenance and traceability
- enable controlled long-term learning
- enforce forgetting as a first-class operation

Memory without routing causes overload.  
Routing without memory causes amnesia.

---

## 2. Core Principles

1. No global context
2. Just-in-time hydration
3. Typed memory, not blobs
4. Memory is fallible
5. Forgetting is mandatory
6. Evolution is gated
7. Everything is auditable

---

## 3. Memory Tiers (Fabric)

### 3.1 Working Memory
- ephemeral
- phase-scoped
- TTL enforced
- never persisted across sessions

Use cases:
- intermediate reasoning
- scratchpads
- transient computations

### 3.2 Episodic Memory
- append-only
- session-bound
- immutable
- source of truth for replay

Use cases:
- execution history
- decisions
- artifacts
- failures

### 3.3 Long-Term Memory
- curated
- versioned
- policy-gated writes
- decay-enabled

Use cases:
- facts
- preferences
- learned patterns
- stable abstractions

### 3.4 Meta-Memory
- system-level knowledge
- configuration patterns
- optimization insights
- policy tuning candidates

Meta-memory is **never directly mutable** by agents.

---

## 4. Memory Object Model

Every memory object includes:
- memory_id
- tier
- tenant_id
- scope (agent/workflow/skill/global)
- content (typed)
- source_refs (artifact/history pointers)
- confidence score
- created_at
- decay_policy
- version
- hash

---

## 5. Context Routing Pipeline

### 5.1 Candidate Collection
Sources:
- user input
- workflow artifacts
- skill outputs
- episodic memory
- long-term memory
- system constraints

### 5.2 Authorization Filtering
- scope validation
- role-based access
- sensitivity filtering
- redaction rules

### 5.3 Relevance Ranking
- semantic similarity
- recency
- confidence score
- task alignment

### 5.4 Budget Enforcement
- token limits
- size limits
- time limits

### 5.5 Context Compilation
Produces a **Context Bundle**:
- immutable
- hashed
- logged
- phase-specific

---

## 6. Context Bundle Schema

Required fields:
- bundle_id
- session_id
- workflow_id
- phase
- memory_refs[]
- artifact_refs[]
- constraints
- budget_used
- hash

Bundles are replayable units.

---

## 7. Phase-Specific Context Rules

OBSERVE:
- raw inputs
- environment state
- no learned abstractions

THINK / PLAN:
- curated long-term memory
- patterns and heuristics
- no secrets unless required

BUILD:
- specs
- code artifacts
- schemas

EXECUTE:
- minimal operational context
- credentials only via gateway

VERIFY:
- expected outputs
- metrics
- baselines

LEARN:
- evaluation results only
- never raw operational data

---

## 8. Memory Consolidation

### 8.1 Consolidation Triggers
- session end
- workflow completion
- periodic schedule
- explicit meta-agent proposal

### 8.2 Consolidation Process
1) extract candidates from episodic memory
2) cluster and summarize
3) validate against policy
4) assign confidence + decay
5) commit to long-term memory (versioned)

No direct writes from agents.

---

## 9. Memory Decay & Forgetting

### 9.1 Decay Policies
- TTL-based
- usage-based
- confidence-based
- manual tombstone

### 9.2 Forgetting Guarantees
- expired memory is excluded from routing
- tombstones preserved for audit
- forgetting is logged

---

## 10. Meta-Evolution Pipeline

### 10.1 Observation
- history streams
- performance metrics
- failure patterns

### 10.2 Proposal
- meta-agents propose memory schema changes
- routing rule adjustments
- consolidation heuristics

### 10.3 Evaluation
- offline replay
- simulation
- regression testing

### 10.4 Promotion
- policy approval
- version bump
- canary rollout

### 10.5 Rollback
- revert schema/rules
- invalidate affected memory versions

---

## 11. Security Integration

- memory access enforced by AuthZ
- context bundles redacted before provider calls
- providers never see raw memory store
- all access logged to History Ledger

---

## 12. Acceptance Criteria

1) no agent receives unscoped memory
2) context bundles reproducible
3) consolidation is reversible
4) decay occurs automatically
5) meta-changes are gated and auditable

---

End of Context Routing + Memory Fabric Specification
