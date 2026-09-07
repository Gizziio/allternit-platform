# Steering checkpoint

## STATUS: DELTAS 1-3 COMMITTED (977f8b1bd) + CHANGELOG Unreleased updated. DELTA 4 FIRST FIX FAILED LIVE VERIFICATION: agent-5's log-update.ts sweep never fires in the real repro (0 CSI K in /tmp/gizzidash3.log). Root cause: agent-5's minimal repros missed the Tab-focus trap — the dashboard dispatch input needs `tmux send-keys Tab` before keystrokes land. With focus, type 70 chars + 70 BSpaces → settled frame shows stale fragments interleaved with ▌ every ~4-5 cells; ghost is re-materialized every frame → the APP frame buffer is corrupted (suspect render-node-to-output.ts retained-mode blit fast-paths restoring stale prevScreen content / wrong blit offset; input sits in full-width bordered Box). Fresh subagent agent-6 (task agent-sahqmxuw) root-causing with this evidence. Correct gate is `cmd/gizzi-code` `bash script/ci-smoke-test.sh` (root `bun run test` = vitest workspace, unrelated). typecheck green; slash-menu 9/9; shrink-tail test 4/4. Worktree allternit-session-7631feda-d3, base main@ad1ca8058.

## Goal
Fix the 4 known deltas Joe asked for:
1. Needs-input 1–9 option buttons in the dashboard (was: answers only via main-session prompt)
2. Static working glyph → animated spinner
3. Main leader row static 'idle' → live state
4. Stale-cell ghosts on shrinking lines (vendored ink, pre-existing)

## Delta 1 — needs-input buttons (IMPLEMENTING, not yet edited)
Root causes found:
- `topLevelSession.ts` canUseTool wrap: `try { return originalCanUseTool(...) } finally { awaitingInput.delete(taskId) }` — the finally runs when the PROMISE IS RETURNED, not settled, so `awaitingInput` (needs-input detection) is broken/latent too. Make promise-aware: wrap with `Promise.resolve(result).finally(() => awaitingInput.delete(taskId))`.
- Confirm queue items carry no task attribution. Plan: in the SAME wrap, stamp `ctx.options.dashboardTaskId = taskId` (3rd arg of canUseTool is toolUseContext; the same object reference flows to confirm creation). Then in `hooks/toolPermission/PermissionContext.ts` `pushToQueue(item)`: stamp `item.dashboardTaskId = toolUseContext?.options?.dashboardTaskId` before `queueOps?.push(item)` (spread if needed). Add `dashboardTaskId?: string` to `ToolUseConfirm` type (components/permissions/PermissionRequest.tsx ~line 104) and to `ToolUseContext.options` (Tool.ts ~line 159 — type-checked file, optional field OK).
- DashboardScreen: new props `permissionQueue` + `onPermissionDone(toolUseID)` (REPL passes toolUseConfirmQueue + a filter-removal callback). In renderRow's peek section, when row.state === 'needs-input', find `permissionQueue.find(i => (i.dashboardTaskId ?? 'main') === row.id)` and render `<PermissionRequest toolUseConfirm={item} toolUseContext={item.toolUseContext} onDone={() => onPermissionDone(item.toolUseID)} onReject={() => {}} verbose={true} workerBadge={item.workerBadge} />` replacing the old "awaiting input — answer the prompt in the main session" Text. Digits 1-9 then work via the real per-tool option components. REPL's own PermissionRequest does NOT render while screen==='dashboard' (dashboard branch returns early — verified REPL.tsx ~4899).

## Delta 2 — spinner (NOT yet edited)
In DashboardScreen.tsx: module const `SPIN_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']`; `const [spinFrame, setSpinFrame] = React.useState(0)`; effect: `const hasLive = allRows.some(r => r.state === 'working'); useEffect(() => { if (!hasLive) return; const t = setInterval(() => setSpinFrame(f => (f+1) % SPIN_FRAMES.length), 120); return () => clearInterval(t); }, [hasLive]);` In renderRow: working glyph = SPIN_FRAMES[spinFrame] (needs-input/failed keep ●, idle/inactive keep ○).

## Delta 3 — main row live state (NOT yet edited)
REPL.tsx getMainRow (~line 2770, inside useMemo deps [store, setAppState, buildDashboardQueryParams]): closure would capture STALE isLoading/toolUseConfirmQueue. Fix with refs: add `const toolUseConfirmQueueRef = React.useRef(toolUseConfirmQueue); toolUseConfirmQueueRef.current = toolUseConfirmQueue;` and same for isLoading (`isLoadingRef`). isLoading = isQueryActive || isExternalLoading (REPL.tsx:1081). Then getMainRow reads refs: `state: permissionPending ? 'needs-input' : loading ? 'working' : 'idle'`, `activityLine` matching, add `model: mainLoopModel?.alias ?? mainLoopModel?.fullName`, `permissionMode: store.getState().toolPermissionContext?.mode`. NOTE: permissionPending for main row = any queue item WITHOUT dashboardTaskId.

## Delta 4 — ink ghosts (DELEGATED to background coder subagent agent-5, task agent-lhsk7dl5)
Findings handed to it: diff loop log-update.ts ~309 (removed-cell branch writes space correctly; line ~340 skips empty-next/absent-prev), back buffer cleared by resetScreen (screen.ts ~502) but render-node-to-output.ts uses retained-mode blit fast-paths (output.blit ~471, nodeCache, opaque boxes, damage rects) painting into reused buffer — unpainted regions keep stale cells so diff sees "no change". Instruct: fix at correct layer, smallest change, NO blanket per-frame clear (perf regressions documented), run ink-layer tests + typecheck, don't touch dashboard/screens/commands. Result pending — check TaskList/notification; if lost, resume agent-5.

## Verification plan (after all deltas)
- `bun run typecheck` in cmd/gizzi-code (green baseline before edits: SDK dist rebuilt by ensure-sdk-dist).
- `bun run test` (ci-smoke) — was 1315 pass/0 fail on d2; expect same+.
- tmux TUI: tmux new-session -d -s gizzid3 -x 220 -y 55 -c <d3>/cmd/gizzi-code 'bun run dev 2>&1 | tee /tmp/gizzidash3.log'; /dashboard (type slowly, menu MRU may highlight /dash — press Up first or use exact); Tab → dispatch 'Reply with exactly: hello'; verify spinner animates (two captures differ); verify main row state changes while dispatch running; force a permission prompt if possible to see inline PermissionRequest (dev env is "Not logged in" — may not prompt; if not, verify via unit path or accept code-review-level verification); line-shrink ghost check (type long text in input, delete, look for ghosts).
- pnpm install was already run at d3 root (workspace link ok).

## Merge/cleanup ritual after green
Commit on session/7631feda-deltas → push → STEER_GUARD_OFF=1 git pull --ff-only + merge in main checkout (shared; guard escape) → push main → ledger append (follow-up section in summaries/2026-09-06-2337-7631feda-kimi-grok-dashboard.md + LEDGER.md entry) → worktree remove + branch -D local/remote → rm /tmp/gizzidash3.log → verify clean.
