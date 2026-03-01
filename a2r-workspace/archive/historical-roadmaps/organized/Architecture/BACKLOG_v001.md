# Architecture Corpus Backlog v001
**Important:** The `Architecture/` folder is a **design-direction corpus separate from the code repo**. It must be read in full before implementation.

## 0) Mandatory full-corpus reading checklist (no exceptions)
Mark each as read before starting coding. PRs must list which items were read.

| # | File | First line / purpose |
|---:|---|---|
| 1 | `ACCEPTANCE/AcceptanceTests.md` | # AcceptanceTests |
| 2 | `BACKLOG/MD-007.md` | Good — this is exactly the right next MD to ingest after locking SOT + Acceptance Tests. |
| 3 | `BACKLOG/MD-008.md` | Loaded A2rchitech_Dynamic_Discovery_UI.md and treating it as MD-008. This is a strong, compatible extension that deepens Discovery, Capsules, Memory, and Web Use—without violating the SOT or Acceptance Tests. Below is a precise integration, with conflicts resolved by normalization (not rejection).  ￼ |
| 4 | `BACKLOG/MD-009.md` | Loaded A2rchitech_AgenticOS_Framework_Runtime_Harness_Integration.md and ingesting it as MD-009. This is a high-quality additive that formalizes how agents are built, run, and shipped without introducing new execution paths or UI primitives. It fits cleanly under the locked SOT + Acceptance Tests.  ￼ |
| 5 | `BACKLOG/MD-010.md` | Loaded A2rchitech_UnifiedUI_MiniApp_DataSystem_RagicClass.md and ingesting it as MD-010. This is a major, high-leverage addition that cleanly fills a missing primitive: structured operational state with auto-generated UI, without breaking any locked invariant.  ￼ |
| 6 | `BACKLOG/MD-011.md` | Loaded A2rchitech_Universal_Text_Interface_UTI_v0.1.md and ingesting it as MD-011. This is a strong, additive expansion that introduces a universal conversational endpoint while staying within all locked invariants.  ￼ |
| 7 | `BACKLOG/MD-012.md` | Understood. You’re right to correct this — the name and identity matter, and more importantly the center of gravity matters. |
| 8 | `BACKLOG/MD-013.md` |  MD-013 — Pattern-Adaptive Agent Framework (Ingested) |
| 9 | `BACKLOG/MD-014.md` | Loaded a2rchitech_linear_core_pattern.md and ingesting it as MD-014. This is a pillar-level conceptual extraction, not a feature proposal, and it fits extremely cleanly into what we’ve already locked.  ￼ |
| 10 | `BACKLOG/MD-015.md` | Loaded A2rchitech_Prompt_Context_Unified_UI_Integration.md and ingesting it as MD-015. This is a critical infrastructure MD, not an optional enhancement. It cleanly formalizes where prompting belongs and prevents one of the most common long-term failure modes in agentic systems: prompt entropy and UI-driven chaos.  ￼ |
| 11 | `BACKLOG/MD-016.md` | Good call bundling these three. You were right: they live on the same layer cluster and should not be summarized independently. They form a single coherent subsystem and must be integrated as such. |
| 12 | `BACKLOG/MD-017.md` | Loaded and acknowledged. This is the final upload, so we now integrate it under PROJECT_LAW and lock it cleanly. |
| 13 | `BACKLOG/Tool Registry.md` | Proceeding. The next lock is the Tool Registry—this is the last core pillar required to make the system deterministic, governable, and safe. |
| 14 | `INTEGRATIONS/Glide.md` | # Glide Apps → a2rchitech Unified Chat UI Integration |
| 15 | `INTEGRATIONS/Linear.md` | # Linear as a Pattern: Core Architectural Value for a2rchitech |
| 16 | `LAW/BUILDER_ENTRY_INDEX.md` | # BUILDER_ENTRY_INDEX |
| 17 | `LAW/Guardrails.md` | # a2rchitech Guardrails & Templates |
| 18 | `LAW/OperatingSystem.md` | Saved. This framework is now committed to long-term memory as your default project architecture and agentic workflow law. |
| 19 | `LAW/PROJECT_LAW copy.md` | # PROJECT_LAW |
| 20 | `LAW/Project_Law.md` | ⸻ |
| 21 | `LAW/RepoLaw.md` | # APPENDIX A — PROJECT ORGANIZATION LAW |
| 22 | `UI/Architecture_and_Prompt_Suites.md` | # A2rchitech — Architecture Designs + Prompt Suites |
| 23 | `UI/CanvasProtocol.md` | Proceeding. Below is the next hard-default artifact in the chain. |
| 24 | `UI/CapsuleProtocol.md` | Yes — we will still generate new MDs as we progress. Your uploaded MDs are inputs; the system also needs derived specs (protocols, schemas, contracts, acceptance tests) that don’t exist yet but are required to make the repo deterministic and unified. This is exactly implied by your own “next concrete deliverables” callout (e.g., Presentation Kernel spec)  ￼. |
| 25 | `UI/Capsules.md` | # A2rchitech Dynamic Discovery UI |
| 26 | `UI/Journal.md` | Proceeding forward. The next correct move—now that UI semantics and capsules are frozen—is to formalize the single source of truth that everything binds to. |
| 27 | `UI/MiniAppRuntime.md` | # A2rchitech Unified UI Chat — Mini-App: Data System Primitive (Ragic-Class) |
| 28 | `UI/PresentationKernel.md` | Proceeding. Below is the next canonical artifact, generated as a hard-default spec, derived directly from MD-001 and aligned with the Capsule correction. |
| 29 | `UI/Research_Synthesis_Discovery_UI.md` | # A2rchitech — Research Synthesis (Discovery-First Web + Memory + Skills) |
| 30 | `UI/UTI.md` | # A2rchitech \| Universal Text Interface (UTI) |
| 31 | `UI/caspuleshell_kernelcontractsPrompt.md` | ROLE |
| 32 | `UI/presentation/RendererCapabilities.md` | # RendererCapabilities |
| 33 | `UNIFIED/AGENTS/AdaptivePatterns.md` | # Pattern-Adaptive Agent Framework |
| 34 | `UNIFIED/COMPILER/DirectiveCompiler.md` | # A2rchitech Integration Spec |
| 35 | `UNIFIED/CONTEXT/Context.md` | # A2rchitech Integration Chat Plan |
| 36 | `UNIFIED/CONTEXT/ContextSystem.md` | # Unified Context, Memory, Retrieval, and Inference Architecture |
| 37 | `UNIFIED/IR/MarkdownIR.md` | # A2rchitech Markdown IR Standard |
| 38 | `UNIFIED/ROBOTICS/Robotics.md` | # A2rchitech Robotics Integration – Planning Notes (Unified) |
| 39 | `UNIFIED/RUNTIME/Kernel.md` | # A2rchitech Agentic OS — Framework / Runtime / Harness Integration Spec |
| 40 | `UNIFIED/SOT.md` | # SOT |

