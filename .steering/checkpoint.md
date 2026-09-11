# Steering checkpoint — session/console-be-p2

## Goal
Backend build-out Phase 2: agents hardening (G4–G5) — PATCH /agents/:id, first-class is_bot column + backfill, agent_versions snapshot table, toolset mutation endpoints with per-tool permissions (always_allow|always_ask|auto), and enforcement of session permission modes through the work-task enqueue/lease path (integrate with the existing approvals flow, never a second one).

## Just did
- V143__agent_hardening.sql: agents.is_bot/tool_permissions/mcp_connector_ids columns, agent_versions table, json_extract backfill of is_bot from config blob (isBot + is_bot spellings).
- agent_routes.rs: shared AGENT_SELECT/read_agent_row/load_agent_row/snapshot_agent_version; AgentRow gains is_bot/tool_permissions/mcp_connector_ids; list ?is_bot filter; create writes column + echoes is_bot; update_agent refactored to shared apply_agent_update (writes is_bot column + config blob, snapshots); new PATCH handler (404 on unknown/unowned); toolset GET returns tool_permissions map (default auto) + mcp_connector_ids; new PUT toolset with validation (400 on bad permission value / unknown tool / unknown mcp connector) + snapshot.
- cloud_agents_routes.rs: compute_effective_permissions (always_allow→all allow, always_ask→all ask, auto→per-tool map, unset=allow) stored in beta_sessions.metadata at create; echoed as session.effective_permissions.
- beta_work_routes.rs: lease payload gains optional effective_permissions from session metadata.
- beta_session_routes.rs: tool_calls events gated at write time — requires_approval flag + per-call approval_id, enqueued in the existing permission_policy::ApprovalStore; module docs state the enforcement boundary (payload+flag for external workers, in-process gating at event write).
- Tests: 9 new in agent_routes (patch/snapshot/is_bot filter/toolset 400s/V143 backfill against real SQL), 5 new in cloud_agents_routes (effective permissions modes, lease payload, event gating).

## Next
- PR + attest + cleanup per session lifecycle (verification complete: full suite 910 passed / only the 5 known pre-existing env failures; live smoke green; release-preflight 35/0).

## Open questions
- Resolved: per-tool permissions stored as JSON column `agents.tool_permissions` (matches tools/allowed_tools shape; map is small, read whole, never queried by key).
- Resolved: approvals integration point is flag + ApprovalStore enqueue at event-write time; no tool-call-specific enqueue hook exists in the approvals system.
