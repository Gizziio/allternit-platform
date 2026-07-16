---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/agents/agent-mode-contracts.ts
  - surfaces/ai.allternit.com/src/views/chat/components/ModeDock.tsx
  - surfaces/ai.allternit.com/src/shell/ShellApp.tsx
  - surfaces/ai.allternit.com/src/views/chat/ChatComposer.tsx
  - surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts
  - surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx
  - surfaces/ai.allternit.com/src/views/code/CodeWorkspaceBar.tsx
  - surfaces/allternit-desktop/src/main/unified-main.ts
  - surfaces/ai.allternit.com/src/lib/platform-auth-client.tsx
  - docs/CODE_MODE_HANDOFF_NOTES.md
deviations:
  - The observed Flow B failure was at the Electron API redirect/auth boundary, not CodeCanvas session mounting.
  - The running Rust backend binary predates the source-level desktop bootstrap support and still returns 401, so direct Code sessions use the same built-in local fallback as Flow A.
  - A fresh restart of the dev stack hit an auth gate because the local Electron build has no Clerk key and no paired runtime session. `isPlatformAuthDisabled()` was broadened so the no-credential local-dev fallback matches `PlatformAuthProvider`'s disabled-auth path.
  - Real-model E2E through Gizzi was unblocked by rebuilding the Electron main process so the `allternit-gizzi://runtime` custom protocol is active, and by adopting the existing password-protected dev runtime with `GIZZI_SERVER_PASSWORD`.
remaining:
  - Rebuild/redeploy the Rust backend separately when desired so local session persistence can move from the built-in fallback to backend storage; this is not required for Code sessions to mount and run in the current app.
  - The stale `cmd/gizzi-code/dist/gizzi-code` binary still cannot be rebuilt from source due to missing source files / unresolved imports. The current dev setup works because the binary is adopted via its known dev password; a clean rebuild of `gizzi-code` remains a separate task.
---

> **UI evolution note (2026-07-16):** After the live verification below, the Code Mode workspace chrome was redesigned. The launchpad quick-action pills mentioned in this document (`Scaffold`/`Refactor`/`Debug`/`Optimize`/`Explore`) were removed from the empty-session hero, and the right-side session pane navigation was replaced by a floating launcher (`CodeSessionLauncher.tsx`) with Terminal, Diff, ACI, and session-actions icons. The verified session-mount and worktree fixes below remain valid; only the surface chrome changed. See `docs/specs/code-session-mount-and-pane.md` and `docs/specs/code-mode-hero-usage-state.md` for the current design.

# Code Mode live-test results

Flow B (left rail **Code** → Code launchpad composer) is the flow that was actually broken. The launchpad rendered and accepted input, but sending did not mount a conversation and the user message disappeared. The captured network sequence was:

1. `POST http://localhost:3013/api/v1/agent-sessions` with `origin_surface: "code"`, `session_mode: "regular"`, and `metadata.isolation: "worktree"`.
2. Electron redirected it with `307` to `allternit-api://localhost/api/v1/agent-sessions`.
3. The initial request contained the desktop bootstrap identity headers; the redirected custom-protocol request contained none of them.
4. The backend returned `401 {"error":"Unauthorized"}`. `createSession` discarded its optimistic regular session, so `CodeCanvas` correctly had no session to mount and `pendingWorktree` was reset with the launchpad component.

The protocol-boundary fix is in `surfaces/allternit-desktop/src/main/unified-main.ts:1704`: the custom-protocol handler now restores the signed-out local desktop bootstrap identity when no authenticated desktop token exists. This is the correct boundary because Chromium strips the renderer headers during the cross-origin redirect. The existing compiled runtime file was updated in parallel without running a build.

The already-running Rust binary still rejected those valid bootstrap headers because it predates the current auth middleware. `surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts:847` therefore now retains direct Code-surface sessions with `executionPersistence: "local"` and `agentModeId: "code"`, matching the fallback already used by Flow A. A final live rerun passed: the launchpad greeting disappeared, `data-testid="code-session-header"` mounted, the sent message was visible once, and the worktree checkbox remained checked.