---

## 1) Executable integration backlog (every task cites corpus files)

### META-00 — Create repo-side 'Architecture Corpus' intake and trace matrix

**Scope:** Repo documentation only (no runtime changes).

**Definition of Done:**
- [ ] Add `docs/architecture-corpus/README.md` explaining this folder is separate and must be consulted.
- [ ] Add `docs/architecture-corpus/TRACE_MATRIX.md` mapping: Corpus File -> Features/Tasks/Components.
- [ ] Add PR template checkbox: 'I read all Architecture corpus files' + list of files read.

**Sources (must be read for this task):**
- `ACCEPTANCE/AcceptanceTests.md`
- `BACKLOG/MD-007.md`
- `BACKLOG/MD-008.md`
- `BACKLOG/MD-009.md`
- `BACKLOG/MD-010.md`
- `BACKLOG/MD-011.md`
- `BACKLOG/MD-012.md`
- `BACKLOG/MD-013.md`
- `BACKLOG/MD-014.md`
- `BACKLOG/MD-015.md`
- `BACKLOG/MD-016.md`
- `BACKLOG/MD-017.md`
- `BACKLOG/Tool Registry.md`
- `INTEGRATIONS/Glide.md`
- `INTEGRATIONS/Linear.md`
- `LAW/BUILDER_ENTRY_INDEX.md`
- `LAW/Guardrails.md`
- `LAW/OperatingSystem.md`
- `LAW/PROJECT_LAW copy.md`
- `LAW/Project_Law.md`
- `LAW/RepoLaw.md`
- `UI/Architecture_and_Prompt_Suites.md`
- `UI/CanvasProtocol.md`
- `UI/CapsuleProtocol.md`
- `UI/Capsules.md`
- `UI/Journal.md`
- `UI/MiniAppRuntime.md`
- `UI/PresentationKernel.md`
- `UI/Research_Synthesis_Discovery_UI.md`
- `UI/UTI.md`
- `UI/caspuleshell_kernelcontractsPrompt.md`
- `UI/presentation/RendererCapabilities.md`
- `UNIFIED/AGENTS/AdaptivePatterns.md`
- `UNIFIED/COMPILER/DirectiveCompiler.md`
- `UNIFIED/CONTEXT/Context.md`
- `UNIFIED/CONTEXT/ContextSystem.md`
- `UNIFIED/IR/MarkdownIR.md`
- `UNIFIED/ROBOTICS/Robotics.md`
- `UNIFIED/RUNTIME/Kernel.md`
- `UNIFIED/SOT.md`


