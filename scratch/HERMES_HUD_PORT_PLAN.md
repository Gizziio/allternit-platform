# Hermes HUD → Allternit Port Plan

**Goal:** Copy the Hermes Agent desktop HUD implementation into the Allternit `allternit-session-hud-mode` worktree, adapting names and seams to Allternit's architecture. No PRs — direct local port.

**Hermes source:** `/Users/joe/Desktop/hermes-agent-fork/apps/desktop/`  
**Allternit target:** `/Users/joe/Desktop/allternit-workspace/allternit-session-hud-mode/`

---

## Progress log

- [x] Clone Hermes Agent repo to `/Users/joe/Desktop/hermes-agent-fork`
- [x] Write this plan file
- [x] Map source files to target files

## Phase 1 — Foundation (geometry, IPC, persistence)

- [x] Port `electron/hud-geometry.ts` → `surfaces/allternit-desktop/src/main/hud-geometry.ts`
  - Adapt default width/height to Allternit (720×96 bar, max 520)
  - Keep `defaultHudBounds`, `normalizeHudResizeBounds`, `applyHudResetBounds`
- [x] Port `electron/hud-windowing.ts` → `surfaces/allternit-desktop/src/main/hud-windowing.ts`
  - Platform capability profile (macOS/Windows/X11/Wayland)
- [x] Extend `electron/main.ts` HUD section in `surfaces/allternit-desktop/src/main/unified-main.ts`
  - Add `hud-state.json` persistence
  - Add `resetHudLayout()`
  - Add `readHudState()` / `persistHudState()` / `schedulePersistHudState()`
  - Add Linux cursor feed and game overlay feed
  - Add broadcast HUD state to all windows
  - Hide main window while HUD open, restore on close
- [x] Extend preload bridge `surfaces/allternit-desktop/src/preload/index.ts`
  - Add `setIgnoreMouse`, `moveBy`, `setBounds`, `resetLayout`, `setFrost`, `setWorkspaceTransfer`, `onCursor`, `onGameOverlay`, `onGoto`, `open`, `close`
- [x] Extend `surfaces/ai.allternit.com/src/lib/globals.d.ts`
  - Type the new `window.allternit.shell.hud.*` methods

## Phase 2 — Input (click-through, drag, resize)

- [x] Port `src/app/hud/click-through.ts` → `surfaces/ai.allternit.com/src/shell/hud/click-through.ts`
  - Adapt selectors to Allternit composer bounds
  - Wire to `window.allternit.shell.hud.setIgnoreMouse`
- [x] Port `src/app/hud/composer-drag.ts` → `surfaces/ai.allternit.com/src/shell/hud/composer-drag.ts`
  - Long-press / Ctrl-drag to move HUD
  - Wire to `window.allternit.shell.hud.moveBy`
- [x] Port `src/app/hud/resize-handle.ts` → `surfaces/ai.allternit.com/src/shell/hud/resize-handle.ts`
  - Edge/corner resize handles
  - Wire to `window.allternit.shell.hud.setBounds`
- [x] Add `data-hud-grabbing` attribute support in drag/resize to veto click-through
  - Composer drag sets `data-hud-grabbing` on the composer bounds wrapper.
  - Resize handles set `data-hud-grabbing` while resizing.
  - `useHudClickThrough` vetoes `setIgnoreMouse(true)` whenever `[data-hud-grabbing]` is present.

## Phase 3 — Session / visibility / polish

- [x] Port `src/app/hud/handoff.ts` → `surfaces/ai.allternit.com/src/shell/hud/handoff.ts`
  - Report current session id to main
  - Resume session in main window when HUD closes
- [x] Port `src/app/hud/glass.ts` → `surfaces/ai.allternit.com/src/shell/hud/glass.ts`
  - Report frost state to main
- [x] Port `src/app/hud/game-overlay.ts` → `surfaces/ai.allternit.com/src/shell/hud/game-overlay.ts`
  - Listen to main fullscreen-app detection
