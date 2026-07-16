# Code Mode Bug Fixes — Handoff Map

## Origin

Eoj reported, across several messages in one session, working on the
allternit platform's "code mode":

1. "you cant send a message and it starts a session in code mode"
2. "also the worktree pill tab dont let you check the box for worktrees, its
   not eevn wired"
3. "and the session doesnt mount in code mode when you send a message"
   (said mid-turn, after fix #1 landed)
4. "when you exit out the stats usage modal ther needs to be something in the
   section for code mode. there is nothing there after it is closed."
5. "its still not working. you need to test it" — this is the live blocker.
   A Playwright smoke test was started but not finished before this handoff.

**Do not trust that the fixes below actually work end-to-end. None have been
verified against the running app. Verifying them live is the very first thing
the next agent must do.**

## Fixes already applied (uncommitted, working tree)

All in `~/Desktop/allternit-workspace/allternit` (git root is `~`, NOT
`~/Desktop/allternit-workspace/allternit-workspace`). No commit has been made.
Run `git status` / `git diff` in that repo to see the live diff.

1. **`surfaces/ai.allternit.com/src/lib/agents/agent-mode-contracts.ts`**
   `'code'` was missing from `CanonicalAgentModeId`, `AgentArtifactKind`, and
   `AGENT_MODE_CONTRACTS`. Added it back with a real contract
   (`requiredCapabilities: ['file_write', 'code_execution']`). Without this,
   `getAgentModeContract('code')` returned `null` and any code path trying to
   start a Code-mode session silently bailed.

2. **`surfaces/ai.allternit.com/src/views/chat/components/ModeDock.tsx`**
   `'code'` had been explicitly stripped from `MODE_TABS` and
   `SURFACE_MODES.chat` / `SURFACE_MODES.cowork`, with a comment calling it a
   "legacy invalid mode." Restored the chip (icon: `Code` from
   `@phosphor-icons/react`) and the surface-mode list entries.
   **Do NOT touch `SURFACE_MODES.code`** — that's an unrelated list (which
   content-artifact modes are offered while already inside the Code surface).

3. **`surfaces/ai.allternit.com/src/shell/ShellApp.tsx`** — `handleOpenAgentSession`
   Previously picked which store/view to open based on the `surface` argument,
   but the Chat composer always calls this with `surface: 'chat'` regardless
   of which mode chip is selected (mode and surface are different axes: mode
   = content type like website/docs/code, surface = which panel is showing).
   So selecting "Code" mode from Chat created the session in
   `useChatSessionStore` and never left the Chat view. Fixed by computing
   `targetSurface = modeId === 'code' ? 'code' : surface` and using that for
   both the store choice and the `OPEN_VIEW` dispatch.

