# allternit-runtime-api Phase 3 — brain attach + vaults alias (rq-20260910-002)

- **Date:** 2026-09-10
- **Agent:** grok (CLI executors still quota-blocked)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/289 · merge commit `44c9c85897eefec272ffca4faa68972d820abe86`

## What landed

- `brain_id` on session create validated against `brains`, stored on `beta_sessions.brain_id` (V141).
- `vault_ids` validated against `allternit_vaults` (`created_by` = caller). Unknown ids return 400.
- Public session JSON includes `brain_id` and `vault_ids`.
- `/api/v1/vaults` aliases `/api/v1/beta/vaults` CRUD. Credential subroutes stay on the beta path.

## Verification

- `cargo test -p allternit-api --lib cloud_agents_routes` → 12 passed
- `cargo test -p allternit-api --lib beta_session_routes` → 17 passed
- GitHub Actions on #289: Desktop vitest, typecheck/build, gitleaks, typography, SW cache bump — success

## Honest deferrals

- Sandbox entitlement, fabric/desktop workers, outputs, schedules, tool_search, permission policies
- Dollar budget parked
- Bot Agents BA-*
- Desktop binary not rebuilt
