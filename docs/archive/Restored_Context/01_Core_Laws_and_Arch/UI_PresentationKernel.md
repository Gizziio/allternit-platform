Proceeding. Below is the next canonical artifact, generated as a hard-default spec, derived directly from MD-001 and aligned with the Capsule correction.

This is not a summary. This is an implementable contract.

⸻


# Presentation Kernel
## Intent → Canvases → Capsules → Embodied Interaction

Status: HARD DEFAULT  
Layer Binding: L0 Interfaces, L3 Orchestration, L5 Context, L8 Embodiment

---

## 0. Purpose

The Presentation Kernel is the **adaptive UI brain** of Allternit.

It is responsible for translating:
- low-context human input
- agent state
- journal truth
- runtime constraints  

into:
- concrete canvases
- capsule instantiations
- interaction semantics
- embodied UI behavior  

**The Presentation Kernel does not execute tools.**  
**It does not own state.**  
It *projects truth* into operable, situational interfaces.

---

## 1. Core Responsibility Boundary

### The Presentation Kernel MUST:
- parse and tokenize intent
- select appropriate canvases
- decide capsule spawning via frameworks
- define interaction semantics (risk, weight, motion)
- remain renderer-agnostic

### The Presentation Kernel MUST NOT:
- mutate repo state
- execute tools directly
- invent data not present in the Journal
- bypass ToolScope or SandboxPolicy

---

## 2. Inputs (Authoritative)

The kernel consumes **only canonical inputs**.

### 2.1 Human Input
- text
- voice transcription
- UI interaction (drag/drop, click, tab switch)

### 2.2 Journal Context
- run_id / session_id
- events (tool_call, tool_result, test_fail, artifact_created)
- artifacts (diffs, reports, screenshots)
- provenance links

### 2.3 Agent State
- active agent(s)
- current plan step
- confidence signals
- pending actions

### 2.4 Environment Constraints
- renderer (CLI / TUI / Web / Orb)
- device limits
- accessibility preferences
- persona mode (assistant vs alive)

---

## 3. Intent Tokenization (Foundational Primitive)

All human input is converted into **structured tokens**.

### 3.1 Token Types

```json
{
  "intent_tokens": [
    { "type": "verb", "value": "review|generate|fix|plan|compare" },
    { "type": "entity", "value": "repo|file|diff|test|agent|capsule" },
    { "type": "constraint", "value": "must|only|avoid|before|after" },
    { "type": "scope", "value": "read|write|exec" },
    { "type": "confidence", "value": 0.0 }
  ]
}

3.2 Token Invariants
    •    Tokens MUST be explicit and inspectable.
    •    Tokens MUST drive layout and interaction.
    •    Tokens MAY be manipulated visually (drag, snap, reorder).

⸻

4. Situation Resolution

The kernel resolves a Situation, not a “screen”.

4.1 Situation Definition

A Situation is the intersection of:
    •    intent tokens
    •    journal state
    •    active capsule(s)
    •    agent plan phase
    •    renderer constraints

4.2 Situation Output

A Situation produces:
    •    CanvasSpec[]
    •    optional CapsuleSpawnRequest[]
    •    InteractionSpec
    •    recommended next actions

⸻

5. Canvas Selection Rules

5.1 Canvas Selection Table (non-exhaustive)

Situation Pattern    Primary Canvas    Secondary
code review    diff_review    test_lens
failing tests    test_lens    diff_review
planning    timeline    decision_log
discovery    search_lens    capsule_gallery
execution    run_view    artifact_list

5.2 Canvas Rules
    •    Canvases MUST bind to journal artifacts/events.
    •    Canvases MUST declare risk class.
    •    Canvases MAY request sub-capsules (never tools directly).

⸻

6. Capsule Mediation

The Presentation Kernel is the only component allowed to request capsule spawning.

6.1 Capsule Spawn Flow
    1.    Situation resolved
    2.    Kernel matches intent → Capsule Framework
    3.    Kernel emits capsule.spawn request
    4.    Runtime validates framework + ToolScope
    5.    Capsule instantiated and tabbed

6.2 Capsule Boundaries
    •    Capsules encapsulate task surfaces
    •    Capsules never overlap tool scopes
    •    Capsules are switched, not merged

⸻

7. InteractionSpec (Embodied Semantics)

The kernel defines meaning, not animation.

7.1 InteractionSpec Schema

{
  "motion": {
    "importance_weight": "light|normal|heavy",
    "resistance": "low|medium|high",
    "continuity": "snap|glide|inertial"
  },
  "color_semantics": {
    "risk": "cool|warm|hot",
    "confidence": "clear|fogged",
    "authority": "neutral|emphasized"
  },
  "spatial_rules": {
    "persistent_objects": true,
    "snap_zones": ["approve", "reject", "spawn_capsule"],
    "collision": true
  }
}

7.2 Embodiment Rules
    •    Motion MUST encode semantics.
    •    Resistance MUST encode cost or risk.
    •    Persistence MUST preserve cognition across context shifts.

⸻

8. Renderer Adapters (Contract)

Renderers implement, but do not reinterpret, kernel intent.

8.1 Required Renderer Capabilities
    •    render canvases
    •    manage capsule tabs
    •    display provenance
    •    enforce ToolScope boundaries
    •    reflect InteractionSpec faithfully

8.2 Renderer Examples
    •    CLI/TUI: pane splits, focus shifts, keyboard-driven snaps
    •    Web: drag/drop, physics, touch gestures
    •    Orb/Avatar: gaze, motion, placement cues

⸻

9. Governance & Safety Hooks

9.1 Risk Escalation

If any canvas or capsule implies:
    •    write scope
    •    exec scope

The kernel MUST:
    •    surface explicit risk cues
    •    require confirmation policy
    •    block silent execution

9.2 Provenance Visibility

Every view MUST be able to trace:
    •    originating run
    •    agent
    •    tools used
    •    artifacts produced

⸻

10. Acceptance Tests (Minimum)
    •    AT-PK-001: Same input + same journal state produces identical CanvasSpec.
    •    AT-PK-002: Kernel cannot spawn capsules without registered framework.
    •    AT-PK-003: Renderer cannot widen InteractionSpec or ToolScope.
    •    AT-PK-004: Low confidence situations visually fogged.
    •    AT-PK-005: Risk escalation always visible before execution.

⸻

11. Integration Notes (Repo Mapping)

Target locations:
    •    /spec/presentation/PresentationKernel.md (this file)
    •    /spec/presentation/CanvasProtocol.md
    •    /spec/presentation/CapsuleProtocol.md
    •    /packages/ui-kit (renderer implementations)
    •    /services/router-agent (situation context feed)
    •    /services/history (journal binding)

⸻

12. Final Invariant

The Presentation Kernel is where meaning is decided,
not where work is done.

Execution remains deterministic.
UI remains adaptive.
Truth remains singular.

---

### What just happened (ledger clarity)

- **CapsuleProtocol.md** → defines *what capsules are*
- **PresentationKernel.md** → defines *how situations become operable UI*
- No duplication
- No UGC confusion
- No renderer leakage


