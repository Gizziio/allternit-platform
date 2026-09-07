# Steering checkpoint

## Goal
Port three Grok CLI features into gizzi-code (worktree `allternit-session-7631feda`, branch `session/7631feda-bbb5-492f-97cf-55f243eda42d`, repo `~/Desktop/allternit-workspace/allternit`):
1. `/session-info` presentation (Grok aliases `/status`, `/info`) — auth method, turns, copy support — **CODE DONE + COMMITTED (b8675f9ce)**
2. Agent dashboard `/dashboard` — full Grok parity, in-process first, hybrid-ready source design — Phase 4 CODE DONE (typecheck running)
3. `/settings` polish — effort row added (vim already existed as "Editor mode") — **CODE DONE + COMMITTED (b8675f9ce)**

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_7631feda-bbb5-492f-97cf-55f243eda42d/agents/main/plans/icon-kate-bishop-nightwing.md

## Just did (Phase 4 — NOT yet committed)
- `dashboard/types.ts`: `DashboardRow`, `DashboardSessionState`, `DashboardPeek`, `DashboardSource` interface (list/peek/reply/dispatch/stop/remove/rename/setPinned) with comment documenting the future ServerDashboardSource mapping over `gizzi serve` routes.
- `dashboard/topLevelSession.ts`: spawn/reply/stop/remove/rename/pin runner. Dashboard sessions ARE main-session `local_agent` tasks via `registerMainSessionTask`; own multi-turn loop adapted from `LocalMainSessionTask.startBackgroundSession` :339-477 (stream events → runner.messages + per-event `recordSidechainTranscript` + progress via updateTaskState `{tokenCount,toolUseCount,recentActivities}`), PLUS `drainPendingMessages` between turns for follow-ups. Deliberately NOT `startBackgroundSession` (single-shot) and NOT `completeMainSessionTask` (trims messages to last one — breaks peek/reply). Own finalize: status completed/failed + endTime, keeps full messages, notifies via `enqueuePendingNotification` task-notification XML (natural completion only, not on cancel). Stop = `cancelRequested` flag checked per event (break → generator return → graceful), killAsyncAgent when idle. Remove cancels-if-running + drops from state.tasks + registry. Pin persisted in GlobalConfig additive `dashboard.pinned` key via saveGlobalConfig (config.ts is @ts-nocheck). queryParams may be a Promise (REPL builders async) — awaited at turn start so dispatch is sync for the UI.
- `dashboard/InProcessSource.ts`: `InProcessDashboardSource implements DashboardSource` over `{getAppState, setAppState, buildQueryParams, getMainRow?}`. State mapping: running→working, completed→completed, failed/killed→failed, task-missing→inactive (registry fallback row). activityLine from progress (`LastTool · N tools · N.Nk tok`). dispatch defaults model/permissionMode from appState, directory from `getCwdState()`.
- `screens/DashboardScreen.tsx`: functional screen (replaces Phase 3 skeleton): live rows via `useAppState()` subscribe + `source.list()` in render; sort pinned → state → updatedAt; state glyphs ●(working/needs-input warning, completed success, failed error) ○(idle/inactive); dispatch input (Tab focus, Enter dispatch+stay, Ctrl+S dispatch→list, Esc blur); x = stop working / arm-then-remove idle (2s window); p pin; dashboard:exit keybinding gated `isActive: focus==='list'` so input claims Esc first.
- REPL.tsx: imports `getCwdState` (bootstrap/state) + `InProcessDashboardSource`; `buildDashboardQueryParams` useCallback mirroring handleBackgroundQuery (:2690-2738); `dashboardSource` useMemo (store.getState/setAppState/buildDashboardQueryParams/getMainRow synthetic 'main' leader row — state 'idle' until Phase 5 wires live isLoading); `<DashboardScreen source={dashboardSource}/>` in the dashboard branch.

## Gotchas learned
- Vendored ink `Event` has NO preventDefault — claim keys with `event.stopImmediatePropagation()`.
- `getAPIProvider` lives in `utils/model/providers.js`, NOT `utils/auth.js`.
- LocalAgentTask is a .tsx (not .js); framework is utils/task/framework.ts. `drainPendingMessages(taskId,getAppState,setAppState)` returns string[] and clears the queue.
- Dashboard context single-char chords (q) fire on any keypress — MUST gate exit bindings with isActive when an inner input is focused.
- Dev `bun run dev exec ...` fails in this shell (pre-existing HEAD/env issue, affects untouched commands too). Interactive verification via tmux-driven `bun run dev` TUI is the path (Phase 6).

## Next
- Phase 4 verify: typecheck (task bash-11dpst4f), fix if needed, commit + push (steering commit-gate applies).
- Phase 5: full UI parity in `components/dashboard/` + DashboardScreen: peek panel (last response ≤3 lines, reply box, Ctrl+S reply+open), needs-input detection (wrap canUseTool in dashboard queryParams or read toolUseConfirmQueue), idle folding (8 freshest + 1h), Ctrl+G grouping, Ctrl+/ search (a:, s:, # prefixes), Ctrl+R rename, Ctrl+T pin, Shift+↑/↓ reorder (persist `dashboard.reorder`), details/attach view reusing Messages, Esc ladder (search→peek→filter→dispatch→unselect→exit), `?` cheatsheet, main-row live state via isLoading.
- Phase 6: docs + CHANGELOG, `bun run test` (ci-smoke), tmux full smoke (dispatch 2 sessions, peek/reply, states flip, rename/pin/search, stop/delete, Ctrl+\ toggle, Esc exits), ledger summary after merge.

## Open questions
- Whether main-session dashboard tasks get auto-evicted from state.tasks while dashboard is open — testing will tell; registry fallback keeps the row visible, reply-to-evicted no-ops in v1 (returns false).
- Ctrl+\ chord `'ctrl+\\'` assumes terminal maps 0x1c → '\\' (standard); /dashboard slash command is the primary path regardless.