### P0-A — Capsule instances + tab canvas metaphor (shell)

**Scope:** apps/shell + apps/ui only.

**Definition of Done:**
- [ ] Capsule store supports open/close/activate.
- [ ] Tab bar reflects capsule instances; active capsule controls active canvas.
- [ ] Canvas mount renders CanvasSpec; switching tabs switches canvas.
- [ ] Persistence flags for capsules exist in UI state: ephemeral/docked/pinned (no persistence yet).

**Sources (must be read for this task):**
- `UI/Capsules.md`
- `UI/CapsuleProtocol.md`
- `UI/CanvasProtocol.md`
- `UI/PresentationKernel.md`
- `UI/presentation/RendererCapabilities.md`
- `UNIFIED/SOT.md`
- `LAW/Guardrails.md`


### P0-B — Canvas protocol + minimum view taxonomy (renderer)

**Scope:** apps/ui renderer + shared contracts.

**Depends on:** P0-A

**Definition of Done:**
- [ ] Define canonical CanvasSpec + ViewSpec types used by renderer.
- [ ] Implement minimum views: timeline_view, list_view, object_view, search_lens (can be simple cards initially).
- [ ] Renderer supports a 'view registry' so new view types can be added without rewriting the shell.

**Sources (must be read for this task):**
- `UI/CanvasProtocol.md`
- `UI/Journal.md`
- `UI/presentation/RendererCapabilities.md`
- `UNIFIED/IR/MarkdownIR.md`
- `BACKLOG/MD-010.md`


### P0-C — FrameworkSpec + capsule spawn as agent-generated mini-app templates

**Scope:** Contracts + shell runtime wiring (framework registry interface).

**Depends on:** P0-A, P0-B

**Definition of Done:**
- [ ] FrameworkSpec schema exists: allowed intents, default canvases, tool scope, persistence policy.
- [ ] Shell can spawn a capsule from a framework (template → instance).
- [ ] Naive routing: intent prefix selects framework; later replaced by agent router.
- [ ] Every spawn appends journal events (even if journal is local in v0).

**Sources (must be read for this task):**
- `UI/MiniAppRuntime.md`
- `UNIFIED/COMPILER/DirectiveCompiler.md`
- `UNIFIED/AGENTS/AdaptivePatterns.md`
- `BACKLOG/MD-013.md`
- `BACKLOG/Tool Registry.md`
- `UI/caspuleshell_kernelcontractsPrompt.md`


### P0-D — Kernel contracts: intent dispatch returns events+artifacts+canvas (stub contract)

**Scope:** Define HTTP contract and adapter in shell; backend may be mocked.

**Depends on:** P0-C

