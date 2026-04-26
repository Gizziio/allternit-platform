# REGISTRY_AND_KERNEL_PLAN.md

Single control-plane API surface design that collapses existing registries into one kernel-backed interface.

## Source Of Truth Decisions (Existing Components)
- Agents: `AgentRegistry` (`services/kernel/src/agent_registry.rs`).
- Tools: ToolGateway (`crates/kernel/tools-gateway/src/lib.rs`).
- Skills: SkillRegistry (`crates/skills/src/lib.rs`) with `SkillManager` (`services/kernel/src/skill_manager.rs`) treated as a legacy listing layer.
- Workflows: `WorkflowEngine` (`crates/orchestration/workflows/src/lib.rs`); compile/validate via `YamlCompiler` and `YamlValidator` (`crates/orchestration/workflows/src/engine/*`).
- Artifacts: `ArtifactRegistry` (`crates/control/artifact-registry/src/lib.rs`) as persistence, kernel `Artifact` as transient.
- Templates: stored as versioned instances of the above primitives (agent/workflow/pipeline) rather than a new type.

## Unified Control-Plane API (Kernel-Owned)

All Studio calls route through `services/kernel/src/main.rs`. Existing endpoints are preserved; missing ones are added to collapse registries.

| Endpoint | Methods | Owner | Source Of Truth |
| --- | --- | --- | --- |
| `/v1/agents/templates` | `GET` | Kernel | `AgentRegistry` |
| `/v1/agents/templates` | `POST` | Kernel | `AgentRegistry` |
| `/v1/agents/templates/:id` | `PUT` | Kernel | `AgentRegistry` |
| `/v1/tools` | `GET` | Kernel | ToolGateway (derived to kernel schema) |
| `/v1/tools` | `POST` | Kernel | ToolGateway |
| `/v1/tools/:id` | `PUT` | Kernel | ToolGateway |
| `/v1/tools/:id/execute` | `POST` | Kernel | ToolGateway |
| `/v1/skills` | `GET` | Kernel | SkillRegistry |
| `/v1/skills` | `POST` | Kernel | SkillRegistry |
| `/v1/skills/:id` | `PUT` | Kernel | SkillRegistry |
| `/v1/skills/:id/execute` | `POST` | Kernel | WorkflowEngine + ToolGateway |
| `/v1/workflows` | `GET` | Kernel | WorkflowEngine |
| `/v1/workflows` | `POST` | Kernel | WorkflowEngine |
| `/v1/workflows/:id/execute` | `POST` | Kernel | WorkflowEngine |
| `/v1/workflows/validate` | `POST` | Kernel | YamlValidator (proxy to `apps/api` until moved) |
| `/v1/workflows/compile` | `POST` | Kernel | YamlCompiler (proxy to `apps/api` until moved) |
| `/v1/templates` | `GET` | Kernel | AgentRegistry + WorkflowEngine + Pipeline manifests |
| `/v1/templates` | `POST` | Kernel | Underlying primitive registry |
| `/v1/templates/:id/instantiate` | `POST` | Kernel | Underlying primitive registry |
| `/v1/artifacts` | `GET` | Kernel | ArtifactRegistry |
| `/v1/artifacts` | `POST` | Kernel | ArtifactRegistry |
| `/v1/artifacts/query` | `POST` | Kernel | ArtifactRegistry |
| `/v1/artifacts/:id` | `GET` | Kernel | ArtifactRegistry |

Existing endpoints to keep during transition:
- `/v1/agents/templates` (already in kernel).
- `/v1/marketplace/skills` (kernel; keep as alias until `/v1/skills` exists).
- `/v1/tools` (kernel; rewire to ToolGateway-backed list).
- `/api/v1/workflows/*` (apps/api; proxy or migrate into kernel).

## Registry Consolidation Actions
- Replace ToolExecutor’s in-memory list as a registry source; derive kernel tool list from ToolGateway definitions. `services/kernel/src/tool_executor.rs`, `crates/kernel/tools-gateway/src/lib.rs`
- Replace SkillManager’s JSON store as source of truth; use SkillRegistry for canonical records. `services/kernel/src/skill_manager.rs`, `crates/skills/src/lib.rs`
- Wire ArtifactRegistry into kernel for persistence and querying; stop relying on in-memory `JournalLedger` for artifact lists. `services/kernel/src/journal_ledger.rs`, `crates/control/artifact-registry/src/lib.rs`
- Proxy or migrate workflow validate/compile endpoints into kernel to establish a single control-plane API surface. `apps/api/src/main.rs`
