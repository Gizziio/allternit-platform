# Steering checkpoint

## Goal
Port three Grok CLI features into gizzi-code (worktree `allternit-session-7631feda`, branch `session/7631feda-bbb5-492f-97cf-55f243eda42d`):
1. `/session-info` presentation — DONE (b8675f9ce)
2. Agent dashboard `/dashboard` — full Grok parity, in-process first — CODE COMPLETE, functionally verified in tmux TUI (b8675f9ce, 07865f0d0, c2f807680, 9b307db69)
3. `/settings` polish — DONE (b8675f9ce)

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_7631feda-bbb5-492f-97cf-55f243eda42d/agents/main/plans/icon-kate-bishop-nightning-wing.md (name approximate — search plans/ dir if needed)

## Branch state (all pushed to origin)
- b8675f9ce Phases 1–3: /session-info (aliases info/session-info, auth+turns rows, copy c/y), /settings effort row, dashboard shell + /dashboard command + ctrl+\ binding
- 07865f0d0 Phase 4: dashboard/{types,topLevelSession,InProcessSource}.ts, functional DashboardScreen (dispatch/stop/pin), REPL wiring (buildDashboardQueryParams + dashboardSource)
- c2f807680 Phase 5: full UI — peek/reply, needs-input via canUseTool wrapper, search a:/s:/#, Ctrl+G grouping, idle folding + N-more, v details, ? cheatsheet, rename/pin/reorder (dashboard.pinned + dashboard.reorder in GlobalConfig), Esc ladder
- 9b307db69 CRITICAL FIX: sessionStorage.ts re-exported getProjectDir from projectDir.js without local binding → every call site was a latent ReferenceError when getSessionProjectDir() nullish; dashboard dispatch hit it seconds after TUI start. Added `import { getProjectDir } from './projectDir.js'`. Also: DashboardScreen padLine + opaque boxes (cosmetic, see known delta). CHANGELOG.md Unreleased section written.

## Verification status
- `bun run typecheck` green after P4 and P5 (before the 9b307db69 fix; that fix is one import in @ts-nocheck file + JSX props — rerun typecheck to be safe)
- `bun run test` (ci-smoke-test.sh): 1270 pass / 0 fail / 42 skip
- tmux TUI smoke (bun run dev in tmux session gizzidash): /dashboard opens; header+leader row render; dispatch spawns session row; query runs (23 tok progress shown); finalize → 'Done'; Enter opens peek (model · permission · state, last response, reply box); reply accepted; p pins (⌖); / search filters; Esc ladder works; exit to prompt works. Debug instrumentation removed after use.
- Dev-env caveat: TUI runs "Not logged in" with kimi-cli brain — model returns getModelBetas error text but the full pipeline works; pre-existing env issue, not our code.

## Known cosmetic delta (document in ledger)
- Stale-cell ghosts: when a rendered line shrinks between frames, old cells beyond the new line end linger in the terminal grid. Root cause: ink emit layer `log-update.ts:106` trimEnd()s every line, so trailing-space clearing (padLine) and Box `opaque` fill (plain spaces) never reach the grid; backgroundColor fill also didn't cover (width/emit). NOT dashboard-specific — any shrinking line in this ink. Options later: renderer-level erase-to-EOL for shrunk rows, or accept. Do NOT keep chasing this in this session.
- tmux capture-pane shows mid-frame/stale states; trust the tee'd stdout log (/tmp/gizzidash.log) over capture-pane for "what did the app render".

## Gotchas (cumulative)
- Vendored ink Event has NO preventDefault — use event.stopImmediatePropagation().
- useAppState REQUIRES a selector: useAppState(s => s.tasks) — bare useAppState() crashes (TUI Render Error, process exits).
- useTerminalSize destructure is `{ rows: termRows, columns }` — root Box must use termRows (a bare `rows` ReferenceError also kills the TUI).
- Single-char Dashboard chords (q/x/p/r) fire on any keypress — gate dashboard:exit with isActive while inner inputs focused (browsing = focus==='list' && no peek/search/details/cheatsheet).
- ctrl+letter arrives as key.ctrl && input==='<letter>'; plain '/' is more reliable than Ctrl+/ in terminals.
- Vendored useInput uses useEventCallback (fresh closures, no stale-closure bugs).
- TUI crashes (render errors) print "TUI Render Error" to stdout and EXIT — check the tee log, not the pane.
- Synchronous throws inside dispatch paths get swallowed silently by the input pipeline (no log, no crash) — instrument with appendFileSync to /tmp when debugging handler issues.

## Next (post-compaction resume)
1. Rerun `bun run typecheck` in cmd/gizzi-code for 9b307db69 (expected green).
2. Optional quick tmux re-verify of the opaque/padLine render (session gizzidash workflow: tmux new-session -d -s gizzidash -x 220 -y 55 -c <worktree>/cmd/gizzi-code 'bun run dev 2>&1 | tee /tmp/gizzidash.log'; send-keys /dashboard etc.).
3. Repo ritual wrap-up: agent-ledger/summaries/2026-09-06-HHMM-7631feda-grok-dashboard.md + LEDGER.md entry — only AFTER merge to main per AGENTS.md; merge first, then worktree cleanup (git worktree remove, branch -d), restore original branch.
4. Joe reviews the branch; merge via GitHub PR or local merge in main checkout with STEER_GUARD_OFF=1.

## Open questions for Joe
- Merge now or keep the branch for review? Ledger attestation happens post-merge per ritual.
