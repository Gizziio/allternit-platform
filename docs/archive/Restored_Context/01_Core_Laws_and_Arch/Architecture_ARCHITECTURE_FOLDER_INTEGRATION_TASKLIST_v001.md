# Architecture Folder Integration Tasklist (v001)
**Scope:** This folder is **separate from the code repo**. It is a **design + direction corpus** that must be read in full by any coding agent before implementing changes.

## Non-negotiable operating rule
- The coding agent must **read every file listed below** (checkboxes) before starting implementation.
- Any implementation PR must reference which files informed it (e.g., in PR description: `Sources: UI/CapsuleProtocol.md, UNIFIED/RUNTIME/Kernel.md, ...`).

---

## 1) File manifest (everything in this folder)
Total markdown files: **40**

| # | Path | Category | Purpose/First line |
|---:|---|---|---|
| 1 | `ACCEPTANCE/AcceptanceTests.md` | ACCEPTANCE | # AcceptanceTests |
| 2 | `BACKLOG/MD-007.md` | BACKLOG | Good — this is exactly the right next MD to ingest after locking SOT + Acceptance Tests. |
| 3 | `BACKLOG/MD-008.md` | BACKLOG | Loaded Allternit_Dynamic_Discovery_UI.md and treating it as MD-008. This is a strong, compatible extension that deepens Discovery, Capsules, Memory, and Web Use—without violating  |
| 4 | `BACKLOG/MD-009.md` | BACKLOG | Loaded Allternit_AgenticOS_Framework_Runtime_Harness_Integration.md and ingesting it as MD-009. This is a high-quality additive that formalizes how agents are built, run, and ship |
| 5 | `BACKLOG/MD-010.md` | BACKLOG | Loaded Allternit_UnifiedUI_MiniApp_DataSystem_RagicClass.md and ingesting it as MD-010. This is a major, high-leverage addition that cleanly fills a missing primitive: structured  |
| 6 | `BACKLOG/MD-011.md` | BACKLOG | Loaded Allternit_Universal_Text_Interface_UTI_v0.1.md and ingesting it as MD-011. This is a strong, additive expansion that introduces a universal conversational endpoint while st |
| 7 | `BACKLOG/MD-012.md` | BACKLOG | Understood. You’re right to correct this — the name and identity matter, and more importantly the center of gravity matters. |
| 8 | `BACKLOG/MD-013.md` | BACKLOG | MD-013 — Pattern-Adaptive Agent Framework (Ingested) |
| 9 | `BACKLOG/MD-014.md` | BACKLOG | Loaded allternit_linear_core_pattern.md and ingesting it as MD-014. This is a pillar-level conceptual extraction, not a feature proposal, and it fits extremely cleanly into what w |
| 10 | `BACKLOG/MD-015.md` | BACKLOG | Loaded Allternit_Prompt_Context_Unified_UI_Integration.md and ingesting it as MD-015. This is a critical infrastructure MD, not an optional enhancement. It cleanly formalizes wher |
| 11 | `BACKLOG/MD-016.md` | BACKLOG | Good call bundling these three. You were right: they live on the same layer cluster and should not be summarized independently. They form a single coherent subsystem and must be in |
| 12 | `BACKLOG/MD-017.md` | BACKLOG | Loaded and acknowledged. This is the final upload, so we now integrate it under PROJECT_LAW and lock it cleanly. |
| 13 | `BACKLOG/Tool Registry.md` | BACKLOG | Proceeding. The next lock is the Tool Registry—this is the last core pillar required to make the system deterministic, governable, and safe. |
| 14 | `INTEGRATIONS/Glide.md` | INTEGRATIONS | # Glide Apps → allternit Unified Chat UI Integration |
| 15 | `INTEGRATIONS/Linear.md` | INTEGRATIONS | # Linear as a Pattern: Core Architectural Value for allternit |
| 16 | `LAW/BUILDER_ENTRY_INDEX.md` | LAW | # BUILDER_ENTRY_INDEX |
| 17 | `LAW/Guardrails.md` | LAW | # allternit Guardrails & Templates |
| 18 | `LAW/OperatingSystem.md` | LAW | Saved. This framework is now committed to long-term memory as your default project architecture and agentic workflow law. |
| 19 | `LAW/PROJECT_LAW copy.md` | LAW | # PROJECT_LAW |
| 20 | `LAW/Project_Law.md` | LAW | ⸻ |
| 21 | `LAW/RepoLaw.md` | LAW | # APPENDIX A — PROJECT ORGANIZATION LAW |
| 22 | `UI/Architecture_and_Prompt_Suites.md` | UI | # Allternit — Architecture Designs + Prompt Suites |
| 23 | `UI/CanvasProtocol.md` | UI | Proceeding. Below is the next hard-default artifact in the chain. |
| 24 | `UI/CapsuleProtocol.md` | UI | Yes — we will still generate new MDs as we progress. Your uploaded MDs are inputs; the system also needs derived specs (protocols, schemas, contracts, acceptance tests) that don’t  |
| 25 | `UI/Capsules.md` | UI | # Allternit Dynamic Discovery UI |
| 26 | `UI/Journal.md` | UI | Proceeding forward. The next correct move—now that UI semantics and capsules are frozen—is to formalize the single source of truth that everything binds to. |
| 27 | `UI/MiniAppRuntime.md` | UI | # Allternit Unified UI Chat — Mini-App: Data System Primitive (Ragic-Class) |
| 28 | `UI/PresentationKernel.md` | UI | Proceeding. Below is the next canonical artifact, generated as a hard-default spec, derived directly from MD-001 and aligned with the Capsule correction. |
| 29 | `UI/Research_Synthesis_Discovery_UI.md` | UI | # Allternit — Research Synthesis (Discovery-First Web + Memory + Skills) |
| 30 | `UI/UTI.md` | UI | # Allternit \| Universal Text Interface (UTI) |
| 31 | `UI/caspuleshell_kernelcontractsPrompt.md` | UI | ROLE |
| 32 | `UI/presentation/RendererCapabilities.md` | UI | # RendererCapabilities |
| 33 | `UNIFIED/AGENTS/AdaptivePatterns.md` | UNIFIED | # Pattern-Adaptive Agent Framework |
| 34 | `UNIFIED/COMPILER/DirectiveCompiler.md` | UNIFIED | # Allternit Integration Spec |
| 35 | `UNIFIED/CONTEXT/Context.md` | UNIFIED | # Allternit Integration Chat Plan |
| 36 | `UNIFIED/CONTEXT/ContextSystem.md` | UNIFIED | # Unified Context, Memory, Retrieval, and Inference Architecture |
| 37 | `UNIFIED/IR/MarkdownIR.md` | UNIFIED | # Allternit Markdown IR Standard |
| 38 | `UNIFIED/ROBOTICS/Robotics.md` | UNIFIED | # Allternit Robotics Integration – Planning Notes (Unified) |
| 39 | `UNIFIED/RUNTIME/Kernel.md` | UNIFIED | # Allternit Agentic OS — Framework / Runtime / Harness Integration Spec |
| 40 | `UNIFIED/SOT.md` | UNIFIED | # SOT |