- [x] Port `src/app/hud/thread-focus.ts` → `surfaces/ai.allternit.com/src/shell/hud/thread-focus.ts`
  - Keep composer focused when clicking transcript
- [x] Port `electron/hud-snap.ts` → `surfaces/allternit-desktop/src/main/hud-snap.ts`
  - Snap HUD to cursor
- [x] Add global snap shortcut (`Cmd/Ctrl+Shift+G`) in `unified-main.ts`

## Phase 4 — Shell integration

- [x] Refactor `surfaces/ai.allternit.com/src/shell/ShellApp.tsx`
  - Move HUD-specific logic into a new `HudShell` component under `src/shell/hud/HudShell.tsx`
  - Import and use `useHudClickThrough`, `useHudComposerDrag`, `useHudResizeHandle`, `useHudGlass`, `useHudGameOverlay`, `useHudThreadFocus`, `useHudHandoff`
  - Keep existing `isHudWindow` detection
- [x] Add CSS for HUD shell
  - Transparent html/body/#root
  - Band/sheet fade timings
  - Resize handle cursors
  - Composer drag affordance
- [x] Update routes / view detection if needed

## Phase 5 — Verify

- [x] Run `npm run typecheck` in `surfaces/allternit-desktop` ✅
- [x] Run `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` (pre-existing office-suite errors unrelated to HUD)
- [x] Build desktop main/preload ✅
- [x] Update `scratch/HERMES_HUD_GAP_ANALYSIS.md` with what landed
- [x] Fix `ChatActiveContent.tsx` prop mismatch (`linkedAgentSessionIds` → `linkedSessionIds`)
- [x] Update this plan file checkboxes as work completes

---

## Source → target mapping

| Hermes source | Allternit target | Notes |
|---|---|---|
| `apps/desktop/electron/hud-geometry.ts` | `surfaces/allternit-desktop/src/main/hud-geometry.ts` | New file |
| `apps/desktop/electron/hud-windowing.ts` | `surfaces/allternit-desktop/src/main/hud-windowing.ts` | New file |
| `apps/desktop/electron/hud-ipc.ts` | inlined into `surfaces/allternit-desktop/src/main/unified-main.ts` | Extend existing IPC |
| `apps/desktop/electron/hud-snap.ts` | `surfaces/allternit-desktop/src/main/hud-snap.ts` | New file |
| `apps/desktop/electron/hud-url.ts` | N/A | Allternit already loads `/hud` route |
| `apps/desktop/src/app/hud/click-through.ts` | `surfaces/ai.allternit.com/src/shell/hud/click-through.ts` | New file |
| `apps/desktop/src/app/hud/composer-drag.ts` | `surfaces/ai.allternit.com/src/shell/hud/composer-drag.ts` | New file |
| `apps/desktop/src/app/hud/resize-handle.ts` | `surfaces/ai.allternit.com/src/shell/hud/resize-handle.ts` | New file |
| `apps/desktop/src/app/hud/handoff.ts` | `surfaces/ai.allternit.com/src/shell/hud/handoff.ts` | Rewrite for Allternit session model |
| `apps/desktop/src/app/hud/glass.ts` | `surfaces/ai.allternit.com/src/shell/hud/glass.ts` | New file |
| `apps/desktop/src/app/hud/game-overlay.ts` | `surfaces/ai.allternit.com/src/shell/hud/game-overlay.ts` | New file |
| `apps/desktop/src/app/hud/thread-focus.ts` | `surfaces/ai.allternit.com/src/shell/hud/thread-focus.ts` | New file |
| `apps/desktop/src/app/hud/layout.ts` | `surfaces/ai.allternit.com/src/shell/hud/layout.ts` | New file |
| `apps/desktop/src/app/hud/hud-shell.tsx` | `surfaces/ai.allternit.com/src/shell/hud/HudShell.tsx` | Adapt to Allternit `ShellApp` |

---

## Constraints

- Do not modify tests unless required to compile.
- Do not refactor unrelated code.
- Match existing Allternit naming and file structure.
- Keep all changes scoped to the HUD feature.
