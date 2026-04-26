Loaded and acknowledged. This is the final upload, so we now integrate it under PROJECT_LAW and lock it cleanly.

I’m ingesting allternit_robotics_integration_plan.md as MD-017 and treating it correctly as Plan-Mode / Exploratory, not a commitment spec.  ￼

⸻

MD-017 — Robotics Integration (Plan Mode)

Classification
    •    Type: Exploratory integration plan (non-binding)
    •    Authority: Subordinate to PROJECT_LAW.md
    •    Stability: PLAN MODE (explicitly non-locking)
    •    Scope: Robotics ecosystem unification
    •    Risk Level: Low (no execution authority granted)

This MD does not change architecture.
It maps external capability surfaces into the existing Allternit model.

⸻

What This MD Is (and Is Not)

IS
    •    A capability landscape map
    •    A future integration index
    •    A taxonomy alignment exercise
    •    A capsule identification document

IS NOT
    •    A robotics OS
    •    A runtime controller
    •    A commitment to vendors
    •    A replacement for ROS / OEM stacks

This distinction is critical and correctly stated in the MD.

⸻

Primary Architectural Role

MD-017 lives at the same abstraction level as MD-014 (Intent Graph) and MD-016 (Context/IR) — it explains how a domain plugs in, not how the core works.

Its role is to answer:

“If we ever integrate robotics, where does each piece belong without corrupting the system?”

⸻

Canonical Layer Mapping (Validated)

Your 8-layer robotics breakdown maps perfectly onto Allternit without requiring any new layers:

Robotics Layer    Allternit Mapping
Perception    L6 Providers → Artifact ingestion
Hardware / Morphology    Artifact Registry (hardware schema)
Skill Abstraction    L4 Skills (SkillArtifact)
Planning & Simulation    External planners → imported artifacts
Execution & Control    NOT core (delegated / federated)
Skill Discovery    L6 Providers (meta-learning sources)
Dynamic UI    L8 Embodiment (capsules, not apps)
Artifact Registry    L5 Context (authoritative store)

No layer violations. No OS creep.

⸻

Platform-by-Platform Integration Status

Tnkr.ai
    •    Role: Robotics Studio Capsule
    •    Integration Type: UI + Artifact ingestion
    •    Authority: None (read/import only)
    •    Lock-in risk: Low

Correctly treated as:

a project discovery surface, not a system of record

⸻

Augmentus
    •    Role: Specialized planning & simulation engine
    •    Integration Type: Artifact import
    •    Authority: None over execution
    •    Runtime coupling: Explicitly avoided

Correct: Augmentus produces plans, not truth.

⸻

Skild AI
    •    Role: Skill discovery & generalization source
    •    Integration Type: Pattern / Skill candidate generator
    •    Promotion path: Must go through PatternSpec + eval (MD-013)

Correctly positioned as:

a learning source, never a runtime brain

⸻

Synthiam
    •    Role: Human-friendly skill store + composer
    •    Integration Type: SkillArtifact ingestion
    •    Authority: None

Important insight preserved:

Synthiam ≠ intelligence
Synthiam = accessibility layer

⸻

Artifact Schema Section (Strong, Keep)

The shared schemas section is exactly right for Plan Mode.

These should not be finalized yet, but they correctly indicate:
    •    Robotics integrates via artifacts
    •    Not via live control loops
    •    Not via opaque SDKs

This is fully compliant with PROJECT_LAW.

⸻

Governance Alignment Check (Passed)

MD-017 obeys all Tier-0 constraints:
    •    ✔ No silent execution
    •    ✔ No runtime authority
    •    ✔ No vendor lock-in
    •    ✔ No new layers
    •    ✔ No speculative commitments

This is how exploratory MDs should look.

⸻

PATCH-017 — Robotics Domain Mapping (Plan Mode)

PATCH-017 — Robotics Integration Mapping (Exploratory)

Source:
- allternit_robotics_integration_plan.md

Defines:
- Robotics as a federated domain
- External platforms as capability providers
- Artifact-based integration only
- Capsule-based UI exposure
- No runtime or execution authority

Governed By:
- PROJECT_LAW.md
- SOT.md
- MD-013 (Pattern promotion rules)
- MD-016 (Context & IR spine)

Locks:
- Nothing

Enables:
- Future robotics integration without architectural drift


⸻

Final Status
    •    MD-017 accepted
    •    Correctly scoped
    •    Properly governed
    •    No drift introduced