**Definition of Done:**
- [ ] Define /v1/workspaces/{ws}/frameworks response shape and client adapter.
- [ ] Define /v1/intent/dispatch request/response shape: returns capsule + events + artifacts + canvas.
- [ ] Define /v1/journal/stream shape (even if shell still uses local journal in v0).
- [ ] Define Artifact types: ObserveCapsule + DistillateCapsule (content schemas).
- [ ] Update AcceptanceTests.md with P0 entry-point tests.

**Sources (must be read for this task):**
- `UNIFIED/RUNTIME/Kernel.md`
- `UI/Journal.md`
- `UI/UTI.md`
- `UNIFIED/CONTEXT/ContextSystem.md`
- `BACKLOG/MD-011.md`
- `BACKLOG/MD-015.md`
- `ACCEPTANCE/AcceptanceTests.md`


### P1-01 — Server-backed framework registry (direction + interface)

**Scope:** Kernel/Service layer interface; no implementation required in this backlog file, but contract+DoD required.

**Depends on:** P0-D

**Definition of Done:**
- [ ] Frameworks are workspace-scoped: GET /v1/workspaces/{ws}/frameworks
- [ ] Include persistence: ephemeral/docked/pinned and maxToolScope.
- [ ] Shell caches registry; invalidates by version/etag.

**Sources (must be read for this task):**
- `INTEGRATIONS/Linear.md`
- `INTEGRATIONS/Glide.md`
- `BACKLOG/MD-007.md`
- `BACKLOG/MD-014.md`
- `UNIFIED/RUNTIME/Kernel.md`


### P1-02 — Journal persistence boundary (events/artifacts)

**Scope:** Kernel/State service contract.

**Depends on:** P0-D

**Definition of Done:**
- [ ] Append-only journal API defined: append, stream, get-by-id.
- [ ] Artifact store API defined: get artifact by id; artifacts referenced by events.
- [ ] Retention policy hook exists (even if no enforcement yet).

**Sources (must be read for this task):**
- `UI/Journal.md`
- `UNIFIED/CONTEXT/Context.md`
- `UNIFIED/CONTEXT/ContextSystem.md`
- `BACKLOG/MD-016.md`


### P1-03 — Tool registry + tool scope gating + action preview

**Scope:** Kernel policy layer contract.

**Depends on:** P1-02

**Definition of Done:**
- [ ] Tool registry contract exists: tool_id, scope(read/write/exec), preconditions.
- [ ] Any write/exec tool requires ActionPreview receipt event before execution.
- [ ] Journal records consent/denial (auditable).

**Sources (must be read for this task):**
- `BACKLOG/Tool Registry.md`
- `LAW/Guardrails.md`
- `UNIFIED/RUNTIME/Kernel.md`
- `LAW/OperatingSystem.md`


### P2-01 — Context packing (progressive disclosure)

**Scope:** Context system behavior and interfaces.

**Depends on:** P1-02

**Definition of Done:**
- [ ] Define context pack types: working set, pinned knowledge, replay evidence, distillates.
- [ ] Define packer interface: inputs (events/artifacts) → bounded context outputs.
- [ ] Define policies for what gets promoted to distillate.

**Sources (must be read for this task):**
- `UNIFIED/CONTEXT/Context.md`
- `UNIFIED/CONTEXT/ContextSystem.md`
- `BACKLOG/MD-012.md`
- `BACKLOG/MD-016.md`


### P2-02 — Markdown IR normalization for agent inputs and UI outputs

**Scope:** IR layer spec + adapters.

**Depends on:** P2-01

**Definition of Done:**
- [ ] Define MarkdownIR schema for: sections, blocks, references, citations, tool receipts.
- [ ] Define conversion: raw markdown → MarkdownIR → renderable blocks/canvases.
- [ ] Define stable referencing: artifacts + event ids can be embedded in IR.

**Sources (must be read for this task):**
- `UNIFIED/IR/MarkdownIR.md`
- `ACTIONS: see BACKLOG/MD-016.md`
- `UI/Architecture_and_Prompt_Suites.md`