---

## 2) Required reading checklist (must complete)
### LAW (6)
- [ ] `LAW/BUILDER_ENTRY_INDEX.md` — # BUILDER_ENTRY_INDEX
- [ ] `LAW/Guardrails.md` — # allternit Guardrails & Templates
- [ ] `LAW/OperatingSystem.md` — Saved. This framework is now committed to long-term memory as your default project architecture and agentic workflow law.
- [ ] `LAW/PROJECT_LAW copy.md` — # PROJECT_LAW
- [ ] `LAW/Project_Law.md` — ⸻
- [ ] `LAW/RepoLaw.md` — # APPENDIX A — PROJECT ORGANIZATION LAW
### UNIFIED (8)
- [ ] `UNIFIED/AGENTS/AdaptivePatterns.md` — # Pattern-Adaptive Agent Framework
- [ ] `UNIFIED/COMPILER/DirectiveCompiler.md` — # Allternit Integration Spec
- [ ] `UNIFIED/CONTEXT/Context.md` — # Allternit Integration Chat Plan
- [ ] `UNIFIED/CONTEXT/ContextSystem.md` — # Unified Context, Memory, Retrieval, and Inference Architecture
- [ ] `UNIFIED/IR/MarkdownIR.md` — # Allternit Markdown IR Standard
- [ ] `UNIFIED/ROBOTICS/Robotics.md` — # Allternit Robotics Integration – Planning Notes (Unified)
- [ ] `UNIFIED/RUNTIME/Kernel.md` — # Allternit Agentic OS — Framework / Runtime / Harness Integration Spec
- [ ] `UNIFIED/SOT.md` — # SOT
### UI (11)
- [ ] `UI/Architecture_and_Prompt_Suites.md` — # Allternit — Architecture Designs + Prompt Suites
- [ ] `UI/CanvasProtocol.md` — Proceeding. Below is the next hard-default artifact in the chain.
- [ ] `UI/CapsuleProtocol.md` — Yes — we will still generate new MDs as we progress. Your uploaded MDs are inputs; the system also needs derived specs (protocols, schemas, contracts, acceptance tests) that don’t 
- [ ] `UI/Capsules.md` — # Allternit Dynamic Discovery UI
- [ ] `UI/Journal.md` — Proceeding forward. The next correct move—now that UI semantics and capsules are frozen—is to formalize the single source of truth that everything binds to.
- [ ] `UI/MiniAppRuntime.md` — # Allternit Unified UI Chat — Mini-App: Data System Primitive (Ragic-Class)
- [ ] `UI/PresentationKernel.md` — Proceeding. Below is the next canonical artifact, generated as a hard-default spec, derived directly from MD-001 and aligned with the Capsule correction.
- [ ] `UI/Research_Synthesis_Discovery_UI.md` — # Allternit — Research Synthesis (Discovery-First Web + Memory + Skills)
- [ ] `UI/UTI.md` — # Allternit | Universal Text Interface (UTI)
- [ ] `UI/caspuleshell_kernelcontractsPrompt.md` — ROLE
- [ ] `UI/presentation/RendererCapabilities.md` — # RendererCapabilities
### INTEGRATIONS (2)
- [ ] `INTEGRATIONS/Glide.md` — # Glide Apps → allternit Unified Chat UI Integration
- [ ] `INTEGRATIONS/Linear.md` — # Linear as a Pattern: Core Architectural Value for allternit
### BACKLOG (12)
- [ ] `BACKLOG/MD-007.md` — Good — this is exactly the right next MD to ingest after locking SOT + Acceptance Tests.
- [ ] `BACKLOG/MD-008.md` — Loaded Allternit_Dynamic_Discovery_UI.md and treating it as MD-008. This is a strong, compatible extension that deepens Discovery, Capsules, Memory, and Web Use—without violating 
- [ ] `BACKLOG/MD-009.md` — Loaded Allternit_AgenticOS_Framework_Runtime_Harness_Integration.md and ingesting it as MD-009. This is a high-quality additive that formalizes how agents are built, run, and ship
- [ ] `BACKLOG/MD-010.md` — Loaded Allternit_UnifiedUI_MiniApp_DataSystem_RagicClass.md and ingesting it as MD-010. This is a major, high-leverage addition that cleanly fills a missing primitive: structured 
- [ ] `BACKLOG/MD-011.md` — Loaded Allternit_Universal_Text_Interface_UTI_v0.1.md and ingesting it as MD-011. This is a strong, additive expansion that introduces a universal conversational endpoint while st
- [ ] `BACKLOG/MD-012.md` — Understood. You’re right to correct this — the name and identity matter, and more importantly the center of gravity matters.
- [ ] `BACKLOG/MD-013.md` — MD-013 — Pattern-Adaptive Agent Framework (Ingested)
- [ ] `BACKLOG/MD-014.md` — Loaded allternit_linear_core_pattern.md and ingesting it as MD-014. This is a pillar-level conceptual extraction, not a feature proposal, and it fits extremely cleanly into what w
- [ ] `BACKLOG/MD-015.md` — Loaded Allternit_Prompt_Context_Unified_UI_Integration.md and ingesting it as MD-015. This is a critical infrastructure MD, not an optional enhancement. It cleanly formalizes wher
- [ ] `BACKLOG/MD-016.md` — Good call bundling these three. You were right: they live on the same layer cluster and should not be summarized independently. They form a single coherent subsystem and must be in
- [ ] `BACKLOG/MD-017.md` — Loaded and acknowledged. This is the final upload, so we now integrate it under PROJECT_LAW and lock it cleanly.
- [ ] `BACKLOG/Tool Registry.md` — Proceeding. The next lock is the Tool Registry—this is the last core pillar required to make the system deterministic, governable, and safe.
### ACCEPTANCE (1)
- [ ] `ACCEPTANCE/AcceptanceTests.md` — # AcceptanceTests

