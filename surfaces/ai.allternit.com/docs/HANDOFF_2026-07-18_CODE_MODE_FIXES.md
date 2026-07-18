# Handoff — Code Mode canvas fixes (2026-07-18)

Repo: `~/Desktop/allternit-workspace/allternit` (git root is `~/`). Surface: `surfaces/ai.allternit.com`.

## Constraints
- **Do NOT run builds during task work** (no `tsc`, `cargo build`, `npm build`) — they hog CPU. Rebuilds happen at the end, by Eoj (see "Deferred rebuilds").
- Log pattern: `createModuleLogger` in this surface; CLI output via `process.stdout.write`.
- Multi-tenant by default; no hardcoded model ids.

## Already fixed this session — do not redo, do not revert
1. **starship TERM=dumb** — `cmd/allternit-mux/src/pty.rs` now sets default `TERM=xterm-256color` before caller env in `run_pty_task`. Takes effect only after mux rebuild (below).
2. **Orchestrated-agent dialog clipped** — `components/canvas/CanvasToolbar.tsx` `OrchestratedAgentDialog` now portals to `document.body` (matches `ui/Modal.tsx` pattern). Canvas ancestor transforms break `position: fixed`; any modal here must portal.
3. **Terminal session persistence** — `components/workspace/UnifiedTerminal.tsx`: state per logical sessionId in localStorage (`allternit.terminal.sessions.v1`), write-through on tab changes, restore probes ids via `probeTerminalSession` (new, in `lib/terminal-api.ts` — empty-input POST, 404 ⇒ dead), fresh shell fallback. `disposeTerminalSessions(sessionId)` exported for real teardown; called from `CodeCanvasView.tsx` tile-delete paths (close button, focus-view close, Delete-key bulk). Keys: `canvas:<tileId>:<sessionId|workspace>`, `drawer:<id>`, `sidepane:<id>` (prefixes keep surfaces isolated).
4. **tmux → mux** — `CanvasToolbar.tsx` dialog text says "on the mux", and `assignExecutor` now passes `backend: 'mux'`; `views/code/orchestrator.service.ts` `AssignExecutorInput.backend` includes `'mux'`. Server (`cmd/gizzi-code/src/runtime/server/routes/orchestrator.ts`) already supports `mux` backend (`MuxBackend`), default remains `tmux` for external ao-* flows.
5. **Canvas-mode toggle collides with panes** — toggle now renders inline in `CodeSessionLauncher` pill (new optional `onCanvasMode` prop, first button, testid `code-canvas-mode-toggle`). Standalone fallback in `CodeThreadView.tsx` renders only when the launcher is hidden and moved INSIDE the `code-pane-canvas` div (now `position: relative`), so it can't overlap the session side pane.

## Open task A — ACI browser pane shows no browser session
Symptom: opening the ACI pane (Globe button in `CodeSessionLauncher` → `openSideTab('aci')` → `CodeSessionSidePane` `activeTab === 'aci'` → `views/code/CodeAciPane.tsx`) never brings up a browser session.

Leads:
- `CodeAciPane` renders `ACIComputerUseView` (`capsules/browser/ACIComputerUseView.tsx`) and drives `useBrowserAgentStore` (`capsules/browser/browserAgent.store.ts`).
- On mount it calls `setEngineBaseUrl(getPlatformComputerUseBaseUrl())` (`src/integration/computer-use-engine.ts`) then `refreshEngineHealth()`. ACU engine gateway is expected on **:8760** (44 routes, per prior ACU build). Check: is the base URL right, is health failing silently, and does anything ever CREATE a browser session (vs only polling screenshot state)? Suspect there's no session-create call on pane open — `screenshot` stays null and the pane shows an empty/placeholder state.
- Also check `engineHealthy === false` path: pane may render only a status message. Reproduce first, then decide whether the bug is client wiring (no create-session call) or engine not running.

## Open task B — Artifacts view doesn't render artifacts
Symptom: artifacts tab (console/code mode) lists artifacts but the detail area shows only location/path, not the content.

Leads:
- `views/code/ArtifactCenter.tsx` (mounted from `CodeSessionSidePane` `activeTab === 'artifacts'`). Artifacts assembled from exec run results + receipts via `artifactFromReference` (`views/code/artifacts.ts`).
- Read the detail-panel JSX in `ArtifactCenter.tsx` (below line ~60): it likely renders name/path/metadata only. Needed: actual content rendering by kind — image ⇒ `<img>`, html ⇒ sandboxed iframe, code/text ⇒ fetch + syntax view, url ⇒ iframe/link preview. There may be existing renderers to reuse: check `components/ai-elements/` (artifact/code renderers), `shell/ArtifactSidecar.tsx`, and the Mode Capability artifact pipeline before writing a new renderer.
- File content access: artifacts are workspace paths — check how `CodeFileEditor.tsx` or files pane reads file bodies (existing file-read API) and reuse it.

## Verification (no builds)
Dev server for the surface is Eoj's running instance; UI changes hot-reload. Verify canvas toggle inline placement (session + collapsed pane = pill shows SquaresFour first; side pane open = fallback button stays inside canvas pane), terminal survives focus-toggle + reload, orchestrated dialog centered.

## Deferred rebuilds (Eoj runs these, not you)
- `cargo build --release -p allternit-mux`, then `pkill allternit-mux` (auto-respawns). If the running binary is the vendored prebuilt at `cmd/gizzi-code/dist/vendor/allternit-mux/darwin-arm64/`, replace it too.

## Known-good context
- Terminal stack: browser → `lib/terminal-api.ts` → allternit-api `:8013` `/terminal/*` (`cmd/allternit-api/src/terminal_routes.rs`) → `allternit-mux` daemon (unix socket). Mux persists sessions+scrollback to disk; API recovers uuid→mux mapping by label; stream attach replays full scrollback.
- H5i panels (audit/commit/diff/hooks/MCP) via `CanvasModalLayer` in `CodeCanvasView.tsx` are still NON-portaled fixed overlays — same clipping risk as item 2 if reported.
