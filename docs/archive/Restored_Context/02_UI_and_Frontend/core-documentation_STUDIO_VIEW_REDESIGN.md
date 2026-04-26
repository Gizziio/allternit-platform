# STUDIO_VIEW_REDESIGN.md

Studio views redesigned strictly around existing backend capabilities. No UI should claim functionality that lacks a wired API.

## Builders View

### Agent Builder
Backend registry:
- `AgentRegistry` (`services/kernel/src/agent_registry.rs`) with `GET /v1/agents/templates` (`services/kernel/src/main.rs`).

API actions (existing + required additions):
- Exists: `GET /v1/agents/templates`
- Add: `POST /v1/agents/templates` (create), `PUT /v1/agents/templates/:id` (update), `POST /v1/agents/templates/:id/validate` (schema check) in `services/kernel/src/main.rs`.

Save/Test behavior:
- Save: validate + persist `AgentSpec` to `agents.json` via `AgentRegistry`.
- Test: remove until a real agent runtime exists (current kernel exposes `POST /v1/intent/dispatch`, but no agent binding is implemented).

UI changes (remove/rewire/add):
- Delete placeholder “AI Designer” chat box and “Ask” button until connected to a real runtime. `apps/shell/src/components/StudioView.tsx`
- Rewire “Save to Registry” to `POST /v1/agents/templates`.
- Rewire “Export Definition” to serialize the current `AgentSpec`.
- Remove or disable “Test” actions until runtime binding exists.

### Workflow Builder
Backend registry:
- Workflow engine and definition (`crates/orchestration/workflows/src/lib.rs`).
- Validation/compilation endpoints in `apps/api/src/main.rs` and `apps/api/src/routes.rs`.

API actions (existing + required additions):
- Exists (apps/api): `POST /api/v1/workflows/validate`, `POST /api/v1/workflows/compile` (`apps/api/src/main.rs`).
- Exists (apps/api): `GET /api/v1/local/workflows`, `POST /api/v1/local/workflows/{id}/execute` (`apps/api/src/routes.rs`).
- Add (kernel control-plane surface): `/v1/workflows/*` endpoints that proxy or unify the above.

Save/Test behavior:
- Save: validate + compile YAML into `WorkflowDefinition`; register with workflow engine.
- Test: execute workflow via `POST /api/v1/local/workflows/{id}/execute` (or kernel-proxied equivalent).

UI changes (remove/rewire/add):
- Replace the static “DAG Editor” placeholder with a YAML-backed or graph editor only after registry endpoints exist. `apps/shell/src/components/StudioView.tsx`
- Rewire “Save Version” to compile + register workflow.
- Rewire “Run Workflow” to execute endpoint; remove until execution is wired.

### Tool Builder
Backend registry:
- ToolGateway `ToolDefinition` (`crates/kernel/tools-gateway/src/lib.rs`) as canonical tool registry.
- Kernel `list_tools` is currently derived from `ToolExecutor` (`services/kernel/src/main.rs`, `services/kernel/src/tool_executor.rs`).

API actions (existing + required additions):
- Exists: `GET /v1/tools` (kernel).
- Add: `POST /v1/tools` (register ToolGateway definition), `PUT /v1/tools/:id` (update), `POST /v1/tools/:id/test` (execute via ToolGateway).

Save/Test behavior:
- Save: persist ToolGateway `ToolDefinition`.
- Test: execute through ToolGateway (policy-gated).

UI changes (remove/rewire/add):
- Rewire “Save to Registry” to ToolGateway registry.
- Rewire “Test Tool” to ToolGateway execution.
- Add validation of input schema before save (ToolGateway already has schema fields).

### Skill Builder
Backend registry:
- Skill registry and model (`crates/skills/src/lib.rs`).
- Kernel `SkillManager` (`services/kernel/src/skill_manager.rs`) is metadata-only.

API actions (existing + required additions):
- Exists: `GET /v1/marketplace/skills`, `POST /v1/marketplace/install/:id` (`services/kernel/src/main.rs`).
- Add: `POST /v1/skills` (register Skill), `PUT /v1/skills/:id` (update), `POST /v1/skills/:id/test` (execute via workflow engine).

Save/Test behavior:
- Save: persist `Skill` (manifest + workflow) to registry.
- Test: execute skill workflow via `WorkflowEngine` with ToolGateway execution.

UI changes (remove/rewire/add):
- Rewire “Save to Registry” to the skill registry.
- Remove “Test Skill” until execution is wired through workflow engine and ToolGateway.

## Pipelines View

Backend capability:
- ComfyUI is an external service with embed via `iframe`. `apps/shell/src/components/StudioView.tsx`
- ComfyUI manifest exists as a `MiniAppManifest`. `apps/shell/public/marketplace/comfyui-capsule.json`, `apps/shared/contracts.ts`
- Vite proxy for ComfyUI exists at `/api/comfyui`. `apps/shell/vite.config.ts`

Pipeline abstraction (minimal, existing-type based):
- Treat pipelines as `MiniAppManifest` entries (iframe view + actions).
- Register pipeline tools in ToolGateway for agent/workflow invocation.

UI changes (remove/rewire/add):
- Remove “Save Graph” until a real ComfyUI API integration is wired.
- Keep “Open ComfyUI” but label as external; add “Status” indicator based on availability.
- Add a registry list of pipeline manifests rather than a single hardcoded iframe.

## Artifacts View

Backend capability:
- Kernel artifacts are in-memory (`services/kernel/src/journal_ledger.rs`) with `GET /v1/artifacts/:artifact_id`.
- Persistent artifact registry exists in `crates/control/artifact-registry/src/lib.rs` but is unwired.

Required endpoints:
- `GET /v1/artifacts` (list/filter)
- `POST /v1/artifacts/query` (search)
- `GET /v1/artifacts/:id` (detail)
- `POST /v1/artifacts` (register/persist)

UI changes (remove/rewire/add):
- Replace static category cards with a real artifact list and filters.
- Link artifacts to session/run IDs and source primitive (agent/workflow/pipeline).

## Templates View

Backend capability:
- Agent templates via `AgentRegistry`. `services/kernel/src/agent_registry.rs`
- Workflow templates via YAML schemas. `crates/orchestration/workflows/src/templates/mod.rs`, `crates/orchestration/workflows/src/engine/compiler.rs`
- Pipeline templates via `MiniAppManifest`. `apps/shared/contracts.ts`

Required endpoints:
- `GET /v1/templates` (list, type-filtered)
- `POST /v1/templates` (create)
- `POST /v1/templates/:id/instantiate` (create agent/workflow/pipeline entries)

UI changes (remove/rewire/add):
- Remove placeholder template cards until backed by registry data.
- Add instantiate actions that create real registry entries.

## Global Cleanup
- Remove or de-emphasize the duplicate DOM Studio view in `apps/ui/src/views/StudioView.ts` until it is wired to the same APIs as the React shell.
