# Cloud Agents Phase 2 task

Read `docs/CLOUD_AGENTS_MAP.md` first. It is the full analysis. This file is the only work you do. **Do not start Phase 3. Do not do sandbox, vaults, brains, schedules, or Bot Agents.**

You are in the allternit-platform worktree on branch `ao/allternit-runtime-api` (Phase 1 already committed). You cannot read `~/Desktop/Allternit/`. Everything you need is in the MAP + this task + existing Phase 1 code.

## Goal

When a Cloud Agent work task is acked, the session’s public status becomes `idle` and the event list includes `turn.completed` then `session.idle`. `GET /api/v1/sessions/:id/turns` lists those turns.

A caller can:

1. `POST /api/v1/sessions` with inline agent + `computer.kind=none` + `input` (already works; status `running`)
2. Worker `POST /beta/work/:id/ack` on that session’s task
3. `GET /sessions/:id` → `status: idle`
4. `GET /sessions/:id/events` includes `turn.completed` and `session.idle` (Allternit names, not `turn_completed`)
5. `GET /sessions/:id/turns` → one completed turn
6. TS/Python `Allternit.sessions.turns.list` (or Python `sessions.turns`) hits that route

## Implement exactly

Follow the MAP tables (work-task → events, translate, turns shape, files, do-not list).

Hard rules:

- Never wrap OpenAI or Anthropic paid agent APIs.
- Never add a public `/runtimes` resource.
- Never change `agents_v1_routes.rs`.
- Never rebuild Bot Agents.
- No git operations. No cargo/tsc as a required done step. No Docker. No Stripe. No deploys.
- Do not write `idle`/`failed` into `beta_sessions.status` (CHECK is `active|archived`). Public status stays derived from in-flight work.
- Docs: Register 1 — plain, no hype, no guarantees, no “drop-in OpenAI”.

Helper lives in `beta_session_routes.rs` next to `insert_event`. `ack_task` / `stop_task` in `beta_work_routes.rs` call it after a successful update, only when `session_id` is present.

Match repo idiom: Axum, `ApiError`, `spawn_blocking` + rusqlite. SDK: ESM TypeScript next to `src/ai-runtime/cloud-agents/client.ts`.

## Constraints

- No builds/typechecks/dev servers
- No git operations
- Do not edit files outside the MAP file list plus tests next to those modules
- Do not start Phase 3 / sandbox / Bot Agents

## Platform

If `.allternit/shared-context.md` exists, append `### allternit-runtime-api-p2 <ISO ts>` with a one-line milestone when you finish. (The path may be gitignored; still append if the file is there.)

## Done sentinel

When finished, write `docs/CLOUD_AGENTS_PHASE_2_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done | blocked
files_changed: []
deviations: []
remaining: []
brain_updates: []
---
```

Then prose notes. That file existing = done. Also `touch docs/CLOUD_AGENTS_PHASE_2_NOTES.sentinel` if you can.
