---
status: done
files_changed:
  - cmd/allternit-api/migrations/V141__cloud_agents_brain.sql
  - cmd/allternit-api/src/beta_session_routes.rs
  - cmd/allternit-api/src/cloud_agents_routes.rs
  - cmd/allternit-api/src/allternit_vault.rs
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/types.ts
  - docs/public/api/sessions.md
  - docs/public/api/agents.md
  - docs/CLOUD_AGENTS_MAP.md
  - docs/CLOUD_AGENTS_PHASE_3_TASK.md
deviations:
  - Implemented in grok (CLI executors still quota-blocked).
  - Vault credential subroutes stay on `/beta/vaults/...`; only CRUD is aliased to `/vaults`.
  - Vault bind checks `created_by = caller`, not organization membership (session tests have no org).
verification:
  - cargo test -p allternit-api --lib cloud_agents_routes: 12 passed
  - cargo test -p allternit-api --lib beta_session_routes: 17 passed
remaining:
  - Sandbox entitlement / hosted-runtime provision
  - computer.kind fabric|desktop workers
  - Outputs, schedules, tool_search, permission policies
  - Dollar budget (parked)
  - Bot Agents BA-*
brain_updates:
  - Cloud Agents session create validates `brain_id` against `brains` and `vault_ids` against `allternit_vaults`. Public session JSON includes `brain_id` and `vault_ids`. `/api/v1/vaults` aliases `/api/v1/beta/vaults` CRUD.
---

# Cloud Agents Phase 3 — notes

Brain attach and vault ids are first-class on Cloud Agent sessions. Unknown ids return 400. V141 adds `beta_sessions.brain_id`.
