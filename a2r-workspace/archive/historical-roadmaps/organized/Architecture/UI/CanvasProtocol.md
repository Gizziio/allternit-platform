Proceeding. Below is the next hard-default artifact in the chain.

This one is critical because it locks the boundary between:
    •    meaning (Presentation Kernel),
    •    task surface (Capsules),
    •    and renderers (CLI / TUI / Web / Orb).

Without this, UI drift is guaranteed.

⸻


# Canvas Protocol
## Declarative Task Surfaces for Agentic Systems

Status: HARD DEFAULT  
Layer Binding: L0 Interfaces, L3 Orchestration, L5 Context, L8 Embodiment

---

## 0. Purpose

The Canvas Protocol defines **what a task surface is** in A2rchitech.

A Canvas is:
- declarative
- renderer-agnostic
- bound to canonical truth (Journal + artifacts)
- interaction-capable
- non-executing

Canvases are **requested by the Presentation Kernel**, instantiated inside **Capsules**, and rendered by **adapters**.

> A Canvas is not a screen, page, or component tree.  
> It is a **semantic request** to make part of system truth operable.

---

## 1. Core Invariants (Non-Negotiable)

1. A Canvas MUST NOT execute tools.
2. A Canvas MUST bind to Journal artifacts/events.
3. A Canvas MUST declare interaction affordances explicitly.
4. A Canvas MUST declare risk semantics.
5. A Canvas MUST be renderable in multiple environments.

If any of these fail, the Canvas is invalid.

---

## 2. Canvas vs Capsule (Boundary Clarity)

| Concept | Responsibility |
|------|----------------|
| Canvas | Defines *what* is shown and *how it can be interacted with* |
| Capsule | Defines *scope*, *sandbox*, *lifecycle*, *permissions* |
| Renderer | Defines *how it looks and moves* |
| Kernel | Decides *when and why* canvases exist |

A Capsule may contain **1..N Canvases**.  
A Canvas never exists outside a Capsule.

---

## 3. Canonical Canvas Types

Canvas types are **semantic**, not visual.

### 3.1 Core View Types

