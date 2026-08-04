# Automation Tasks (iOS) — Phase 3: Loops

## Context (already researched — do not re-derive)

You just finished Phase 2 (Routines) in this same worktree/branch (`docs/AUTOMATION_TASKS_PHASE_2_NOTES.md` — read it, it documents the exact conventions you already established and that this phase must match). This is Phase 3: **Loops only**. Do NOT build Goals — that remains a separate future phase.

## Backend — no changes needed, already exists

`cmd/gizzi-code/src/runtime/server/routes/automations.ts` (same file as Routines):

- `LoopCreateSchema` (lines ~33-38): `{ id?, agent_id?, command, exit_condition?, max_iterations?: number (default 10) }`
- `LoopUpdateSchema` (lines ~40-46): `{ agent_id?, command?, exit_condition?, max_iterations?, state? }` — all optional.
- `GET /v1/automations/loops` — bare array, no envelope.
- `POST /v1/automations/loops` — inserted row shape: `{ id, agent_id, command, exit_condition, max_iterations, iteration_log: [], state: "running", time_created, time_updated }`. **Important difference from Routines**: the server calls `LoopEngine.startLoop(loop.id)` immediately on creation (fire-and-forget) and the initial `state` is `"running"`, not `"defined"` — a loop starts executing the moment it's created, there is no separate "create then run" step like Routines has. Returns the created row, 201.
- `PUT /v1/automations/loops/:id` — returns `{ success: true }` only, same asymmetry as Routines' `PUT`.
- `DELETE /v1/automations/loops/:id` — returns `{ success: true }`.
- `POST /v1/automations/loops/:id/run` — restarts a stopped/finished loop (sets `state: "running"`, calls `LoopEngine.startLoop(id)` again). Returns `{ success: true, state: "running" }`.

No `GET /loops/:id` or runs/history endpoint — same as Routines: detail view works from the already-fetched list item, whole-list refetch after mutations.

Loop row fields you have not seen on Routine: `command` (string, the shell command executed each iteration — this is the loop's one required creation field, analogous to Routine's `name`), `exit_condition` (optional string, human-readable condition checked between iterations), `max_iterations` (number, defaults to 10 if omitted), `iteration_log` (array — read `LoopEngine`'s source in `cmd/gizzi-code/src/runtime/automation/loop-engine.ts` to confirm its actual element shape before modeling it in Swift; do not guess the shape).

## What to build — mirror your own Phase 2 pattern exactly

Sibling files to what you already built for Routines:
- `Core/API/Models/Loop.swift`
- `Core/API/LoopsClient.swift`
- `Core/LoopStore.swift`
- `Features/Automation/Views/LoopsListView.swift`
- `Features/Automation/Views/LoopDetailView.swift`
- `Features/Automation/Views/CreateLoopSheet.swift`

Loop-specific differences from Routines (do not copy blindly):
- Create form's one required field is `command` (a shell command, monospaced field — reuse the same visual pattern you used for Routine's step-command fields), with optional `exit_condition` and `max_iterations` (numeric, default 10 — use a stepper or numeric field, not free text, since the backend field is a number).
- No separate "Run Now" action needed at creation time — a loop starts running the instant it's created (unlike a Routine, which is created inert and only starts via explicit Run). The detail view's Run action is really "restart" (only meaningfully enabled once the loop has stopped/finished — check `state` before treating Run as available, though the endpoint itself doesn't reject a redundant call).
- Detail view shows the iteration log (whatever shape you find in `loop-engine.ts`) in place of Routine's step list.

## Nav wiring — extend, don't duplicate

You already added `AutomationKind` (`.cron`, `.routines`) to `Core/AppMode.swift` and wired a segmented `Picker` into both `AutomationTasksListView.swift` and `RoutinesListView.swift`, switching in `ChatView.swift`'s `.automation` case. Extend this cleanly:
- Add `.loops` as a third `AutomationKind` case.
- Add the third case to `ChatView.swift`'s switch.
- Add `.loops` to the `ForEach(AutomationKind.allCases...)` picker — since both existing list views already iterate `AutomationKind.allCases`, the segmented control should pick up the third option automatically once the enum has three cases; verify this is actually true by reading your own existing code rather than assuming, and adjust both pickers only if they don't already generalize.

## Constraints (same as Phase 2)

- Swift only. No backend changes.
- Do not touch Goals — separate future phase.
- No git operations (no commit/push) — the orchestrator handles that.
- No builds/xcodebuild/simulator runs.
- Match repo idiom exactly as you already established it in Phase 2 — you are your own best reference now.
- Do NOT edit `docs/SURFACE_AUDIT_PROGRESS.md` or `docs/SURFACE_AUDIT_SESSION_PROGRESS.md`.

## Deliverable

When finished, write `docs/AUTOMATION_TASKS_PHASE_3_NOTES.md` with the same YAML-frontmatter + prose format you used for Phase 2's notes file (`status`, `files_changed`, `deviations`, `remaining`, then prose — including the exact `iteration_log` shape you found in `loop-engine.ts` and how you modeled it).

That file existing = done.
