# allternit-runtime-api Phase 4 — leftover API + Computer Cloud (rq-20260910-002)

- **Date:** 2026-09-11
- **Agent:** grok (CLI executors quota-blocked)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/295 · merge `8788dd6b5d319bfb33cfb778f99452793fbbb18a`

## What landed

- Threads: `GET /sessions/:id/threads`; create `parent_thread_id`
- Outputs: `GET /sessions/:id/outputs` lists `session_files`
- Schedules: `/api/v1/schedules` aliases `/beta/deployments`
- Toolset: `GET /agents/:id/toolset` (`tool_search`/`mcp` not bound)
- Permission: `always_allow|always_ask|auto` recorded, not ACI-enforced
- `computer.kind` `sandbox` (ephemeral) and `desktop` (session-lived) provision **Computer Cloud / Cloud Desktop** (Incus/Tart), **not Fly**. No driver → 503, never silent `none`. `fabric` still 400.

## Verification

- `cargo test -p allternit-api --lib cloud_agents_routes` → 14 passed
- GitHub Actions on #295: Desktop vitest, typecheck/build, gitleaks, typography, SW cache — success

## Honest deferrals

- Live Incus/Tart driver not present in unit tests
- fabric kind 400 (follow-up: map to Computer Cloud)
- Dollar budget parked
- Bot Agents BA-* separate
- OpenAI/Anthropic shims non-goal