4. **`surfaces/ai.allternit.com/src/views/chat/ChatComposer.tsx` — the deepest bug found**
   `handleSubmit` (~line 1172) and a duplicate voice-mode auto-submit effect
   (~line 1034) both only call `onAgentSend` (which drives
   `handleOpenAgentSession`, i.e. everything in fix #3) when `agentModeEnabled`
   is true. **`agentModeEnabled` is a totally different concept** — it's
   `hasEmbeddedSession || locallyEnabled`, and `locallyEnabled` is only set by
   the "Agent Off"/"Agent On" toggle pill or by @mentioning a specific agent
   persona (see `handleToggleAgentMode`, `handleSelectMentionAgent`). It has
   nothing to do with which content mode (website/docs/**code**/etc.) is
   selected. Changed the gate in both places to:
   ```ts
   if (onAgentSend && agentModeSurface && (agentModeEnabled || isCanonicalAgentMode(selectedModeId))) {
     onAgentSend(...)
   } else {
     onSend(...)
   }
   ```
   **This fix may be moot or may be exactly the missing piece — unverified.**
   See "Critical open question" below — `ModeDock` itself is only rendered
   when `agentModeEnabled` is already true, so in the primary flow this gate
   may never have mattered. Needs live verification either way.

5. **`surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts`**
   Added `isolation?: 'worktree' | 'none'` to `CreateModeSessionOptions` and to
   `ModeSession['metadata']`. Threaded it through `createSession`'s optimistic
   session object, the real backend payload, and `mapBackendSession` (so it
   round-trips from the backend too).

6. **`surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx`**
   - The worktree pill used to read/write `useCodeModeStore`, a store seeded
     with **hardcoded mock data** (`sess_code_ui`, fake `/worktrees/...`
     paths) whose `createSession` is never called by real code. Real sessions
     live in `useCodeSessionStore`. Rewired: `worktreeEnabled` now derives
     from the real active session's `metadata.isolation` once one exists, or
     a new `pendingWorktree` local `useState` before one does.
     `handleToggleWorktree` now calls `useCodeSessionStore.getState().updateSession(...)`
     on a real session, or flips `pendingWorktree` before one exists.
   - Both `createCodeSession(...)` call sites inside `handleSend` (agent-mode
     branch and regular-chat branch) now pass
     `isolation: pendingWorktree ? 'worktree' : 'none'`.
   - Added a `CODE_ACTION_GROUPS` quick-action row (Scaffold/Refactor/Debug/
     Optimize/Explore pills + a template list on click) to `LaunchpadStage`,
     using data/handlers (`activeAction`, `onToggleAction`, `onPreviewTemplate`,
     `onSelectTemplate`) that already existed and were threaded all the way
     down through props but were never rendered anywhere — hence the empty
     gap under the usage dashboard once it's dismissed.
   - `worktreeEnabled: boolean` threaded as a new prop through
     `LaunchpadStage` and `ConversationStage` down to `CodeWorkspaceBar`.

7. **`surfaces/ai.allternit.com/src/views/code/CodeWorkspaceBar.tsx`**
   `CodeWorkspaceBarProps.activeSession` (typed off the mock `CodeModeStore`)
   replaced with a plain `worktreeEnabled: boolean` prop. Removed now-unused
   `getActiveSession` / `CodeSessionRecord` imports.

**Important backend caveat (told to Eoj already, still true):** none of this
makes worktree isolation actually provision a git worktree. The intent now
reaches session metadata, but a real `git worktree add/remove` implementation
already exists in a *different*, unconnected pipeline:
`views/code/orchestrator.service.ts`'s `assignExecutor` /
`AssignExecutorInput.isolation`, wired to `OrchestratorCenter.tsx` and a real
backend endpoint (`/api/v1/orchestrator/assign`). Connecting Code-mode chat
sessions to that pipeline is a separate, bigger task — flag it, don't attempt
it as part of this bugfix pass unless asked.

## Critical open question — NOT YET RESOLVED

There are **two distinct ways** a user ends up "in code mode," and it is not
confirmed which one Eoj is actually testing when they say "still not
working":

**Flow A — via Chat's ModeDock** (fixes #1–#4 target this):
Chat/Cowork home screen → click "Agent Off" pill to enable Agent Mode → a
`ModeDock` deck slides in below the composer (`ChatComposer.tsx` ~line 2475:
`{agentModeSurface && agentModeEnabled && !voiceModeActive && (<ModeDock .../>)}`)
→ click the mode trigger → pick "Code" → type + send → should create a
session in `useCodeSessionStore` and switch to the Code surface.

**Discovered while testing, unresolved:** `ModeDock` is *only rendered* once
`agentModeEnabled` is already true. That means fix #4 (relaxing the
`handleSubmit`/voice-effect gate to `agentModeEnabled || isCanonicalAgentMode(...)`)
may be entirely moot for this flow, since by the time a user can even see and
click "Code" in ModeDock, `agentModeEnabled` was already true and the
*original* gate would have passed anyway. Fix #4 might matter for some other
entry point, or might be inert. **Not verified either way.**