### P2-03 — Distillation pipeline (events/artifacts → distillates)

**Scope:** Kernel side algorithm + contract; UI shows distillates as canvases.

**Depends on:** P2-02

**Definition of Done:**
- [ ] Define DistillateCapsule artifact schema: title, claims, linked evidence, recommended next actions.
- [ ] Define distillation triggers (manual or periodic).
- [ ] UI can open a distillate as a capsule/canvas.

**Sources (must be read for this task):**
- `UNIFIED/CONTEXT/ContextSystem.md`
- `UI/Research_Synthesis_Discovery_UI.md`
- `BACKLOG/MD-008.md`


### P3-01 — Linear integration: work graph → capsules and views

**Scope:** Integration adapter spec (no code).

**Depends on:** P1-02, P0-B

**Definition of Done:**
- [ ] Map Linear primitives (issue, project, cycle) to capsules and canvases.
- [ ] Define sync events into journal (work_item_upsert, status_change).
- [ ] Define UI views (table_view, workflow_view) backed by journal artifacts.

**Sources (must be read for this task):**
- `INTEGRATIONS/Linear.md`
- `a2rchitech_linear_core_pattern.md (if present in corpus)`
- `BACKLOG/MD-014.md`


### P3-02 — Glide integration: transitions + interactive mini-app feel

**Scope:** UI interaction layer spec (no code).

**Depends on:** P0-A, P0-B

**Definition of Done:**
- [ ] Adopt transition patterns: capsule spawn/close animations as system affordances.
- [ ] Define 'capsule templates' that map to mini-app flows (multi-canvas).
- [ ] Ensure transitions remain deterministic and auditable (journal events).

**Sources (must be read for this task):**
- `INTEGRATIONS/Glide.md`
- `BACKLOG/MD-007.md`
- `UI/PresentationKernel.md`


### P4-01 — Robotics domain capsule + tool gateway boundaries

**Scope:** Domain capsule spec (no code).

**Depends on:** P1-03

**Definition of Done:**
- [ ] Define Robotics capsule type and its tool scopes.
- [ ] Define gateway boundary for hardware actions (always ActionPreview).
- [ ] Define safety receipts and audit events.

**Sources (must be read for this task):**
- `UNIFIED/ROBOTICS/Robotics.md`
- `LAW/Guardrails.md`
- `BACKLOG/MD-017.md`


### PROC-01 — Builder entry: single start-here doc + command prompt suite

**Scope:** Docs only; ensures agents read corpus and follow the build order.

**Depends on:** META-00

**Definition of Done:**
- [ ] Create `docs/START_HERE.md` that points to LAW/BUILDER_ENTRY_INDEX.md in corpus.
- [ ] Embed the coding-agent prompt for P0 entry-point (capsule shell + kernel contracts).
- [ ] Include a strict 'No missing sources' rule: every task cites corpus files.

**Sources (must be read for this task):**
- `LAW/BUILDER_ENTRY_INDEX.md`
- `UI/Architecture_and_Prompt_Suites.md`
- `UI/caspuleshell_kernelcontractsPrompt.md`


### PROC-02 — Normalize corpus BACKLOG/MD-007..MD-017 into executable issue templates

**Scope:** Docs/PM artifacts.

**Depends on:** META-00

**Definition of Done:**
- [ ] For each BACKLOG/MD-0XX.md, extract: capability, DoD, components, dependencies.
- [ ] Create `docs/issues/MD-0XX.md` templates for engineering tickets.
- [ ] Ensure each template cites the original BACKLOG/MD-0XX.md as the source.

**Sources (must be read for this task):**
- `BACKLOG/MD-007.md`
- `BACKLOG/MD-008.md`
- `BACKLOG/MD-009.md`
- `BACKLOG/MD-010.md`
- `BACKLOG/MD-011.md`
- `BACKLOG/MD-012.md`
- `BACKLOG/MD-013.md`
- `BACKLOG/MD-014.md`
- `BACKLOG/MD-015.md`
- `BACKLOG/MD-016.md`
- `BACKLOG/MD-017.md`