---

## 3) Integration workflow (step-by-step, gap-proof)

### Step 0 — Ingest the corpus (no coding)
1. Verify file count equals the manifest (40 MDs).
2. Create a “Sources Read Log” in the repo PR description or ticket:
   - tick the checklist items
   - list any conflicts discovered between docs (do not resolve silently)

### Step 1 — Establish the build target (P0 entry point)
**Objective:** ship the “entry point” experience: **Capsule Shell + Tab/Canvas metaphor + agent-generated frameworks**.

Deliverable checklist:
- [ ] Shell app can spawn capsules (tabs) and render canvases (canvas mount).
- [ ] Intent dispatch contract exists (even if backend is stubbed).
- [ ] Framework registry contract exists (server-provided frameworks).
- [ ] Journal event model exists (append-only; can be local first).

**Primary source docs to follow:**
- UI/Capsules.md
- UI/CapsuleProtocol.md
- UI/CanvasProtocol.md
- UI/MiniAppRuntime.md
- UNIFIED/RUNTIME/Kernel.md
- UNIFIED/COMPILER/DirectiveCompiler.md
- UNIFIED/AGENTS/AdaptivePatterns.md
- UI/caspuleshell_kernelcontractsPrompt.md
- ACCEPTANCE/AcceptanceTests.md

