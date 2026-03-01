# STUDIO_PRIMITIVES.md

Canonical Studio primitives based strictly on the audit documents. Each entry references existing code paths and specifies how to consolidate.

## Primitive Canonicalization Table

| Primitive | Canonical Type | Existing Types | Action |
| --- | --- | --- | --- |
| Agent | `AgentSpec` (`services/kernel/src/types.rs`) | `AgentSpec` (`services/kernel/src/types.rs`), `AgentDefinition` (`crates/orchestration/agents/src/lib.rs`) | Keep `AgentSpec` as the registry-facing canonical type; map or deprecate `AgentDefinition` until it is backed by a registry endpoint. |
| Workflow | `WorkflowDefinition` (`crates/orchestration/workflows/src/lib.rs`) | `WorkflowDefinition` plus YAML inputs (`crates/orchestration/workflows/src/engine/compiler.rs`) | Keep `WorkflowDefinition` as canonical; use YAML compiler/validator for serialization and validation. |
| Tool | `ToolDefinition` (`crates/kernel/tools-gateway/src/lib.rs`) | `ToolDefinition` in kernel (`services/kernel/src/types.rs`), `ToolDefinition` in ToolGateway (`crates/kernel/tools-gateway/src/lib.rs`), `Tool` trait (`services/kernel/src/tool_executor.rs`) | Make ToolGateway `ToolDefinition` the source of truth; derive kernel `ToolDefinition` as a presentation view; route execution through ToolGateway. |
| Skill | `Skill` (`crates/skills/src/lib.rs`) | `Skill`/`SkillManifest` (`crates/skills/src/lib.rs`), `SkillPackage` (`services/kernel/src/skill_manager.rs`) | Use `Skill` as canonical; keep `SkillPackage` as a marketplace/listing view until replaced by registry-backed skill records. |
| Pipeline | `MiniAppManifest` (`apps/shared/contracts.ts`) | ComfyUI app manifest (`apps/shell/public/marketplace/comfyui-capsule.json`), iframe views (`apps/shared/contracts.ts`) | Treat pipelines as `MiniAppManifest` entries with iframe or service-backed views; avoid inventing a new pipeline type until registry consolidation is done. |
| Artifact | `ArtifactMetadata` + registry store (`crates/control/artifact-registry/src/lib.rs`) | Kernel `Artifact` (`services/kernel/src/types.rs`), in-memory ledger (`services/kernel/src/journal_ledger.rs`), artifact registry (`crates/control/artifact-registry/src/lib.rs`) | Use artifact registry as persistent source of truth; keep kernel `Artifact` as transient event payloads. |
| Template | Underlying primitive types (`AgentSpec`, `WorkflowDefinition`, `MiniAppManifest`) | `AgentRegistry` templates (`services/kernel/src/agent_registry.rs`), workflow templates (`crates/orchestration/workflows/src/templates/mod.rs`), ComfyUI manifest (`apps/shell/public/marketplace/comfyui-capsule.json`) | Treat templates as versioned instances of canonical primitives stored via the unified registry; deprecate placeholder-only UI. |
| Session / Run | Kernel session manager + workflow execution (`services/kernel/src/main.rs`, `crates/orchestration/workflows/src/lib.rs`) | Session endpoints (`services/kernel/src/main.rs`), `WorkflowExecution` (`crates/orchestration/workflows/src/lib.rs`) | Use kernel session endpoints for session identity and `WorkflowExecution` for runs; ensure artifacts link to session/run IDs. |

## Notes And Invariants
- The canonical types above already exist and have concrete code paths; consolidation should collapse duplicates rather than introduce new models.
- UI must not expose “Save/Test/Run” actions unless the corresponding registry and execution endpoints exist.
- Pipelines are defined as a specialization of `MiniAppManifest` until a registry-backed pipeline tool is wired through the control-plane API.
