Loaded Allternit_AgenticOS_Framework_Runtime_Harness_Integration.md and ingesting it as MD-009. This is a high-quality additive that formalizes how agents are built, run, and shipped without introducing new execution paths or UI primitives. It fits cleanly under the locked SOT + Acceptance Tests.  ￼

⸻

MD-009 — Classification

Type: Architectural integration spec (build/run/ship separation)
Role: Introduces a three-plane model—Framework, Runtime, Harness—and three experience tiers that project the same system without fragmenting it
Stability: Additive (constrained by invariants)

This MD does not alter:
    •    Journal truth model
    •    Tool governance
    •    Capsule/Canvas semantics

It does add clarity to agent construction vs execution vs productization.

⸻

Layer Mapping (Normalized)

Plane    Maps To    Why
Framework (Build Plane)    L4 Skills (+ L3 Orchestration)    AgentSpec, graphs, prompts, tool contracts
Runtime (Run Plane)    L1 Runtime (+ L2 Governance)    RunState, scheduling, sandboxing, policy
Harness (Experience Plane)    L0 Interfaces + L8 Embodiment    UI schema, packaging, tiered exposure

Key normalization: these are architectural layers, not modes—exactly aligned with the SOT’s “no bypass” rule.

⸻

Artifact Normalization (No New Primitives)

We normalize the MD’s artifacts to existing contracts:
    •    AgentSpec → FrameworkSpec (L4): graphs, prompt modules, tool schemas
    •    RunProfile / RunState → Runtime contracts (L1): execution guarantees, budgets
    •    HarnessSpec → Experience bundle (L0/L8): UI schema + policies + pinned profiles

Packaging (.a2x) becomes a transport format, not a new execution surface. It references:
    •    FrameworkSpec
    •    HarnessSpec
    •    RunProfiles
    •    Tool contracts
    •    (Optional) EvalSpec

⸻

Three Experience Tiers → Presentation Kernel Adaptation

The tiers are exposure policies, not modes:
    •    Builder: full graph/spec access, traces, replay
    •    Studio: guided composition, sliders, safe defaults
    •    Instant: intent → harness, minimal toggles

Implementation: Presentation Kernel selects which knobs are visible based on tier; execution remains identical.

⸻

Run Profiles → ToolScope & Budgets

Run Profiles map directly to Tool Registry + Capsule ToolScope:
    •    Instant: strict scopes, bounded cost/time
    •    Studio: expanded but gated
    •    Builder: widest scope + debug

No policy bypass; approvals and journaling still apply.

⸻

Evaluation Harness → Acceptance Gate (Aligned)

EvalSpec integrates with Acceptance Tests as promotion gates:
    •    regression
    •    safety assertions
    •    cost/time budgets

Promotion lifecycle (Draft → Candidate → Released → Deprecated) is a Harness lifecycle, not a new runtime.

⸻

PATCH-009 — Framework / Runtime / Harness Integration

PATCH-009 — Build/Run/Ship Separation & Tiered Exposure

Source:
- Allternit_AgenticOS_Framework_Runtime_Harness_Integration.md

Adds:
- Three-plane model: Framework (build), Runtime (run), Harness (experience)
- Canonical artifacts: AgentSpec, RunProfile/RunState, HarnessSpec
- Tiered exposure (Builder/Studio/Instant) as Presentation Kernel policy
- Promotion lifecycle with Eval gating
- Portable packaging format (.a2x) as transport

Touches SOT Sections:
- §1 Layer Model (clarified mapping)
- §3 Execution Model (RunProfiles)
- §4 UI & Interaction Model (tiered exposure)
- §9 Change Control (promotion lifecycle)

No changes to:
- Journal invariants
- Tool Registry enforcement
- Capsule/Canvas taxonomy


⸻

Compatibility Check
    •    ✅ No new UI primitives
    •    ✅ No new truth stores
    •    ✅ No execution bypass
    •    ✅ Aligns with Capsule frameworks and Kernel mediation
    •    ✅ Strengthens governance and promotion discipline

⸻

What This Enables (Immediately)
    •    Clean agent authoring without runtime coupling
    •    Safe productization of agents via HarnessSpec
    •    A single system that scales from power users to instant intent

⸻

