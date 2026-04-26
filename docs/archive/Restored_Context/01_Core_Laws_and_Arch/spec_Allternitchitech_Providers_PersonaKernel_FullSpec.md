# /spec/layers/providers/FullSpec.md
# Allternit Providers + Persona Kernel Specification
## Model Routing, Persona Injection, and Intelligence Abstraction

Status: Canonical  
Layer: L6 Providers + Persona Kernel  
Scope: All foundation models, local models, VLAs, persona behavior

---

## 1. Purpose

The Providers layer treats **models as engines**, not authorities.

Its goals are to:
- abstract intelligence providers behind a stable contract
- route tasks to the correct model based on constraints
- enforce confidentiality, cost, and latency policies
- apply persona consistently regardless of model used

Persona lives **above** models and **below** policy.

---

## 2. Core Principles

1. Models are stateless and replaceable
2. Models never own memory
3. Models never grant permissions
4. Persona is independent of provider
5. Routing decisions are auditable
6. Provider failure must be survivable

---

## 3. Provider Abstraction Model

### 3.1 Provider Types
- Closed LLMs (OpenAI, Anthropic, Google)
- Open-source models (local, self-hosted)
- Vision-Language-Action models (robotics)
- Specialized models (speech, vision, planning)

### 3.2 Provider Adapter Contract
Each adapter must expose:
- capabilities (modalities, context limits)
- latency profile
- cost model
- confidentiality tier
- supported personas (all, via injection)
- failure semantics

Adapters are thin and deterministic.

---

## 4. Model Routing Engine

### 4.1 Routing Inputs
Routing decisions evaluate:
- task type
- workflow phase
- skill requirements
- risk tier
- confidentiality constraints
- cost budget
- latency target
- availability

### 4.2 Routing Outputs
- selected provider(s)
- fallback providers
- execution parameters
- context budget allocation

Routing produces a **routing decision artifact** logged to history.

---

## 5. Persona Kernel

### 5.1 Definition
The Persona Kernel defines:
- tone
- style
- preferences
- defaults
- response formatting

Persona never affects:
- permissions
- memory access
- skill availability
- device actuation

### 5.2 Persona Layers
Personas are composable:
1) Base Persona (e.g. Gizzi)
2) Role Overlay (Planner, Builder, etc.)
3) User Preferences
4) Session Overrides (temporary)

### 5.3 Persona Storage
- versioned
- auditable
- reversible
- stored outside model context

---

## 6. Persona Injection Pipeline

Injection occurs:
1) after context routing
2) before provider invocation
3) without modifying system constraints

Injection methods:
- system prompt templates
- structured style directives
- output format constraints

Persona injection must be provider-agnostic.

---

## 7. Confidentiality & Redaction

Before provider calls:
- context bundles are redacted
- secrets replaced with handles
- sensitive memory excluded

Provider adapters must not log raw context.

---

## 8. Multi-Provider Execution

### 8.1 Parallel Execution
Allowed for:
- synthesis
- verification
- comparison

### 8.2 Ensemble Policies
- best-of-n
- weighted vote
- deterministic rule
- confidence-ranked

Ensemble outputs are artifacts.

---

## 9. Failure Handling

Failure modes:
- provider timeout
- malformed response
- policy violation
- cost overrun

Responses:
- fallback routing
- downgrade capability
- retry with constraints
- fail loudly with artifact

---

## 10. Robotics / VLA Integration

VLA providers:
- must declare action schema
- must respect safety envelopes
- never directly actuate devices
- output intentions, not commands

Intent → policy → skill → device.

---

## 11. Acceptance Criteria

1) persona preserved across providers
2) routing decisions reproducible
3) provider failure survivable
4) models never bypass routing
5) no provider owns memory or authority

---

End of Providers + Persona Kernel Specification