**Flow B — via the Code surface's own composer directly**:
Click the "Code" tab in the left rail (see the app screenshot, `Home | Code |
ACI` tabs at top of the left sidebar) → land on `CodeCanvas.tsx`'s
`LaunchpadStage` → type + send in its own composer → goes through
`CodeCanvas.tsx`'s own `handleSend` (NOT `handleOpenAgentSession`, NOT
`ModeDock`, NOT anything in fixes #1/#3/#4). This path calls
`createCodeSession()` from `CodeSessionStore.ts` directly. It was read
carefully and looked correct on paper (see prior analysis in this
conversation) but **was never actually driven live**.

Given Eoj's phrasing across messages ("this view" in the platform, working
directly "on code mode"), **Flow B is the more likely candidate** for what
they're actually clicking through — in which case fixes #1, #3, #4 (ModeDock/
ShellApp/ChatComposer) may be entirely irrelevant to their repro, and the real
bug is purely inside `CodeCanvas.tsx`'s `handleSend`/session-mount logic, which
has NOT been fixed because it wasn't found broken on read. **The first thing
to do is reproduce Flow B live and watch what actually happens.**

## Test harness already set up (reuse, don't rebuild)

- The Electron app is **already running** with
  `--remote-debugging-port=9223`, and its Vite dev server is up on
  `localhost:3013` (`pnpm dev` in `surfaces/ai.allternit.com`). Backend
  processes already running: `./target/debug/allternit-api` (Rust API),
  `gizzi-code serve` on port 4096. **Don't start/stop any of these.**
- There is a project skill at
  `~/Desktop/allternit-workspace/allternit/.claude/skills/electron-inspector/`
  with existing Playwright scripts (`inspect.cjs`, several `check-*.cjs`) that
  show the established patterns: connect via
  `chromium.connectOverCDP('http://localhost:9223')` to drive the **actual
  running app** (preferred — this is what Eoj is looking at), or
  `chromium.launch()` + `page.goto('http://localhost:3013')` for an isolated
  throwaway tab (used partway through this session, works because
  `vite.config.*` proxies `/api` → `http://127.0.0.1:8013`, same backend the
  real app hits — but starts with empty localStorage/zustand-persisted state,
  so any flow depending on prior app state, e.g. an existing agent
  registration, may not reproduce there).
- **`playwright` only resolves from the monorepo root**
  (`~/Desktop/allternit-workspace/allternit`), not from arbitrary scratch
  directories — `cd` there (or place scripts under
  `.claude/skills/electron-inspector/`) before `node your-script.cjs`.
- A throwaway script `test-code-mode-tmp.cjs` was left in
  `.claude/skills/electron-inspector/` from this session — **it is scratch,
  not a permanent skill file, delete it or overwrite it freely.** It currently
  only drives Flow A (and doesn't even get past finding the mode-dock trigger,
  because it doesn't click "Agent Off" first — see below).
- Screenshots from the aborted run are in
  `/private/tmp/claude-501/-Users-macbook/09e2fac7-3b9e-44fe-8270-a6710e92ea96/scratchpad/code-01-initial.png`
  (shows the real home screen layout: left rail with Home/Code/ACI tabs,
  composer with "Chat | Cowork" pill + "Agent Off" pill + model picker, NO
  mode dock visible — confirms the "ModeDock hidden behind Agent Mode toggle"
  finding above).
- The "Agent Off" toggle button's exact locator was **not fully identified**
  before this handoff — it's rendered inside
  `views/chat/components/BottomDock.tsx` (label logic ~line 97-98, wired via
  `onToggle={onToggleAgentMode || (() => {})}` ~line 222) but its
  `data-testid`/`aria-label` needs one more read of that file to nail down
  precisely.

## Constraints (per Eoj's standing preferences — see project memory)

- **Never run build/typecheck commands** (`tsc`, `cargo build`, `npm run
  build`, etc.) — they hog CPU on this machine. Verification must be via the
  live running app (Playwright/CDP), not compilation.
- Don't commit anything unless explicitly asked.
- Don't add speculative abstractions/fallbacks beyond what's needed to fix
  the reported bugs.
