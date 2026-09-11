---
status: done
files_changed:
  - cmd/allternit-api/src/cloud_agents_routes.rs
  - cmd/allternit-api/src/beta_session_routes.rs
  - cmd/allternit-api/src/beta_deployment_routes.rs
  - cmd/allternit-api/src/agent_routes.rs
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/client.ts
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/types.ts
  - sdk/allternit-python/src/allternit/sessions.py
  - docs/public/api/sessions.md
  - docs/public/api/agents.md
  - docs/CLOUD_AGENTS_MAP.md
deviations:
  - Outputs list session_files; there is no /workspace/outputs route.
  - Schedules alias beta/deployments (cron deployments), not a new scheduler.
  - tool_search/mcp/programmatic are false/[] on GET /agents/:id/toolset until a later bind.
  - permission is recorded, not enforced (ACI is Bot Agents).
  - sandbox/desktop provision Computer Cloud (Cloud Desktop). Tests without a VM driver expect 503. fabric stays 400.
remaining:
  - Live Computer Cloud provision still needs a configured Incus/Tart driver (unit tests assert 503 without one)
  - fabric kind still 400
  - Dollar budget (parked)
  - Bot Agents BA-*
  - OpenAI/Anthropic shims (non-goal)
brain_updates:
  - Cloud Agents leftovers shipped as public aliases/list surfaces: threads, outputs (session files), schedules (= beta deployments), agent toolset, session permission field. fabric/desktop/sandbox still 400.
---

# Cloud Agents Phase 4 — leftover API surface