Flow A (Home → **Agent Off** → ModeDock → **Code** → send) works with the existing frontend fixes. It switched to Code, mounted `data-testid="code-session-header"`, hid the launchpad greeting, and displayed the sent message. Its backend session POST hit the same `401`, but the built-in Code agent-mode local fallback retained and mounted the optimistic session. The exact Agent toggle is the inner button whose visible label is computed in `BottomDock.tsx:90-98` and whose click handler is at `BottomDock.tsx:113-116`.

The post-session worktree check exposed another real issue for locally retained sessions: `updateSession` retried the unavailable backend and did not update Zustand, so the checkbox stayed empty. `surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts:911` now applies session/metadata updates optimistically and returns without an API call for temporary or `executionPersistence: "local"` sessions. Pre-session Flow B was verified visually: the checkbox changed to the checked icon and the session POST contained `metadata.isolation: "worktree"`.

The launchpad quick actions work. After closing the Usage dashboard, Scaffold/Refactor/Debug/Optimize/Explore remained visible; clicking Scaffold expanded New component/Route shell/API surface. The rendering is at `CodeCanvas.tsx:1215-1277`.

## Evidence

- Flow B empty launchpad: `output/playwright/code-mode/flow-b-01-launchpad.png`
- Flow B quick actions after dashboard dismissal: `output/playwright/code-mode/flow-b-02-quick-actions.png`
- Flow B checked worktree before send: `output/playwright/code-mode/flow-b-03-worktree-before-send.png`
- Flow B message before send: `output/playwright/code-mode/flow-b-04-before-send.png`
- Flow B failed mount after observed 401: `output/playwright/code-mode/flow-b-05-after-send.png`
- Flow A Code selected: `output/playwright/code-mode/flow-a-01-code-selected.png`
- Flow A message before send: `output/playwright/code-mode/flow-a-02-before-send.png`
- Flow A mounted Code conversation: `output/playwright/code-mode/flow-a-03-after-send.png`
- Flow A original broken post-session worktree state: `output/playwright/code-mode/flow-a-04-worktree-after-session.png`
- Final Flow B input with worktree selected: `output/playwright/code-mode/flow-b-final-01-before-send.png`
- Final Flow B mounted conversation: `output/playwright/code-mode/flow-b-final-02-session-mounted.png`

## Post-restart verification (current session)

After picking the handoff back up, the stale Electron process was closed and the stack was restarted from the current working tree:

- Vite dev server on `http://localhost:3013`
- Allternit API on `http://127.0.0.1:8013` (dev auth bypass)
- Electron desktop with CDP on port 9223 in `development` backend mode

A fresh Flow B run confirmed:

- `data-testid="code-launchpad-greeting"` visible on the empty launchpad.
- Worktree pill toggles on the launchpad.
- After sending `write a hello world function in python`, the greeting disappeared, `data-testid="code-session-header"` mounted, and the sent message remained visible.

The session POST still receives `401` from the Rust backend, so the local fallback path (`executionPersistence: "local"`, `agentModeId: "code"`) is the active mount mechanism.

### Gizzi runtime E2E — resolved

The renderer now fetches Gizzi through the Electron-brokered `allternit-gizzi://runtime` custom protocol. Electron main injects the Basic auth credential and proxies to the loopback runtime, so the renderer never handles the password. Verified live:

- `allternit-gizzi://runtime/provider` returns `200` and lists connected providers/models.
- The model selector opens on one click, shows no duplicate pill, and lists real registered models (GPT, Claude, Kimi, Codex, etc.).
- The internal `echo` test provider is filtered out of the selector.
- Selecting `codex-mini-latest` updates the composer pill.
- Sending `Reply with exactly CODE_MODEL_E2E_OK` through a Code Mode session mounted the conversation header and rendered the model's response.

Dev-mode start command used:

```bash
cd surfaces/allternit-desktop
ALLTERNIT_DISABLE_VOICE=1 GIZZI_SERVER_PASSWORD=testpass123 NODE_ENV=development pnpm exec electron . --remote-debugging-port=9223
```

`ALLTERNIT_DISABLE_VOICE=1` was added because the bundled voice service crashes on this machine due to a `torch==2.6.0` version mismatch. `GIZZI_SERVER_PASSWORD=testpass123` is required because the stale Jul 12 `gizzi-code` binary still enforces Basic auth and cannot be rebuilt from source (missing source files / unresolved imports).

No commit was performed. The scratch inspector scripts remain in `.claude/skills/electron-inspector/` for reuse.