### Step 2 — Convert docs into an executable backlog (do this before deeper builds)
Create `docs/BACKLOG_EXECUTION.md` in the repo with:
- P0 (entry point)
- P1 (framework compiler + tool gating)
- P2 (context packing + distillation)
- P3 (integrations: Linear, Glide)
- P4 (robotics track)
Each backlog item must include:
- DoD
- components touched (shell/kernel/journal/registry/tools/renderer)
- Sources (file paths in this folder)

### Step 3 — Implement P0 (entry point) in thin vertical slices
Implement as 4 slices. Each slice ends with a running demo.

**Slice P0-A: Capsule Runtime + Tab Bar**
- Tasks
  - [ ] Capsule instance store (open/close/activate)
  - [ ] Tab UI bound to capsule instances
  - [ ] Capsule persistence mode: ephemeral/docked/pinned (UI state only in v0)
- Sources
  - UI/Capsules.md
  - UI/CapsuleProtocol.md
  - UI/Journal.md
  - UNIFIED/SOT.md

**Slice P0-B: Canvas Protocol + Renderer**
- Tasks
  - [ ] Canonical CanvasSpec + ViewSpec types used by renderer
  - [ ] Minimum view types required for launch (timeline, list, object, search_lens)
  - [ ] Render loop: active capsule -> active canvas -> renderer
- Sources
  - UI/CanvasProtocol.md
  - UI/presentation/RendererCapabilities.md
  - UI/PresentationKernel.md

**Slice P0-C: Frameworks (agent-generated “mini-app templates”)**
- Tasks
  - [ ] FrameworkSpec schema (allowed intents + default canvases + tool scope)
  - [ ] Local framework registry (v0) -> swap to server registry (v1)
  - [ ] Framework spawn = creates capsule + canvas + journal events
- Sources
  - UI/MiniAppRuntime.md
  - UNIFIED/COMPILER/DirectiveCompiler.md
  - UNIFIED/AGENTS/AdaptivePatterns.md
  - BACKLOG/Tool Registry.md

**Slice P0-D: Intent Dispatch + Journal Events**
- Tasks
  - [ ] Intent event -> framework select -> tool plan (mock) -> canvas update
  - [ ] Journal events append-only; show in UI
  - [ ] Define Artifact types (ObserveCapsule, DistillateCapsule) even if mocked
- Sources
  - UNIFIED/RUNTIME/Kernel.md
  - UNIFIED/IR/MarkdownIR.md
  - UNIFIED/CONTEXT/ContextSystem.md
  - UI/Journal.md
  - ACCEPTANCE/AcceptanceTests.md

### Step 4 — Implement P1 (after P0 runs end-to-end)
P1 is “make it real” without redesign:
- [ ] Server-backed framework registry
- [ ] Server intent dispatch returning events + artifacts + canvas
- [ ] Journal persistence boundary (service API; storage can be sqlite/postgres)
- [ ] Tool scope gating + action preview for write/exec tools
**Sources:** UNIFIED/RUNTIME/Kernel.md, BACKLOG/Tool Registry.md, LAW/Guardrails.md

### Step 5 — Implement P2 (context + distillation)
- [ ] Context packing (progressive disclosure; bounded context window)
- [ ] Distillation pipeline (events/artifacts -> distillate artifacts)
- [ ] Markdown IR normalization for agent inputs
**Sources:** UNIFIED/CONTEXT/Context.md, UNIFIED/CONTEXT/ContextSystem.md, UNIFIED/IR/MarkdownIR.md

### Step 6 — Integrations (P3)
- [ ] Linear integration primitives (projects/issues graph -> capsules/views)
- [ ] Glide integration primitives (mini-app style transitions)
**Sources:** INTEGRATIONS/Linear.md, INTEGRATIONS/Glide.md

### Step 7 — Robotics track (P4)
- [ ] Robotics capsule type + tool gateway boundaries
**Sources:** UNIFIED/ROBOTICS/Robotics.md

---

## 4) How to ensure nothing is missed
- A PR is invalid unless it includes:
  1) completed reading checklist
  2) a Backlog item mapping (ID -> file sources)
  3) updated AcceptanceTests coverage notes (even if “not applicable”)
- For every conflict between docs, open a `docs/DECISIONS/ADR-XXX.md` instead of silently choosing.

