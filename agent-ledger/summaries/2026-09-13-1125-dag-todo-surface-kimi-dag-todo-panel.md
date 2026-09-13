# Attestation — session/dag-todo-surface (PR #476)

**When:** 2026-09-13 ~10:45–11:25 local · **Agent:** kimi-code · **Branch:** `session/dag-todo-surface` · **Merged:** `e61324ff1a1dc24d2bcb1016b0b82af7ea31ba4d` · **DAG:** `dag_488107` / `wih_1220` (closed + vaulted)

## What was done

Built the DAG todo surface (approved plan, wih_1220): the CommRails WIH DAG is now the visible todo system in gizzi-code. Five commits:

1. `feat(commrails)` — `node add` subcommand (ergonomic sub-todo creation through the gate) + `active_wihs()` pub helper with pickup→close lifecycle test.
2. `feat(api)` — `GET /api/commrails/dags?view=mine|ready|all` (per-dag node trees, ready/done counts, active WIHs with assignees); real `/wihs` GET replacing the stub.
3. `feat(api)` — `POST /api/commrails/plan/from-text` (title + todos with depth/done → nested plan; validated, 200 cap; depth-stack parenting).
4. `feat(gizzi-code)` — approved plans auto-publish to the DAG on ExitPlanMode (peer mode only; parsed from plan file; bounded 1.5s race; tool_result + AppState note).
5. `feat(gizzi-code)` — `RailsTaskList` TUI panel under `TaskListV2`: same glyphs/collapse/maxDisplay language, frontier-first ordering, ≤3-depth indentation, fed by a 3s `dags?view=mine` poller via a null-render bridge.

## Verification evidence

- `cargo test -p allternit-commrails` 6/6 (incl. new test); api integration tests 20/20; `cargo check/build -p allternit-api` clean.
- `bun run typecheck` 0 err; `bun run test` **1300 pass / 0 fail** (106 files); 9 new `parsePlanTodos` unit tests.
- Live smoke vs Brain workspace: `dags?view=ready` → dag_505836 with 39 ready nodes; `plan/from-text` round-trip verified nesting + DONE flags + 400s.
- Headless ink render smoke against live DTO — caught and fixed a real crash on a legacy lowercase `done` status (statuses now defensive).
- Release lock: `node scripts/release-preflight.mjs` → **35 passed, 0 failed**; gizzi-code production bundle build (`script/build-production.js`, rule 4) green.

## Incidents / honest deferrals

- Panel is read-only v1 — pickup/close stay CLI commands (gate stays the only write path). UI write-back is the natural v2.
- `view=mine` is empty until a node is actually picked up by a peer — the panel appears once rails work exists; verified behavior, worth knowing when demoing.
- Subagent OAuth network failure mid-task (auth.kimi.com ENOTFOUND) — resumed, no state loss.
- Desktop rebuild (lifecycle step 8) skipped: production compile + preflight verified green; DMG rebuild adds nothing until the next desktop release is cut.
