# Session attestation — grok-dashboard (gizzi-code)

- **Date:** 2026-09-06 (2337)
- **Session:** `session/7631feda-bbb5-492f-97cf-55f243eda42d` (kimi), worktree `allternit-session-7631feda`
- **Merged to main:** PR #103, squash merge commit `51f7315532f38c8315b1c4916897a4c46f03acfb`
- **Branch commits:** `b8675f9ce` (P1–3), `07865f0d0` (P4), `c2f807680` (P5), `9b307db69` (fix+polish), `323c5bc39` (checkpoint), `7386f48c5` (merge origin/main), `581cbe9d6` (steering checkpoint)

## Goal

Owner asked to port three Grok CLI presentation features into gizzi-code: (1) the `/session-info` slash-command presentation (auth/turns rows, copy keys), (2) the Grok agent dashboard, (3) the Grok-style `/settings` presentation. Plan approved by owner before implementation.

## What shipped

### 1. `/session-info` — status command upgrade (`b8675f9ce`)
- `/status` gained aliases `/info` and `/session-info`; output shows Auth and Turns rows plus copy-to-clipboard key hints (c/y), modeled on Grok's presentation.
- Files: `commands/status/status.tsx`, `utils/statusModel.ts`, `commands.ts`.

### 2. `/settings` polish (`b8675f9ce`)
- Effort row added to the settings screen, matching Grok's layout. Files: `components/Settings/*`.

### 3. `/dashboard` agent dashboard — full Grok parity (`07865f0d0`, `c2f807680`)
- New `dashboard/` module under `cmd/gizzi-code/src/cli/ui/ink-app/`:
  - `types.ts` — `DashboardSource` interface seam (list/send/peek/details/rename/stop), so a future gizzi-serve remote source can replace the in-process one without UI changes.
  - `topLevelSession.ts` — spawns dashboard sessions as main-session `local_agent` tasks and drives them with a multi-turn `pendingMessages`-drain loop.
  - `InProcessSource.ts` — in-process implementation of the source over the local agent runtime.
  - `screens/DashboardScreen.tsx` (701 lines) — the full UI: dispatch (leader row), live rows, peek + reply, search (`a:`/`s:`/`#` filters), Ctrl+G grouping, idle folding with N-more, `v` details view, `?` cheatsheet, rename/pin/reorder (persisted via `dashboard.pinned` + `dashboard.reorder` in GlobalConfig), Esc ladder, and single-key chords gated on dashboard focus.
