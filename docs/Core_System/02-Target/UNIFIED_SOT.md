# SOT
## Allternit — Source of Truth

**Status:** TIER-1 CANONICAL  
**Governed by:** `PROJECT_LAW.md` (Tier-0)

---

## 0. Meta

- System: Allternit / Gizzi OS (native)
- Truth model: Journal-first, append-only, replayable
- Execution model: Tool-governed, permissioned, auditable
- UI model: Declarative Canvases + Capsule instances (agent-generated)
- Change model: Append-only PATCH ledger; breaking changes allowed with ADR

Last integrated patch: PATCH-017

---

## 1. Layer Model (Frozen)

- L0 Interfaces — CLI/TUI/Web/Mobile/UTI
- L1 Runtime — bounded execution, sandboxing
- L2 Governance — policy, approvals, audit
- L3 Orchestration — routing, multi-agent DAGs, intent graph ops
- L4 Skills — frameworks, patterns, directive compiler
- L5 Context — journal, indexes, intent graph, artifacts
- L6 Providers — tools, external platforms, manifests
- L7 History — persistence + replay
- L8 Embodiment — dynamic UI semantics, motion/continuity

No layer may bypass another.

---

## 2. Non-Negotiables

- Journal is the only authoritative record: if not journaled, it did not happen.
- All execution flows through registered tools; renderers never invoke tools.
- Capsules are agent-generated runtime instances spawned via frameworks.
- Canvases are declarative projections over journaled events/artifacts.
- Prompts are compiled directives; raw text is never executed.

---

## 3. Core Primitives

### 3.1 Journal
Append-only event + artifact ledger with causal parents, replay, provenance.

### 3.2 Tool Registry
ToolSpecs declare schemas, scope (read/write/exec), risk; enforced ToolScope per capsule; approval gates for write/exec.
- All execution occurs through registered tools
- Tools are permissioned and audited
- Agents do not execute directly
- Renderers never execute


### 3.3 Capsules
Sandboxed, tab-like instances; represent a scoped activity surface (search, browser session, mini-app data surface, replay, etc.).
- Agent-generated only
- Spawned via frameworks
- Tab-like instances
- Sandboxed
- Bound to provenance

Capsules are runtime surfaces, not products.

### 3.4 Canvas Protocol + View Taxonomy
All UI surfaces are compositions of canonical view types (object/diff/timeline/table/graph/workflow/search/provenance/etc.).
- Declarative task surfaces
- Renderer-agnostic
- Bound to Journal artifacts/events
- Governed by canonical view taxonomy

No ad-hoc UI primitives.
- UI is a projection of truth
- Meaning precedes motion
- Canvases are declarative
- Capsules scope work
- Renderers adapt, never invent


### 3.5 Presentation Kernel
Situation resolver: tokenizes intent, selects canvases/capsules, produces InteractionSpec; adapts to renderer capabilities.
- Resolves situations, not screens
- Mediates capsule spawning
- Defines interaction semantics

### 3.6 Gizzi OS Runtime
Governed, pattern-adaptive, role-based multi-agent orchestration with deterministic loops and verification gates.

### 3.7 Directive Compiler
Compiles intent + constraints into typed directives; schema-validates outputs; budgets context; emits explainable artifacts.

### 3.8 Intent Graph
Journal-indexed semantic graph of provisional→committed intent; UI is projection, not storage.

### 3.9 Context–IR Spine (MD-016)
Everything-is-a-file context substrate; Markdown is human spec; FlowIR is executable truth.

---

## 4. Patch Ledger (Integrated)

- PATCH-004: Canonical Canvas view taxonomy
- PATCH-005: Journal contract
- PATCH-006: Tool Registry contract
- PATCH-007: Renderer interaction + transition semantics
- PATCH-008: Discovery-first entry modes + capsule evolution grammar
- PATCH-009: Framework / Runtime / Harness separation + tiered exposure
- PATCH-010: Mini-App Data System primitive (Ragic-class ops surface)
- PATCH-011: UTI ingress + manifests + receipts + consent gates
- PATCH-012R: Gizzi OS native runtime + coordination (replaces ElizaOS framing)
- PATCH-013: Pattern-adaptive intelligence (dual-track: delivery vs learning)
- PATCH-014: Linear core pattern → Intent Graph canonicalization
- PATCH-015: Prompt/Context unified integration → Directive Compiler law
- PATCH-016: Context + Markdown IR + Integration spine
- PATCH-017: Robotics domain mapping (PLAN MODE; locks nothing)
