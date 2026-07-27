# Allternit Markdown IR Standard
## Designing an Executable Markdown-Based Workflow Standard (Research + Architecture)

---

## 0. Purpose of This Document

This document establishes a **research-backed, standards-driven design** for using **Markdown as the human-facing authoring layer** for deterministic, scalable agentic execution in **Allternit**.

It answers three core questions:

1. What Markdown-related standards already exist?
2. What *can safely be reused* from existing frameworks?
3. How do we design a **formal IR + execution model** without reinventing the wheel?

This is not a product spec.  
This is a **standards alignment and architecture justification document** for the Unified UI.

---

## 1. Research Finding: What Markdown IR Standards Exist Today

### 1.1 CommonMark (Existing Standard)

**CommonMark** is the only *formal, widely adopted* Markdown standard.

What it standardizes:
- Syntax
- Parsing rules
- AST consistency
- Test suites

What it does **not** standardize:
- Semantics
- Execution
- Control flow
- State
- Graphs

**Conclusion**  
CommonMark is a **syntax foundation only**, not a workflow or execution IR.

---

### 1.2 Spec-Markdown (Pattern, Not a Standard)

Spec-Markdown demonstrates a proven pattern:
- Markdown → AST
- AST → structured IR
- IR → rendered output (HTML specs)

This proves that:
- Markdown can safely act as a **semantic input**
- Structured meaning can be layered without breaking Markdown

However:
- It is **documentation-focused**
- It is **not an execution or workflow standard**

**Conclusion**  
Spec-Markdown validates the *approach*, not the *domain*.

---

### 1.3 Negative Finding (Important)

> There is currently **no industry standard** where Markdown itself is a formal execution IR for workflows or agents.

This gap is real.

All existing systems either:
- treat Markdown as documentation only, or
- use it ad hoc as input to proprietary tools.

---

## 2. Design Principle: Markdown Is the Spec, Not the Runtime

Allternit adopts the same separation used by successful standards:

| Layer | Example Analogy |
|-----|----------------|
| Authoring | YAML / SQL / Markdown |
| Canonical IR | OpenAPI / ONNX / LLVM |
| Execution | Kubernetes / DB engine / ML runtime |

**Key rule**

> Markdown is never executed directly.  
> Markdown is compiled into a **typed Intermediate Representation (IR)**.

---

## 3. Borrowed Standards (By Concern)

This design intentionally **reuses proven frameworks** instead of inventing new ones.

### 3.1 Syntax → CommonMark

- Use CommonMark as-is
- No forks
- No new Markdown dialect

Why:
- Universal tooling
- Editor support
- LLM-native format
- Diff-friendly

---

### 3.2 Semantics → Spec-Markdown / OpenAPI Pattern

Borrow the pattern:
- Headings define structure
- Frontmatter defines defaults
- Annotations define intent

But apply it to **execution semantics**, not rendering.

---

### 3.3 Execution Graph → DAG Workflow Engines

Borrow concepts from:
- Temporal
- Airflow
- Prefect
- Dagster

Specifically:
- DAG execution
- Dependency resolution
- Retries
- Idempotency
- State persistence

Reject:
- Code-first orchestration
- Implicit control flow

---

### 3.4 Determinism & Safety → ONNX + JSON Schema + OPA

Borrow:
- Typed inputs / outputs (ONNX style)
- Output validation (JSON Schema)
- Policy enforcement (OPA / policy-as-code)

This is how **probabilistic LLMs are made deterministic**:
- constrained decoding
- schema enforcement
- rejection instead of interpretation

---

## 4. Canonical Architecture (Allternit-Aligned)

```
┌────────────────────────────┐
│ Markdown Spec (CommonMark) │  ← human intent
└────────────┬───────────────┘
             ↓
┌────────────────────────────┐
│ Semantic Compiler          │  ← Spec-MD pattern
│ (MD → FlowIR)              │
└────────────┬───────────────┘
             ↓
┌────────────────────────────┐
│ FlowIR (Typed DAG IR)      │  ← ONNX/OpenAPI model
│ - nodes                    │
│ - edges                    │
│ - schemas                  │
│ - policies                 │
└────────────┬───────────────┘
             ↓
┌────────────────────────────┐
│ Execution Kernel           │  ← Temporal-class
│ - scheduling               │
│ - retries                  │
│ - state                    │
│ - tool gating              │
└────────────────────────────┘
```

LLMs operate **inside nodes**, never as controllers.

---

## 5. Mapping to Allternit Layers

### Layer A — Spec Layer (Human / UI)

Artifacts:
- `*.mdflow.md`
- YAML frontmatter
- Structured annotations

Role:
- Authoring
- Review
- Version control
- Unified UI entry point

---

### Layer B — Compile Layer (Truth)

Artifacts:
- `flowir.json`
- Policy overlays
- Static validation reports

Role:
- Deterministic translation
- DAG construction
- Constraint resolution
- Fail fast at build time

---

### Layer C — Execution Kernel (Reality)

Artifacts:
- Run records
- Traces
- Cached artifacts
- Audit logs

Role:
- Deterministic orchestration
- Budget enforcement
- Tool isolation
- Replayability

---

### Layer D — Dynamic UI / Mini Apps

Artifacts:
- DAG visualizations
- Progressive disclosure views
- Approval gates
- Artifact viewers

Role:
- Make execution legible
- Debug without reading logs
- Human-in-the-loop control

---

## 6. Comparison With Existing Agent Frameworks

### LangChain / LlamaIndex
- Code-first
- Often LLM-driven orchestration
- Determinism varies; typically weak unless aggressively constrained

**Allternit difference**  
LLMs are tools, not planners. The spec controls the run.

---

### CrewAI / AutoGen
- Conversational coordination
- Emergent behavior
- Low-to-medium reproducibility

**Allternit difference**  
Multi-agent becomes a bounded node executor, not the control plane.

---

### Temporal / Airflow
- Strong determinism
- Mature scheduling/state/retries/observability
- Not AI-native by default

**Allternit difference**  
Adds schema-constrained LLM transforms and tool permissioning as first-class execution nodes.

---

## 7. Why This Can Become a Standard

This design:
- Reuses existing standards (CommonMark, JSON Schema, policy-as-code patterns)
- Separates spec from runtime (enables multiple engines)
- Is enterprise-governable (auditability, budgets, permissions)
- Is LLM-native but not LLM-controlled (determinism contract)

This is the **OpenAPI-style approach** applied to agent execution.

---

## 8. Key Thesis (Canonical)

> Markdown is the human-readable **execution specification**,  
> FlowIR is the **canonical truth**,  
> the engine enforces reality,  
> and LLMs are constrained functions—not decision makers.

---

## 9. Status

- Research complete: CommonMark is the primary Markdown standard; no workflow-execution Markdown IR standard exists today.
- Architecture aligns with Allternit Unified UI goals.
- Safe to proceed with **FlowIR v0.1** formalization.

---
