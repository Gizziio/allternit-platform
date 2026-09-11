# allternit-runtime-api Phase 1 — Cloud Agents public sessions (rq-20260910-002)

- **Date:** 2026-09-10
- **Agent:** grok orchestrator; kimi executor in tmux `ao-allternit-runtime-api`; review/land in grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/274 · merge commit `20b101ebb79c41a15c7e7c064b9f7e82b2148635`

## What landed

Cloud Agents Phase 1 of `Research/specs/allternit-runtime-api.md`:

- Public `/api/v1/sessions` facade over `beta_sessions` (`cloud_agents_routes.rs`). Product name **Allternit Agents**, not Runtime. No public `/runtimes`.
- Inline agent create (`instructions` → `system_prompt`), `computer.kind` `none|local|sandbox` (sandbox is 400 this release), send `user.message|interrupt|tool_result`, archive, SSE.
- Allternit event names on read (`session.created`, `computer.ready`, `turn.started`, …). Stored rows keep legacy snake_case.
- Public `idle`/`running` derived from in-flight `beta_work_tasks`; `beta_sessions.status` stays `active|archived` (V36 CHECK).
- `agents.version` + `POST /agents/:id/archive` (V140).
- TS `@allternit/sdk/cloud-agents` class `Allternit`; Python `allternit.Allternit`.
- `/api/v1/beta/sessions` alias kept. Completions/Responses (`agents_v1_routes.rs`) untouched.

## Verification

- Orchestrator review vs MAP. Fixes before PR: computer event projection, unique ids on dual `run_requested` events, SDK path under `src/ai-runtime/cloud-agents/`, two Rust move-after-use errors, test GET quoting a JSON id.
- `cargo test -p allternit-api --lib cloud_agents_routes` → 7 passed.
- Python `py_compile` + bun bundle of the TS client: ok.
- GitHub Actions on #274: Desktop vitest, typecheck/build, gitleaks, typography, SW cache bump — success.

## Incidents

- First executor was Claude (OAuth expired), then kimi. Land-time: kimi 5h quota + Codex weekly limit; Phase 2 continues on agy in `ao-allternit-runtime-api-p2`.
- PR was CONFLICTING vs main (20 commits, including #275). Merged `origin/main` into `ao/allternit-runtime-api` (conflict only `.allternit/shared-context.md`, both appends kept) as `44c6884c3`, then merged.
- Phase 2 uncommitted MAP/TASK stashed around the merge and restored; worktree kept.
- Vercel + Cloudflare Pages Git auto-deploys failed (same class as #267–#275). Not required checks.

## Honest deferrals

- Phase 2 in flight: `turn.completed` / `session.idle` when a work task is acked; `GET /sessions/:id/turns`.
- Sandbox entitlement / hosted-runtime provision, vaults, brains column, schedules, tool_search, dollar budget — later Cloud Agents leftovers. Dollar budget parked (money-adjacent).
- Bot Agents BA-* not in this PR.
- Desktop binary not rebuilt (API/SDK/docs only).
