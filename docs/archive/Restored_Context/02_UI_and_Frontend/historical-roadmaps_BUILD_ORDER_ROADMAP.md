# BUILD_ORDER_ROADMAP.md

Dependency-ordered roadmap derived from existing components and gaps.

## Phase 1: Control-Plane Registry Consolidation (Unblocks Everything)
Dependencies: None.
- Expose a unified registry API in `services/kernel/src/main.rs` for agents, tools, skills, workflows, templates, artifacts.
- Map agents to `AgentRegistry` (`services/kernel/src/agent_registry.rs`).
- Map tools to ToolGateway (`crates/kernel/tools-gateway/src/lib.rs`).
- Map skills to `SkillRegistry` (`crates/skills/src/lib.rs`).
- Map workflows to `WorkflowEngine` (`crates/orchestration/workflows/src/lib.rs`), proxying `apps/api` validate/compile as needed.

## Phase 2: Artifact Persistence Wiring (Required Before UI Claims)
Dependencies: Phase 1 registry endpoints.
- Persist kernel artifacts into ArtifactRegistry (`crates/control/artifact-registry/src/lib.rs`) instead of only `JournalLedger` (`services/kernel/src/journal_ledger.rs`).
- Add list/query endpoints for artifact browsing.

## Phase 3: Execution Path Unification (Safety-Critical)
Dependencies: Phase 1 registry + Phase 2 artifact persistence.
- Replace kernel in-memory SQLite/AnyPool stubs with real workspace DB pools so MemoryFabric and registries persist data.
- Register ToolExecutor local tools into ToolGateway at kernel startup (`services/kernel/src/tool_executor.rs`).
- Route tool execution through ToolGateway for policy gating and audit.
- Ensure workflow execution records artifacts and uses ToolGateway.

## Phase 4: Studio UI Rewire And Placeholder Removal
Dependencies: Phases 1–3.
- Replace placeholder Studio buttons with real API calls (`apps/shell/src/components/StudioView.tsx`).
- Remove or hide UI elements that cannot be executed safely (Agent “Test”, Workflow “Run”, Tool “Test”, Skill “Test”) until endpoints exist.
- De-emphasize `apps/ui/src/views/StudioView.ts` or wire it to the same APIs.

## Phase 5: Templates And Pipelines Expansion
Dependencies: Phases 1–4.
- Templates: instantiate via registry-backed endpoints, no placeholder cards.
- Pipelines: treat `MiniAppManifest` as pipeline definition and expose pipeline tool invocation via ToolGateway.

## Do-Not-Build-Until Invariants
- Do not enable Studio “Save/Test/Run” actions until the corresponding registry and execution endpoints exist.
- Do not surface artifacts UI until persistence is backed by ArtifactRegistry.
- Do not expose pipeline execution until pipeline tool invocation is policy-gated and artifact-producing.
