# allternit-runtime-api Phase 2 — Cloud Agents turn lifecycle (rq-20260910-002)

- **Date:** 2026-09-10
- **Agent:** grok orchestrator (CLI executors quota-blocked: kimi 5h, Codex until 2026-09-16, Claude logged out, agy individual cap)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/286 · merge commit `de9a497f1ef9e706abd8b1054e4b13007bbd75ff`

## What landed

Cloud Agents Phase 2 of `Research/specs/allternit-runtime-api.md` (Phase 1 already on main as #274):

- `POST /beta/work/:id/ack` on a session-linked task writes stored `turn_completed` + `session_idle`.
- `POST /beta/work/:id/stop` writes `turn_failed` + `session_idle`.
- Public facade translates those to `turn.completed` / `turn.failed` / `session.idle`.
- `GET /api/v1/sessions/:id/turns` lists turns from `turn.*` events.
- TS `Allternit.sessions.turns.list`; Python `sessions.turns(session_id)`.
- Stored `beta_sessions.status` still `active|archived`. Public `idle` still derived from no in-flight work.

## Verification

- `cargo test -p allternit-api --lib cloud_agents_routes beta_work_routes` → 13 passed.
- GitHub Actions on #286: Desktop vitest, typecheck/build, gitleaks, typography, SW cache bump — success.

## Incidents

- Implemented in grok after all CLI executors were quota-blocked.
- Vercel + Cloudflare Pages Git auto-deploys failed (same class as #267–#275). Not required checks.

## Honest deferrals

- Sandbox entitlement, vaults, brains column, schedules, tool_search — later Cloud Agents leftovers (new named approve).
- Session dollar budget parked (money-adjacent).
- Interrupt still does not emit `turn.failed`; an open turn may list as `running` after interrupt (MAP-locked).
- Bot Agents BA-* not in this PR.
- Desktop binary not rebuilt (API/SDK/docs).
