---
status: done
files_changed:
  - cmd/allternit-api/src/beta_session_routes.rs
  - cmd/allternit-api/src/beta_work_routes.rs
  - cmd/allternit-api/src/cloud_agents_routes.rs
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/client.ts
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/types.ts
  - sdk/allternit-python/src/allternit/sessions.py
  - docs/public/api/sessions.md
  - docs/public/api/agents.md
  - docs/CLOUD_AGENTS_MAP.md
  - docs/CLOUD_AGENTS_PHASE_2_TASK.md
  - .allternit/shared-context.md
deviations:
  - Implemented in the grok orchestrator session: kimi 5h quota, Codex weekly limit until 2026-09-16, Claude CLI logged out, agy individual quota ~168h.
  - Python uses `sessions.turns(session_id)` as the MAP specified (method, not a nested `.turns.list` object). TypeScript uses `sessions.turns.list(sessionId)`.
remaining:
  - Sandbox entitlement, vaults, brains column, schedules, tool_search, dollar budget (parked).
  - Interrupt still does not emit `turn.failed`; open turns may list as `running` after interrupt (MAP-locked).
verification:
  - cargo test -p allternit-api --lib cloud_agents_routes beta_work_routes: 13 passed.
brain_updates:
  - Cloud Agents sessions return to public `idle` when the linked `beta_work_tasks` row is acked; that writes stored `turn_completed` + `session_idle`, translated on read. `GET /api/v1/sessions/:id/turns` lists turns derived from `turn.*` events.
---

# Cloud Agents Phase 2 — notes

Work-task completion now closes the public session lifecycle. `POST /beta/work/:id/ack` (success) and `POST /beta/work/:id/stop` (cancel/fail) call `emit_turn_terminal` when the task has a `session_id` and the session is not archived. Stored `beta_sessions.status` is still `active|archived`. Public `idle` follows from no in-flight work plus the new events.

`GET /sessions/:id/turns` folds `turn.started` / `turn.completed` / `turn.failed` from the public event list. SDK: TS `Allternit.sessions.turns.list`, Python `Allternit.sessions.turns`.