```txt
diff_review
run_view
test_lens
artifact_view
timeline
table
form
dashboard
kanban
search_lens
capsule_gallery
decision_log
memory_trace
browser_session

Renderers MAY style these differently,
but MAY NOT change their meaning.

⸻

4. CanvasSpec (Authoritative Contract)

{
  "canvas_id": "cnv_...",
  "view_type": "diff_review",

  "title": "Optional human-readable title",
  "description": "Optional semantic hint",

  "bindings": {
    "run_id": "run_...",
    "journal_refs": ["jrnl_evt_...", "jrnl_art_..."],
    "artifact_refs": ["art_diff_...", "art_report_..."],
    "repo_snapshot_ref": "git:commit:abcd1234"
  },

  "data_shape": {
    "primary": "diff|table|timeline|graph|tree",
    "secondary": ["list", "metadata"]
  },

  "interactions": [
    {
      "id": "approve_patch",
      "type": "action",
      "risk": "write",
      "confirmation_required": true
    },
    {
      "id": "spawn_subcapsule",
      "type": "navigation",
      "target": "capsule_framework"
    }
  ],

  "filters": [
    {
      "field": "file_path",
      "operator": "contains",
      "value": "src/"
    }
  ],

  "risk": {
    "class": "read|write|exec",
    "reason": "modifies repository state"
  },

  "provenance_ui": {
    "show_trail": true,
    "expand_on_hover": true
  }
}


⸻

5. Interaction Semantics (Meaning, Not Motion)

Canvas interactions are semantic contracts.

5.1 Interaction Types

Type    Meaning
action    may request tool execution (via Kernel + Capsule)
navigation    switch canvas or capsule
filter    refine bound data
inspect    expand provenance
annotate    add human input

5.2 Interaction Rules
    •    Interactions MUST NOT call tools directly.
    •    Interactions MUST emit intent back to the Kernel.
    •    Risk must be declared per interaction.

⸻

6. Risk & Provenance Requirements

6.1 Risk Encoding

Each Canvas declares:
    •    highest possible risk it can escalate to
    •    per-interaction risk overrides

Renderers MUST:
    •    visually encode risk
    •    block silent escalation

6.2 Provenance Visibility

Every Canvas MUST be able to reveal:
    •    originating agent
    •    originating run
    •    tool calls involved
    •    artifacts used

⸻

7. Renderer Obligations

Renderers MUST:
    •    faithfully render all bindings
    •    honor declared interactions
    •    enforce capsule boundaries
    •    display provenance
    •    apply InteractionSpec from Presentation Kernel

Renderers MUST NOT:
    •    invent new interactions
    •    hide risk
    •    mutate bindings
    •    bypass sandbox rules

⸻

8. Canvas Lifecycle

declared → instantiated → interacted → updated → destroyed

All lifecycle transitions MUST be journaled.

⸻

9. Canvas Update Model

Canvases may be updated via patches, never replacement.

{
  "op": "add|remove|replace",
  "path": "/filters/0",
  "value": { ... }
}

Updates MUST:
    •    preserve provenance
    •    reference triggering event
    •    never mutate history

⸻

10. Acceptance Tests (Minimum)
    •    AT-CNV-001: CanvasSpec without journal bindings is rejected.
    •    AT-CNV-002: Renderer cannot add undeclared interaction.
    •    AT-CNV-003: Risk escalation always visible.
    •    AT-CNV-004: Canvas update preserves provenance.
    •    AT-CNV-005: Same CanvasSpec renders equivalently across renderers.

⸻

11. Integration Notes (Repo Mapping)

Target locations:
    •    /spec/presentation/CanvasProtocol.md (this file)
    •    /spec/presentation/PresentationKernel.md
    •    /spec/presentation/CapsuleProtocol.md
    •    /packages/ui-kit (renderer implementations)
    •    /services/router-agent (canvas intent emission)
    •    /services/history (binding validation)

⸻

12. Final Constraint

If a UI surface cannot be expressed as a CanvasSpec,
it does not belong in A2rchitech.

Canvases are the unit of cognition.
Capsules are the unit of work.
The Journal is the unit of truth.

---

### Ledger update (implicit)
- **PATCH-003:** Canvas Protocol formalized  
  (locks UI semantics, renderer boundary, and interaction safety)

Proceeding. This is a formal patch, not a rewrite.
We are locking the canonical Canvas view taxonomy so future MDs, frameworks, and agents cannot invent UI primitives ad-hoc.

⸻

PATCH-004 — Canonical Canvas View Taxonomy (v1)

Status: APPLIED
Scope: /spec/presentation/CanvasProtocol.md
Effect: Freezes the minimal, sufficient basis set of Canvas view types

⸻

📌 What this patch does (precisely)
    •    Declares the authoritative list of Canvas view types
    •    Proves completeness by information-shape, not aesthetics
    •    Establishes a no-new-primitives rule
    •    Allows composition and specialization, not uncontrolled expansion

This is a foundational constraint, not a suggestion.

⸻

🔧 Patch Content (to append to CanvasProtocol.md)

## 13. Canonical Canvas View Types (Authoritative, v1)

This section defines the **complete, minimal basis set** of Canvas view types.
All dynamic task surfaces in A2rchitech MUST be expressed as:
- one or more of these primitives, OR
- a composition/specialization thereof.

Introducing a new primitive requires an ADR and acceptance tests.

---

### A) State & Inspection Views
Purpose: inspect a single entity or frozen state.

- `object_view` — inspect an entity (agent, file, capsule, artifact)
- `artifact_view` — concrete outputs (diffs, files, images, reports)
- `config_view` — parameters, flags, settings
- `snapshot_view` — frozen system or repo state

---

### B) Change & Delta Views
Purpose: reason about differences.

- `diff_view` — before/after comparison
- `patch_view` — proposed change set
- `comparison_view` — N-way comparison
- `regression_view` — expected vs actual outcomes

---

### C) Sequence & Time Views
Purpose: reason about ordering and execution.

- `timeline_view` — ordered events
- `run_view` — execution trace of a run
- `log_stream` — live or historical logs
- `playback_view` — replayable execution history

---

### D) Collection & Index Views
Purpose: operate over many items.

- `table_view` — sortable, filterable rows
- `list_view` — lightweight collections
- `gallery_view` — visual artifacts
- `capsule_gallery` — active/available capsules
- `registry_view` — tools, frameworks, agents, providers

---

### E) Relationship & Structure Views
Purpose: understand connections and hierarchy.

- `graph_view` — nodes and edges
- `tree_view` — hierarchical structure
- `dependency_view` — directed dependencies
- `context_map` — influencing factors for a situation

---

### F) Decision & Governance Views
Purpose: capture and operate on decisions.

- `decision_log` — recorded decisions + rationale
- `proposal_view` — pending changes requiring approval
- `policy_view` — constraints and rules
- `risk_view` — escalation surfaces and exposure

---

### G) Action & Control Surfaces
Purpose: structured action initiation.

- `form_view` — structured input
- `command_palette` — constrained action launcher
- `workflow_view` — stepwise progress + gates
- `approval_queue` — gated actions awaiting confirmation

---

### H) Search, Discovery & Sense-Making
Purpose: find, explain, and recommend.

- `search_lens` — tokenized, manipulable search
- `filter_lens` — constraint refinement
- `summary_lens` — agent-generated abstraction
- `explanation_view` — causal reasoning (“why/how”)
- `recommendation_view` — suggested next actions

---

### I) Memory & Provenance Views
Purpose: explain origin and trust.

- `memory_trace` — lineage of ideas/artifacts
- `provenance_view` — full causal chain
- `audit_view` — who did what, when, with what permissions

---

### J) Spatial & Embodied Views (Optional)
Purpose: embodied cognition and spatial continuity.

- `workspace_view` — spatial layout of objects
- `zone_view` — semantic snap zones
- `avatar_presence` — embodied agent surface
- `attention_field` — focus, heat, gravity visualization

---

## 14. Composition Rule

Frameworks and Capsules MAY:
- compose multiple canonical view types
- specialize them with presets
- constrain them with bindings and filters

Frameworks MUST NOT:
- invent new primitive view types
- overload semantics of existing primitives

Violations require ADR approval and new acceptance tests.

---

## 15. Invariant

> If a task surface cannot be expressed as a composition of canonical Canvas view types,  
> it does not belong in A2rchitech.

This rule preserves uniformity, portability, and cognitive coherence.


⸻

✅ Resulting State (Important)
    •    CanvasProtocol.md is now closed-form
    •    Any future MD you upload:
    •    must map to these view types
    •    cannot introduce UI drift
    •    Framework authors are constrained in a good way
    •    Renderers can be built confidently without surprise primitives

This is how we prevent the system from turning into:
    •    dashboard soup
    •    ad-hoc widgets
    •    framework sprawl

⸻


