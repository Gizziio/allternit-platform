# /spec/Kernel_FullSpec.md
# Allternit Kernel — Final Irreducible System Specification

Status: Canonical  
Scope: Minimal system required to enforce law, execute skills, and control embodiment

---

## Definition

The **Allternit Kernel** is the smallest possible agentic operating system that:

1. Enforces governance and security invariants
2. Executes workflows deterministically
3. Runs skills through a policy-gated tool path
4. Captures complete history (UOCS)
5. Routes context safely
6. Abstracts intelligence providers
7. Controls physical embodiment safely

Everything else is a **platform module**.

---

## Kernel-Composed Subsystems (Mandatory)

The Kernel is composed of the following full specifications:

1. Security & Governance  
   → `Allternit_Security_Governance_FullSpec.md`

2. Messaging Layer (Task Queue + Event Bus)  
   → `Allternit_Messaging_FullSpec.md`

3. Workflow Engine (Scientific Loop)  
   → `Allternit_Workflows_FullSpec.md`

4. Context Routing + Memory Fabric  
   → `Allternit_ContextRouting_MemoryFabric_FullSpec.md`

5. Skills System (Packages, Tools, RL Hooks)  
   → `Allternit_SkillsSystem_FullSpec.md`

6. Providers + Persona Kernel  
   → `Allternit_Providers_PersonaKernel_FullSpec.md`

7. Hooks System (Middleware Enforcement)  
   → `Allternit_HooksSystem_FullSpec.md`

8. Embodiment / Robotics Control Plane  
   → `Allternit_Embodiment_RoboticsControlPlane_FullSpec.md`

---

## Kernel Guarantees

If and only if all subsystems above are present and compliant, the Kernel guarantees:

- No side effects without policy
- No learning without audit
- No physical action without simulation
- No memory mutation without gating
- No provider authority
- No silent failure
- Deterministic replay of execution

---

## Platform Boundary

The following are **outside the Kernel**:
- UI/UX shells
- Marketplaces
- External SaaS integrations
- Billing/licensing
- Cloud orchestration layers
- Ecosystem federation

They depend on the Kernel but do not define it.

---

## Acceptance Test (Kernel Completeness)

A runtime qualifies as an Allternit Kernel if it can:

1. Execute a workflow offline
2. Run a signed skill
3. Enforce policy denial
4. Record a full ledger
5. Replay execution deterministically
6. Safely actuate (or simulate) a device
7. Roll back any change

---

End of Kernel Specification
