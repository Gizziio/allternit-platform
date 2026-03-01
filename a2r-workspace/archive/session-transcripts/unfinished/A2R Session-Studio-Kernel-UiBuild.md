# A2rchitech Session Summary — Studio + Kernel + UI Build Prompts (2026-01-26)

## Session Goal
Create executable agent prompts (and a Codex task pack) that:
1) establish ground-truth of what exists in the A2rchitech codebase (audit),
2) define the correct build order for a real AI Studio,
3) drive kernel/control-plane consolidation first,
4) then build the Studio UI “all the way” with zero placeholder/lying UI.

---

## Key Inputs / Evidence Loaded This Session
You provided and/or uploaded the following authoritative docs, which now serve as frozen truth for planning and implementation:

### Audit Outputs (Reality + Gaps + Forward Map)
- `CODEBASE_REALITY.md` — evidence-based map of repo structure, runtime boundaries, and what Studio actually does vs implies.
- `STUDIO_GAP_MATRIX.md` — explicit Exists/Partial/Missing per Studio capability (UI↔kernel wiring missing; artifacts in-memory; ComfyUI is embed-only; registries fragmented).
- `ARCHITECTURAL_ALIGNMENT.md` — forward mapping: keep primitives, rewire through a single control-plane, unify registries, route execution through policy-gated ToolGateway, persist artifacts via ArtifactRegistry.

### Frozen Implementation Specs (Derived From Audit)
- `STUDIO_PRIMITIVES.md` — canonical type decisions:
  - Agent = `AgentSpec` (kernel), Workflow = `WorkflowDefinition` (workflows crate),
  - Tool source-of-truth = ToolGateway `ToolDefinition`,
  - Skill canonical = `crates/skills` `Skill`,
  - Pipeline = `MiniAppManifest`,
  - Artifact persistence = ArtifactRegistry metadata, kernel Artifact transient,
  - Templates = versioned instances of underlying primitives,
  - Sessions/Runs = kernel sessions + workflow executions.
- `REGISTRY_AND_KERNEL_PLAN.md` — unified control-plane API surface under kernel `/v1/*` for agents/tools/skills/workflows/templates/artifacts; workflows validate/compile can proxy from apps/api until migrated.
- `EXECUTION_AND_SAFETY_MODEL.md` — single execution path:
  - Intent → ToolGateway (policy-gated) → artifacts captured; ToolExecutor becomes adapter registering local tools into ToolGateway.
  - Workflows execute via WorkflowEngine + SkillRegistry + ToolGateway.
- `BUILD_ORDER_ROADMAP.md` — dependency-ordered build sequence:
  1) control-plane registry consolidation,
  2) artifact persistence wiring,
  3) execution-path unification,
  4) Studio UI rewiring + placeholder removal,
  5) templates + pipelines expansion.

---

## Deliverables Produced In-Chat

### 1) Codebase Audit Agent Prompt (Ground-Truth Discovery)
A strict prompt for an agent to:
- map repo topology (UI → API → runtime → storage → external tools),
- validate the Studio tab reality (Builders/Pipelines/Artifacts/Templates),
- classify each feature as Fully/Partial/Stub/Missing,
- produce `CODEBASE_REALITY.md`, `STUDIO_GAP_MATRIX.md`, `ARCHITECTURAL_ALIGNMENT.md`.

### 2) Post-Audit Planning Agent Prompt (Map Reality → Build Plan)
A second prompt for an architect agent to:
- canonicalize primitives,
- redesign Studio views around real backend capability,
- unify registries behind a single kernel control-plane,
- define safety-gated execution path,
- produce five plan files (primitives/view redesign/registry plan/safety model/build order).

### 3) Kernel Phase 1 “Control-Plane” Implementation Prompt
A final, non-negotiable implementation prompt for a kernel agent to execute Phase 1:
- implement `/v1/*` endpoints per `REGISTRY_AND_KERNEL_PLAN.md`,
- enforce registry sources of truth (Agents→AgentRegistry, Tools→ToolGateway, Skills→SkillRegistry, Workflows→WorkflowEngine),
- begin ToolExecutor→ToolGateway canonicalization (ToolGateway-derived list + execute).

### 4) Codex Task Pack (Phase 1 Control-Plane Registry Consolidation)
A complete Codex-style pack including:
- front matter (name/inputs/scope/constraints/success criteria),
- ordered tasks (endpoint scaffolding → source-of-truth enforcement → tool execution canonicalization),
- explicit non-goals (no UI; no artifact persistence yet; no new primitives),
- required markdown deliverables + patch output expectations.

### 5) Full Studio UI Build Agent Prompt (“Build UI all the way”)
A comprehensive UI implementation prompt that forces:
- no fake buttons (Save/Run/Test only if endpoints exist),
- registry-driven lists from `/v1/*`,
- artifact-first rendering and strict error-state discipline,
- Studio modular refactor (`apps/shell/src/components/studio/**`),
- end-to-end implementation for:
  - Builders: Agent/Workflow/Tool/Skill
  - Pipelines: MiniAppManifest-based, ComfyUI treated as one pipeline type, no “Save Graph” fantasy
  - Artifacts: list/query/detail with typed renderers
  - Templates: list + instantiate → redirect into builders
- explicit removal of placeholder UI and de-emphasis of the duplicate DOM Studio (`apps/ui`) unless wired.

---

## Notable Decisions Locked This Session
- Studio UI is not allowed to “imply” capability: all actions must be truth-bound to control-plane endpoints.
- Kernel becomes the single control-plane surface; apps/api workflow routes can be proxied/migrated but Studio must call kernel.
- ToolGateway is the canonical tool registry/executor (policy-gated); ToolExecutor becomes a startup adapter.
- Artifact persistence is mandatory before Artifacts UI claims functionality (Phase 2).

---

## Next Execution Steps (According To Roadmap)
1) Run the **Codex Phase 1 task pack** to implement the unified kernel `/v1/*` control-plane.
2) Phase 2: wire ArtifactRegistry persistence + list/query endpoints.
3) Phase 3: fully unify execution through ToolGateway + artifact capture at boundaries.
4) Phase 4: rewire Studio UI to these endpoints and delete/disable any remaining placeholder actions.
5) Phase 5: expand Templates + Pipelines (pipeline tools, manifests registry, agent-callable pipeline invocations).

---