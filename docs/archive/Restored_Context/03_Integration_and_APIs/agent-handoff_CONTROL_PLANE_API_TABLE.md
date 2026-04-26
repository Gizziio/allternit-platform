# CONTROL_PLANE_API_TABLE.md

Control-plane registry endpoints only; other `/v1/*` kernel endpoints are unchanged.

| Endpoint | Method(s) | Source of Truth | Notes |
| --- | --- | --- | --- |
| `/v1/agents/templates` | GET | AgentRegistry | List agent templates. |
| `/v1/agents/templates` | POST | AgentRegistry | Create template. |
| `/v1/agents/templates/:id` | PUT | AgentRegistry | Update template (id ↔ role). |
| `/v1/tools` | GET | ToolGateway | List derived to kernel tool schema. |
| `/v1/tools` | POST | ToolGateway | Register tool definition. |
| `/v1/tools/:id` | PUT | ToolGateway | Update tool definition. |
| `/v1/tools/:id/execute` | POST | ToolGateway | Policy-gated execution. |
| `/v1/actions/execute` | POST | ToolGateway | Legacy execute alias (returns output only). |
| `/v1/skills` | GET | SkillRegistry | Registry-backed list. |
| `/v1/skills` | POST | SkillRegistry | Register skill (publisher key required). |
| `/v1/skills/:id` | PUT | SkillRegistry | Update skill (register new version). |
| `/v1/skills/:id/execute` | POST | WorkflowEngine + ToolGateway | Phase 1 stub. |
| `/v1/workflows` | GET | WorkflowEngine | Proxy → `/api/v1/local/workflows`. |
| `/v1/workflows` | POST | WorkflowEngine | Phase 1 stub (no write API yet). |
| `/v1/workflows/:id/execute` | POST | WorkflowEngine | Proxy → `/api/v1/local/workflows/:id/execute`. |
| `/v1/workflows/validate` | POST | YamlValidator | Proxy → `/api/v1/workflows/validate`. |
| `/v1/workflows/compile` | POST | YamlCompiler | Proxy → `/api/v1/workflows/compile`. |
| `/v1/templates` | GET | AgentRegistry | Workflows/pipelines empty in Phase 1. |
| `/v1/templates` | POST | Underlying registry | Phase 1 stub. |
| `/v1/templates/:id/instantiate` | POST | Underlying registry | Phase 1 stub. |
| `/v1/artifacts` | GET | ArtifactRegistry | Phase 1 stub. |
| `/v1/artifacts` | POST | ArtifactRegistry | Phase 1 stub. |
| `/v1/artifacts/query` | POST | ArtifactRegistry | Phase 1 stub. |
| `/v1/artifacts/:id` | GET | JournalLedger | Transitional; not persistent. |
| `/v1/marketplace/skills` | GET | SkillManager | Legacy listing alias. |
| `/v1/marketplace/install/:id` | POST | SkillManager | Legacy install alias. |
