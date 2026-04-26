# KERNEL_REGISTRY_IMPLEMENTATION_DIFF.md

## Task 0 wiring notes (pre-change)
- `/v1/agents/templates` GET in `services/kernel/src/main.rs` wired to `AgentRegistry` in `services/kernel/src/agent_registry.rs`.
- `/v1/tools` GET in `services/kernel/src/main.rs` listed `ToolExecutor` definitions from `services/kernel/src/tool_executor.rs` (desktop tools added in `services/kernel/src/embodiment/desktop.rs`).
- `/v1/marketplace/skills` + `/v1/marketplace/install/:id` in `services/kernel/src/main.rs` used `SkillManager` (`services/kernel/src/skill_manager.rs`).
- ToolGateway existed in `crates/kernel/tools-gateway/src/lib.rs` but was not the kernel’s registry source.
- Workflow API lived in `apps/api/src/routes.rs` and `apps/api/src/main.rs` (`/api/v1/local/workflows/*`, `/api/v1/workflows/validate`, `/api/v1/workflows/compile`).

## Files changed
- `services/kernel/Cargo.toml`: add registry/policy/gateway deps and `sqlx` any pool support.
- `crates/kernel/tools-gateway/src/lib.rs`: add SDK executor hook and `ToolType::Sdk` execution path.
- `services/kernel/src/tool_gateway_adapter.rs`: ToolExecutor → ToolGateway adapter.
- `services/kernel/src/intent_dispatcher.rs`: route all tool usage through ToolGateway.
- `services/kernel/src/main.rs`: unified control-plane endpoints + ToolGateway/SkillRegistry wiring.

## Endpoint changes
- `/v1/agents/templates`: add POST + PUT for registry writes.
- `/v1/tools`: list from ToolGateway; add POST/PUT; add `/v1/tools/:id/execute`.
- `/v1/actions/execute`: now routes through ToolGateway.
- `/v1/skills`: add GET/POST/PUT; add `/v1/skills/:id/execute` (Phase 1 stub).
- `/v1/workflows`: add GET/POST/execute; add `/v1/workflows/validate` + `/v1/workflows/compile` proxy.
- Workflow proxy base: `KERNEL_WORKFLOW_API_BASE` (default `http://localhost:3000`).
- `/v1/templates`: add GET/POST + `/v1/templates/:id/instantiate` (Phase 1 stubs).
- `/v1/artifacts`: add GET/POST + `/v1/artifacts/query` stubs; existing `/v1/artifacts/:id` remains transient ledger-backed.

## Registry sources per endpoint
- Agents: `AgentRegistry` (`services/kernel/src/agent_registry.rs`).
- Tools: `ToolGateway` (`crates/kernel/tools-gateway/src/lib.rs`); ToolExecutor registers local tools into ToolGateway at startup via `services/kernel/src/tool_gateway_adapter.rs`.
- Skills: `SkillRegistry` (`crates/skills/src/lib.rs`); legacy `/v1/marketplace/skills` still uses `SkillManager`.
- Workflows: proxied to apps/api (`apps/api/src/routes.rs`) in Phase 1.
- Templates: aggregated view from `AgentRegistry` (workflows/pipelines empty in Phase 1).
- Artifacts: stubs for registry endpoints; `/v1/artifacts/:id` still uses `JournalLedger` (`services/kernel/src/journal_ledger.rs`).
