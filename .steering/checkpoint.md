# Steering checkpoint

## Goal
Port three Grok CLI features into gizzi-code (worktree `allternit-session-7631feda`, branch `session/7631feda-bbb5-492f-97cf-55f243eda42d`, repo `~/Desktop/allternit-workspace/allternit`):
1. `/session-info` presentation (Grok aliases `/status`, `/info`) — auth method, turns, copy support — **CODE DONE**
2. Agent dashboard `/dashboard` — full Grok parity, in-process first, hybrid-ready source design — shell done, UI in progress
3. `/settings` polish — effort row added (vim already existed as "Editor mode") — **CODE DONE**

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_7631feda-bbb5-492f-97cf-55f243eda42d/agents/main/plans/icon-kate-bishop-nightwing.md

## Just did (through Phase 3)
- Phase 0: worktree created off main HEAD `0b63ee1bf`; deps installed with **pnpm** (bun install does NOT work for this pnpm workspace — @tsconfig/bun missing). Baseline typecheck green.
- Phase 1 (done): `commands/status/index.ts` aliases `['info','session-info']`; `utils/statusModel.ts` += `getAuthMethodDescription()` (3P-aware), `countUserTurns()`, SessionStatus fields `authMethod`/`turns`; `commands/status/status.tsx` --inline rows Auth/Turns/Requests; `components/Settings/Status.tsx` Turns row + auth fallback + copy: `c`=session id, `y`=whole block, click Session ID row; hint footer with copied feedback; `Settings.tsx` passes `isActiveTab={selectedTab==='Status'}`.
- Phase 2 (done): `components/Settings/Config.tsx` Effort enum row (low/medium/high/max → userSettings.effortLevel, event `tengu_effort_setting_changed`).
- Phase 3 (done): `screen` moved into AppState (`state/AppStateStore.ts` new `Screen` type + `screen` field default 'prompt'; re-exported via `state/AppState.tsx`; REPL.tsx:858 useState → useAppState-backed `setScreen` wrapper accepting SetStateAction; `export type Screen = AppStateScreen` in REPL for compat). REPL dashboard early-return branch after transcript branch (~line 4846) renders `<AlternateScreen><KeybindingSetup><GlobalKeybindingHandlers/><DashboardScreen/></KeybindingSetup></AlternateScreen>`. `screens/DashboardScreen.tsx` skeleton created (overlay 'dashboard', dashboard:exit keybinding). `keybindings/defaultBindings.ts`: Global `'ctrl+\\': 'app:toggleDashboard'` + `Dashboard` context block (ctrl+\, escape, q → dashboard:exit). `hooks/useGlobalKeybindings.tsx`: `handleToggleDashboard` gated `isActive: screen !== 'dashboard'` (prevents both-handlers-fire toggle-back-in). `commands/dashboard/{index.ts,dashboard.tsx}` created (local-jsx, immediate, aliases `['agents-dashboard','sessions']`, sets AppState.screen, non-interactive → text fallback); registered in `commands.ts` (import after dash, entry after dash; NOT in REMOTE_SAFE/BRIDGE_SAFE — status isn't either).

## Gotchas learned
- Vendored ink `Event` has NO preventDefault — claim keys with `event.stopImmediatePropagation()`.
- `getAPIProvider` lives in `utils/model/providers.js`, NOT `utils/auth.js`.
- Tabs component mounts ALL tab children (hidden), so key handlers in Status tab must be gated with isActiveTab.
- Dev `bun run dev exec ...` fails in this shell ("Error: Unknown"; with --model: "No API-key provided") — pre-existing HEAD/env issue, affects untouched commands too (e.g. /dash). NOT caused by our edits. Interactive TUI verification via tmux is the path (not yet attempted).
- typecheck takes ~2-4 min; `bun run typecheck` in cmd/gizzi-code.

## Next
- Phase 3 verify: typecheck (running as task bash-evf34z5k), then commit phases 1–3 (steering gate applies), then tmux smoke: launch `bun run dev` TUI, run `/dashboard`, Esc exits, Ctrl+\ toggles.
- Phase 4: `dashboard/types.ts` (DashboardRow + DashboardSource interface, document future ServerDashboardSource over gizzi serve routes), `tasks/TopLevelSession/` state + spawn (model on LocalAgentTask.registerAsyncAgent :467 + runAgent :249; own sessionId, sidechain transcript, title from prompt), AppState `topLevelSessions` registry, `dashboard/InProcessSource.ts` incl. synthetic main-session leader row; state machine working/idle/needs-input(wrapped canUseTool)/completed/failed; eviction per STOPPED_DISPLAY_MS.
- Phase 5: full UI in `components/dashboard/` per plan (rows, peek, dispatch, search, grouping, rename/pin/stop, details view, Esc ladder, cheatsheet, persistence via saveGlobalConfig `dashboard` key).
- Phase 6: docs/CHANGELOG, smoke tests, tmux verification, ledger summary.

## Open questions
- Ctrl+\ chord representation `'ctrl+\\'` assumes terminal maps 0x1c → '\\' (standard); /dashboard slash command is the primary path regardless.