- Bound to `/dashboard` command and a `Ctrl+\` global toggle (`keybindings/defaultBindings.ts`, `useGlobalKeybindings.tsx`, `REPL.tsx`, `AppState.tsx`/`AppStateStore.ts`).

### 4. Critical fix (`9b307db69`)
- `utils/sessionStorage.ts` re-exported `getProjectDir` from `projectDir.js` without importing it — a latent ReferenceError at every call site once `getSessionProjectDir()` returned nullish; the dashboard hit it seconds after TUI start. Fix: added the missing `import { getProjectDir } from './projectDir.js'`.

## How it works (architecture notes)
- Dashboard sessions are not separate processes: they are `local_agent` tasks owned by the main session, driven by a pendingMessages drain loop in `topLevelSession.ts`. The UI talks only to `DashboardSource`, so a remote/gizzi-serve source is a drop-in replacement.
- Pin/reorder state lives in the existing GlobalConfig under `dashboard.*` keys.
- Merge reconciliation (`7386f48c5`): main drifted during the session; merged origin/main, resolved conflicts in `commands/status/index.ts` (alias order took main's), `CHANGELOG.md` (kept both our Unreleased section and main's 2.0.6/2.0.7 entries), and `.steering/checkpoint.md` (kept ours).

## Unfinished / deferred (honest status)
- Details view renders a text excerpt of the conversation, not the full Messages renderer.
- Needs-input replies land in the main-session prompt; Grok's 1–9 option buttons are not implemented.
- Working glyph is a static `●` (Grok animates it).
- Main leader-row state is a static `idle` string.
- Stale-cell ghosts when rendered lines shrink between frames: root cause is the vendored ink emit layer (`ink/log-update.ts:106`) trimEnd-ing every line, so trailing-space clearing never reaches the grid. Pre-existing, not dashboard-specific; left as-is.

## Verification evidence
- `bun run typecheck` green on the merge commit (after `pnpm install` in the worktree root — main had added the `@allternit/native-sessions` workspace package and the missing pnpm link was the only smoke failure cause).
- `bun run test` (ci-smoke-test.sh) on the merge commit: **1315 tests, 0 fail** — SMOKE PASS.
- tmux TUI functional pass: `/dashboard` opens; dispatch spawns a session row; query progress renders (23 tok); finalize → Done; Enter peeks (model · permission · state, last response, reply box); reply accepted; `p` pins (⌖); `/` search filters; Esc ladder and clean exit all work.
- GitHub's Gizzi Code Quality workflow never triggered on the PR (repo-infra quirk; Vercel/Cloudflare checks fail repo-wide on quota). Owner explicitly approved merging without those checks green.

## Cleanup confirmation
Worktree `allternit-session-7631feda` removed; local + remote branch `session/7631feda-bbb5-492f-97cf-55f243eda42d` deleted; scratch files `/tmp/gizzi-pr-body.md`, `/tmp/gizzidash.log`, `/tmp/dash-debug.log` removed; tmux session `gizzidash` killed. Final state verified: main checkout clean at `51f731553`, `git worktree list` shows only the remaining sessions of other agents, no `7631feda` branches local or remote.

## Follow-up 2026-09-06 (23:55) — details view now renders the full transcript
Owner asked to close known-delta #1 immediately. New worktree `allternit-session-7631feda-d2`, branch `session/7631feda-dash-details`, merged as `37057ec17` on main (fast-forward).

- `DashboardSource.messages()` (lossy `{role,text}` excerpt) replaced by `transcript()` returning the full `Message[]`; `InProcessSource` shallow-copies per call because the runner mutates its array in place and Messages' React.memo compares by identity.
- Details view mounts the real `<Messages>` component (screen='transcript', hideLogo, verbose) inside a stickyScroll `ScrollBox` — full markdown, thinking blocks, tool chrome, grouping/collapse. Keys: ↑/↓/j/k, Ctrl+U/D page, g/G top/bottom.
- REPL passes its `tools`/`commands` into DashboardScreen for tool rendering.
- **Latent collision fixed:** `/dash` (session-stats screen from the earlier grok-slash pass `a748ccb78`) declared aliases `['dashboard','sessions','agents-dashboard']` and, after MRU reordering, hijacked `/dashboard` resolution — the dashboard was unreachable by name post-merge. Aliases removed; stats screen stays reachable as `/dash`.
- Known deltas remaining: needs-input 1–9 buttons (answers land in main-session prompt), static working glyph, static main-row state, stale-cell ghosts (pre-existing ink emit issue at `ink/log-update.ts:106`).
- Verification: typecheck green; smoke suite 1315 pass / 0 fail; tmux TUI pass — /dashboard opens, dispatch works, details view renders the transcript through Messages, scroll keys + Esc ladder work, no render errors.
- Cleanup: worktree + branch (local/remote) removed, tmux session killed.

## Follow-up 2 (2026-09-07) — all 4 remaining known deltas closed

Owner asked to fix the 4 remaining known deltas (needs-input 1–9 buttons, static working glyph, static main-row state, stale-cell ghosts). Worktree `allternit-session-7631feda-d3`, branch `session/7631feda-deltas`. **Merged to main @ `e0abf92a3`** (merge of origin/main into the branch) via remote `HEAD:main` fast-forward — the shared main checkout was unsafe: another session (term-xterm55's successor) holds 20+ uncommitted files overlapping origin/main's terminal changes; same precedent as office-ext/d641922e/term-xterm55. Local shared checkout untouched; that session pulls when ready.

Commits: `977f8b1bd` (deltas 1–3), `3c7b5d2cc` (delta 4), `e0abf92a3` (merge origin/main, only conflict `.steering/checkpoint.md`).

### Deltas 1–3 (`977f8b1bd`)
- **Inline permission answers in the dashboard.** The `canUseTool` wrap in `topLevelSession.ts` now stamps `ctx.options.dashboardTaskId = taskId`; `PermissionContext.pushToQueue` copies it onto the `ToolUseConfirm`; the dashboard peek panel renders the real `<PermissionRequest>` for needs-input rows, so option buttons incl. digit keys 1–9 work without leaving the dashboard. Queue items without a tag belong to the main row. Latent bug fixed along the way: the wrap's `try/finally` cleared `awaitingInput` when the permission *promise was returned*, not settled — needs-input detection was broken.
- **Animated braille spinner** (120 ms tick, only while any row is working) replaces the static working glyph.
- **Live main leader row** via refs (`isLoadingRef`/`toolUseConfirmQueueRef`): needs-input when a main-session permission prompt is pending, working while the main query runs; adds model + permission mode to the row.

### Delta 4 (`3c7b5d2cc`) — stale-cell ghosts, two-layer fix after a failed first attempt
- **Attempt 1 (background subagent):** per-row stale-tail CSI K sweep in the TTY diff path of `log-update.ts`. **Live verification failed — 0 CSI K ever emitted.** Two repro traps found: the dashboard dispatch input needs `Tab` focus before keystrokes land (all minimal repros were typing into nowhere), and the tee'd dev session runs with stdout piped, so the app takes the **non-TTY** full-frame path and the TTY sweep never runs.
- **Attempt 2 (fresh subagent, given the live evidence):** real root cause is `LogUpdate.renderFullFrame` — the non-TTY full-frame serializer used whenever stdout is piped (`gizzi | tee`, with stdin recovered from /dev/tty so the session stays interactive). It emitted trimEnd'd rows with no per-row erase; alt-screen frames anchor with CSI H and re-land on the same region every render, so cells past a shrunken row kept whatever an earlier, longer frame wrote — the ghost. Frame buffers were correct every frame (verified with instrumentation); the emitter was the corrupting layer. **Fix:** append erase-to-EOL to every row in `renderFullFrame`. Attempt 1's TTY sweep kept as defense-in-depth (covers stale tails both frame buffers agree on in real-TTY sessions).
- User-impact note: the ghost only manifested with piped stdout (captured/logged sessions); interactive real-TTY sessions ran the diff path. Both paths now erase stale tails.
- Tests: `test/ui/non-tty-full-frame-ghost.test.ts` (render-level e2e through a terminal-grid emulator + mechanism test — both fail without the fix) and `test/ui/log-update-shrink-tail.test.ts` (TTY sweep, 4 tests). Scratch repro `test/tmp-repro-ghost.test.ts` superseded/deleted.

### Verification evidence
- Live tmux repro of the ghost: 70-char type + 70×BSpace burst → settled input row clean ` ❯ gho▌`, no `▌` interleave, no stale fragments; CSI K count in the tee'd stream 1091 (was 0 before the fix).
- `bun run typecheck` green; ink/component tests 33/0; smoke suite **1315 pass / 0 fail** on both the fix commit and the post-merge merge commit.

### Honest status
- Spinner animation, inline-permission rendering, and main-row live states are code-path verified and the dashboard is live-smoke-tested (opens, Tab-dispatch, sessions run to completion, peek/reply), but this dev environment's broken brain (not logged in, getModelBetas error, turns die in <150 ms) made it impossible to capture a live working→needs-input transition. The states are driven by the same refs/queue wiring verified in code.
- Separate pre-existing issue observed during repro: at >~30 keys/s some keystrokes are lost in the input layer (nonblocking /dev/tty read or the 16 ms render throttle) — the draft stuck at "gho" mid-burst while the terminal rendered it exactly. Not render-path; out of scope here; worth a future issue.
