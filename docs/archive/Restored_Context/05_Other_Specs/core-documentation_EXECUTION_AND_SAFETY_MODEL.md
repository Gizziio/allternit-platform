# EXECUTION_AND_SAFETY_MODEL.md

Single execution path and safety gating using existing components only.

## Canonical Execution Path

### Agent Run
1. Studio requests a session/run via kernel session endpoints (`services/kernel/src/main.rs`).
2. Kernel dispatches intent through `IntentDispatcher` (`services/kernel/src/intent_dispatcher.rs`).
3. Tool execution is routed through ToolGateway (policy-gated) rather than direct ToolExecutor calls.
4. Execution produces artifacts (verification, context bundles) currently stored in `JournalLedger` (`services/kernel/src/journal_ledger.rs`) and must be persisted into ArtifactRegistry (`crates/control/artifact-registry/src/lib.rs`).

### Workflow Run
1. Studio calls workflow execution via `WorkflowEngine.execute_workflow` (`crates/orchestration/workflows/src/lib.rs`).
2. Workflow nodes resolve skills from `SkillRegistry` (`crates/skills/src/lib.rs`) and execute tools through ToolGateway (`crates/kernel/tools-gateway/src/lib.rs`).
3. Workflow artifacts are tracked in `WorkflowExecution.artifacts` and persisted through ArtifactRegistry.

### Pipeline Run
1. A pipeline is represented as a `MiniAppManifest` with an external service URL (`apps/shared/contracts.ts`, `apps/shell/public/marketplace/comfyui-capsule.json`).
2. Pipeline execution is invoked as a ToolGateway tool (HTTP-backed), capturing outputs as artifacts.

## Policy Gating Points
- Tool execution gating via ToolGateway policy checks (`crates/kernel/tools-gateway/src/lib.rs`).
- Kernel-level security middleware and rate limiting (`services/kernel/src/main.rs`).
- Workflow policy enforcement in `WorkflowEngine` during execution and validation (`crates/orchestration/workflows/src/lib.rs`, `crates/orchestration/workflows/src/engine/validator.rs`).

## Artifact Capture Boundaries
- Intent dispatch generates verification artifacts (`services/kernel/src/intent_dispatcher.rs`).
- Workflow execution generates node artifacts and verify gating (`crates/orchestration/workflows/src/lib.rs`).
- Tool execution results are converted to artifacts for audit and retrieval (`crates/kernel/tools-gateway/src/lib.rs`).
- All artifacts must be persisted in ArtifactRegistry, not only `JournalLedger`.

## Resolutions Of Current Ambiguities

### ToolExecutor vs ToolGateway
- ToolGateway is canonical for registry + execution (policy gated).
- ToolExecutor becomes an adapter that registers local tools into ToolGateway at kernel startup (`services/kernel/src/tool_executor.rs`, `services/kernel/src/embodiment/desktop.rs`).
- Kernel `GET /v1/tools` should be derived from ToolGateway definitions rather than ToolExecutor’s internal map.

### Skill Execution
- Skills are executed through `SkillRegistry` + `WorkflowEngine`. `SkillManager` remains a UI listing layer until replaced. (`crates/skills/src/lib.rs`, `services/kernel/src/skill_manager.rs`)
- “Test Skill” should call workflow execution rather than a separate skill runtime.

### Agent Runtime Attachment
- `AgentSpec` is the canonical agent template (`services/kernel/src/types.rs`) and should be attached to session context for `IntentDispatcher`.
- Remove UI “Test Agent” until the `AgentSpec` → runtime binding is implemented.
