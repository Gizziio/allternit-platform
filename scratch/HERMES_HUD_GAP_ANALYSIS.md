# Gap Analysis: Allternit HUD Mode vs. Hermes Agent Desktop HUD

**Date:** 2026-08-26  
**Allternit worktree:** `/Users/joe/Desktop/allternit-workspace/allternit-session-hud-mode/`  
**Hermes source:** `https://github.com/NousResearch/hermes-agent` (main branch)  
**Scope:** Compare Allternit's current "workspace HUD mode" floating chat HUD against the actual Hermes desktop HUD implementation.

---

## 1. Scope note

Two separate Hermes codebases were available locally:

1. `/Users/joe/Desktop/Hermes-Bot-Mode` — a Nous Research plugin that adds a **Bots pane / Routines pane / avatar roster** to the Hermes desktop app. It is **not** a floating HUD.
2. `https://github.com/NousResearch/hermes-agent` — the actual Hermes Agent repo, which contains the real **floating chat HUD** under `apps/desktop/electron/` and `apps/desktop/src/app/hud/`.

This analysis focuses on **#2**, the real Hermes HUD. The Bot Mode plugin is referenced only where relevant as a contrast.

---

## 2. Hermes Desktop HUD — complete feature inventory

### 2.1 Windowing / shell behavior (main process)

| Feature | Source | Details |
|---|---|---|
| Dedicated HUD window | `electron/main.ts:12490` (`spawnHudWindow`) | Frameless, transparent, always-on-top panel |
| Default size | `electron/hud-geometry.ts` | `620 × 320 px` (`HUD_WIDTH` / `HUD_HEIGHT`) |
| Bottom margin | `electron/hud-geometry.ts` | `72 px` from screen bottom |
| Bottom-centered default | `electron/hud-geometry.ts:defaultHudBounds()` | Display-aware, clamps to work area |
| Min constraints | `electron/main.ts:12493` | min 380×160 |
| `panel` type on macOS | `electron/main.ts:12516` | Hidden from Mission Control / cmd-tab |
| Skip taskbar (Win/Linux) | `electron/main.ts:12515` | Keeps HUD out of alt-tab |
| Always-on-top | `electron/main.ts:12514` | Plus `promoteHudOverlay()` for WM dialects (Hyprland float+pin) |
| Rounded corners | `electron/main.ts:12519` | Clips vibrancy to HUD silhouette |
| Visual effect state | `electron/main.ts:12521` | `'active'` so frost renders while blurred |
| No shadow | `electron/main.ts:12517` | `hasShadow: false` |
| Non-resizable by default | `electron/main.ts:12497` | Avoids Windows transparent-frameless edge-resize drift bug |
| Background color | `electron/main.ts:12523` | `#00000000` |
| Geometry persistence | `electron/main.ts:12209` | `hud-state.json` in userData, validated against live displays |
| Persist debounce | `electron/main.ts:12265` | 250 ms |
| Reset layout | `electron/main.ts:12245` | `resetHudWindowLayout()` → `defaultHudBounds()` |
| Open HUD | `electron/main.ts:12610` | `openHudWindow(sessionId, profile)` |
| Close HUD | `electron/main.ts:12662` | `closeHudWindow()` restores main window |
| Toggle shortcut | Inferred from issues #81893, #88513 | `Ctrl+Shift+H` / `Cmd+Shift+H`; exact registration not located in surfaced source |
| Respawn on profile change | `electron/main.ts:12616` | Renderer adopts backend once at boot, so retargeting a different profile requires respawn |
| Session handoff on close | `electron/main.ts:12190` | Main holds `hudSessionId`, broadcasts so app window can resume |
| Hide main window while HUD open | `electron/main.ts:12549` | Restored on HUD close |
| Broadcast HUD state | `electron/main.ts:12480` | `hermes:hud:changed` sent to all windows |
| URL with profile | `electron/hud-url.ts` | `?win=hud&profile=<name>` before hash so HashRouter ignores it |
| Stream throttling | `electron/main.ts:12543` | HUD gets same unthrottling as chat windows during streaming |
| Console capture | `electron/main.ts:12562` | Renderer logs captured as `hud` |
| Window reveal controller | `electron/main.ts:12545` | Show/focus/promote sequence |

### 2.2 Platform-specific windowing profile

Hermes abstracts OS/compositor differences in `electron/hud-windowing.ts`:

| Platform | Move | Click-through | Client placement | Workspace transfer | Cursor feed |
|---|---|---|---|---|---|
| macOS | renderer drag | yes | yes | no | no |
| Windows | renderer drag | yes | yes | no | no |
| Native Wayland | native drag | yes | no | no | no |
| X11 | renderer drag + Ctrl-drag | no (solid) | yes | yes | yes |

### 2.3 IPC surface (`electron/hud-ipc.ts`)

| Channel | Direction | Purpose |
|---|---|---|
| `hermes:hud:native-drag` | sync main→renderer | Tells renderer whether native drag is active |
| `hermes:hud:windowing` | sync main→renderer | Exposes `clientPlacement`, `controlDrag`, `nativeDrag`, `workspaceTransfer` |
| `hermes:hud:workspace-transfer` | renderer→main | Temporarily `setVisibleOnAllWorkspaces` during X11/KWin drag |
| `hermes:hud:open` | renderer→main | Opens HUD with optional `sessionId`/`profile` |
| `hermes:hud:frost` | renderer→main | Tells main whether band covers window → macOS vibrancy |
| `hermes:hud:ignore-mouse` | renderer→main | `setIgnoreMouseEvents(true, { forward: true })` with X11 veto |
| `hermes:hud:move-by` | renderer→main | Drag move with screen deltas + pinned size |
| `hermes:hud:set-bounds` | renderer→main | Edge/corner resize; briefly flips `resizable` on |
| `hermes:hud:reset-layout` | renderer→main | Resets to default bounds |
| `hermes:hud:session` | renderer→main | Reports which session HUD is on |
| `hermes:hud:close` | renderer→main | Closes HUD |
| `hermes:hud:cursor` | main→renderer | Linux cursor feed (60 ms poll) |
| `hermes:hud:game-overlay` | main→renderer | Fullscreen app detection under HUD |
| `hermes:hud:goto` | main→renderer | Retarget HUD to a different session |

### 2.4 Cursor / click-through / input

- **Click-through decision** lives in `src/app/hud/click-through.ts`.
  - Mouse is ignored when cursor is over empty window space, composer is NOT focused, and no overlay/dialog is focused.
  - Vetoed while dragging (`data-hud-grabbing`).
  - On Linux, uses main's cursor poll because `{ forward: true }` is unavailable.
- **Linux cursor feed**: `electron/main.ts:12334` polls `getCursorScreenPoint()` every 60 ms and pushes `hermes:hud:cursor`.
- **No `-webkit-app-region: drag`** on macOS/Windows because it starves click-through.
- **Native Wayland** uses `-webkit-app-region: drag` because compositor handles placement.

### 2.5 Composer drag (`src/app/hud/composer-drag.ts`)

- Long-press (`140 ms`) on composer to arm drag.
- Ctrl+primary-button immediate grab on X11.
- Screen-coordinate deltas (not client, because window moves).
- Snapshots outer size and sends with every move to prevent Windows drift.
- Workspace transfer on X11/KWin.

### 2.6 Resize handles (`src/app/hud/resize-handle.ts`)

- 8 directions on macOS/Windows/X11; only `e`, `se`, `s` on native Wayland.
- Min 380×160.
- Programmatic `setBounds` with brief `resizable: true`.
- `data-hud-grabbing` prevents click-through during resize.

### 2.7 Renderer shell (`src/app/hud/hud-shell.tsx`)

- Mounts the **same wired chat surface** as the workspace pane, so composer has slash commands, attachments, queue, voice, `@` refs, model pill.
- Thread/band visibility controlled by `data-hud-recent`, `data-hud-edge`, `data-hud-game`.
- **Recent activity hold**: 1100 ms after new message/stream/busy.
- **Held states**: game overlay, awaiting input prompt, busy + grace window.
- **Edge detection**: polls `window.screenY` every 300 ms with hysteresis to flip composer top/bottom (currently `HUD_THREAD_ALWAYS_BELOW = true`).
- **Band height**: measured from actual message rows + 12 px overhang; uses all available window space below composer.
- **Filled detection**: reports whether band covers window to gate native frost.
- CSS timing vars: reveal 110 ms, fade 180 ms, dim 270 ms, collapse 120 ms.

### 2.8 Frost / glass

- `src/app/hud/glass.ts` reports to main via `setFrost()` when composer is focused, band covers window, and no completion drawer is open.
- Main applies macOS vibrancy in `electron/hud-ipc.ts:applyHudFrost()`.
- Windows skips native frost because `setBackgroundMaterial` kills per-pixel alpha on transparent windows.

### 2.9 Game overlay

- `src/app/hud/game-overlay.ts`, `electron/main.ts:12381`.
- Main polls OS window list while HUD is open.
- Detects fullscreen app under HUD.
- Sets `data-hud-game` → idle bar steps to overlay opacity, transcript stays up unconditionally.
- Requires macOS screen recording permission for window titles.

### 2.10 Snap-to-pointer

- `electron/hud-snap.ts`, `electron/hud-snap-shortcut.ts`.
- Global `Cmd/Ctrl+Shift+G` while HUD open.
- Snaps HUD so anchor point (center, 48 px down) sits under cursor.
- Clamped to keep at least 40 px visible.
- No-op on native Wayland (can't position).

### 2.11 Session / profile handoff (`src/app/hud/handoff.ts`)

- `hudTargetSessionId()` picks active workspace pane or fronted tile.
- `useHudHandoff()` in app window: reloads drafts, resumes HUD session on close.
- `useHudGoto()` in HUD: follows `hermes:hud:goto` retarget.
- `useReportHudSession()` in HUD: reports `selectedStoredSessionId` to main.
- Session transport binding moves with the window; app window must re-resume to take stream back.

---

## 3. Allternit HUD Mode — current inventory

### 3.1 Floating chat HUD (renderer + desktop)

| Capability | Status | Where |
|---|---|---|
| Frameless, transparent, always-on-top floating panel | ✅ | `surfaces/allternit-desktop/src/main/unified-main.ts:1945-1982` |
| Default 720×96 px composer bar, grows up to 520 px | ✅ | `unified-main.ts:1922-1924` |
| Bottom-centered on primary display | ✅ | `unified-main.ts:1927-1935` |
| macOS `panel` type, hidden from Mission Control | ✅ | `unified-main.ts:1956-1964` |
| Global hotkey `Cmd/Ctrl+Shift+H` + `Alt+Shift+H` fallback | ✅ | `unified-main.ts:184-185, 1736, 1744` |
| Tray "Toggle HUD" item + `allternit://hud` deep link | ✅ | `unified-main.ts:1408, 1427, 1460-1463` |
| Renderer drag handle | ✅ | `surfaces/ai.allternit.com/src/shell/ShellApp.tsx:646-688, 750-783` |
| Renderer close button | ✅ | `ShellApp.tsx:773-783` |
| Auto-focus composer on open | ✅ | `ShellApp.tsx:648-660` |
| Auto-grow window height with transcript | ✅ | `ShellApp.tsx:696-721` |
| `Meta+Shift+H` in-app toggle | ✅ | `ShellApp.tsx:406-409` |
| Hide shell chrome, rails, header, disclaimers | ✅ | `ShellApp.tsx:723-793`, `ChatBottomBar.tsx:58-102` |
| Hide empty-state placeholder in HUD | ✅ | `CoworkTranscript.tsx:27-31, 318-322` |
| Show only assistant/tool content (not user bubbles) | ✅ | `ChatActiveContent.tsx:55-72` |
| IPC: `shell:move-hud`, `shell:set-hud-bounds` | ✅ | `unified-main.ts:2053-2100`, `preload/index.ts:280-291` |

### 3.2 Backend HUD collectors (orphaned)

| Endpoint | What it returns | Where |
|---|---|---|
| `GET /api/v1/hud/summary` | gateway health/sessions, peers, recordings, local runtime | `cmd/allternit-api/src/hud_routes.rs:24, 112-156` |
| `GET /api/v1/hud/peers` | `~/.allternit/peers/registry.json` | `hud_routes.rs:25, 160-201` |
| `GET /api/v1/hud/recordings` | last 50 `~/.allternit/recordings/*.jsonl` | `hud_routes.rs:26, 205-265` |
| `GET /api/v1/hud/health` | platform + gateway health | `hud_routes.rs:27, 269-292` |

These routes are implemented and protected by Clerk, but the dashboard UI that consumed them was deleted in commit `8bc131d73`; `/hud` is now only the floating chat surface.

### 3.3 Known issues / limitations

- **Main app renderer crash** at `ControlCenter.tsx:32` — blocks normal app usage.
- **Global hotkey not manually verified** from another app; macOS Accessibility permission may block it.
- **No click-through / ignore-mouse-events** for transparent areas.
- **Window is non-resizable**; no renderer corner handles.
- **No bot roster, avatars, routines, or bot-to-bot messaging** in the HUD.
- **No session handoff** back to the main window on HUD close.
- **No geometry persistence** for HUD position/size.

---

## 4. Gap analysis

### 4.1 Allternit missing vs. Hermes HUD

| Hermes feature | Allternit status | Severity | Notes |
|---|---|---|---|
| Click-through / ignore-mouse-events | ❌ Missing | High | Hermes has per-element hit-test; Allternit is a solid rectangle |
| Native vibrancy / frost glass | ❌ Missing | Medium | Hermes uses macOS vibrancy behind the band; Allternit uses CSS only |
| Game overlay detection | ❌ Missing | Low/Medium | Hermes detects fullscreen app and changes styling |
| Linux cursor feed | ❌ Missing | Medium | Needed because `{ forward: true }` doesn't work on Linux |
| Geometry persistence | ❌ Missing | Medium | Hermes saves/restores `hud-state.json` |
| Reset layout | ❌ Missing | Low | Hermes has `hermes:hud:reset-layout` |
| Snap-to-pointer shortcut | ❌ Missing | Low | Hermes uses `Cmd/Ctrl+Shift+G` |
| Edge-aware composer placement | ❌ Missing | Low | Hermes flips composer top/bottom based on screen position |
| Activity/held band visibility | Partial | Medium | Allternit hides empty state; Hermes has nuanced hold/fade logic |
| Full chat composer parity | Partial | Medium | Allternit's HUD uses same composer but strips some chrome |
| Session handoff on close | ❌ Missing | High | Hermes reports session id so app can resume; Allternit just closes |
| Profile-aware HUD window | ❌ Missing | High | Allternit has no concept of spawning HUD bound to a specific agent profile |
| Resize handles | ❌ Missing | Medium | Allternit is non-resizable; Hermes has renderer edge/corner handles |
| Composer long-press drag | Partial | Low | Allternit has drag handle; Hermes drags by long-pressing composer |
| Broadcast HUD state to all windows | ❌ Missing | Low | Hermes keeps every window's toggle state correct |
| Stream unthrottling while blurred | ❌ Missing | Low | Hermes registers HUD with stream throttle |
| Hide/restore main window | Partial | Low | Allternit doesn't hide main window on HUD open |
| Platform windowing profile abstraction | ❌ Missing | Medium | Hermes has `hud-windowing.ts` for OS-specific capabilities |

### 4.2 Allternit has / Hermes HUD lacks

| Allternit feature | Hermes status | Notes |
|---|---|---|
| Backend REST collectors for gateway/peers/recordings/health | ❌ Not in Hermes HUD | Hermes HUD is client-only; no collector API |
| Clerk-protected `/api/v1/hud/*` endpoints | ❌ Not applicable | Hermes auth is gateway/desktop token based |
| Multi-surface web + desktop HUD route | Partial | Hermes desktop HUD is desktop-only; web dashboard is separate |
| Rust/Axum backend for HUD data | ❌ Not applicable | Hermes backend is Python `hermes serve` |
| Operational dashboard panels (deleted in Allternit) | ❌ Not in Hermes HUD | Hermes HUD is chat-only, no dashboard panels |

---

## 5. Recommended next steps

1. **Fix the `ControlCenter.tsx:32` crash** so the main app is usable.
2. **Implement click-through** — this is the biggest UX gap. Port the hit-test logic from `src/app/hud/click-through.ts` and the `ignore-mouse` IPC from `electron/hud-ipc.ts`.
3. **Add geometry persistence** for the HUD window (`hud-state.json` equivalent).
4. **Add session handoff** so closing the HUD returns the active conversation to the main window.
5. **Add resize handles** (renderer edge/corner) and briefly flip `resizable` for `setBounds`.
6. **Add Linux cursor feed** if targeting Linux (Allternit currently doesn't handle X11 click-through restore).
7. **Decide on profile awareness** — whether Allternit HUD should be bound to a specific agent profile like Hermes.
8. **Restore or rebuild the operational dashboard** if the original collector endpoints are still desired; the backend routes already exist.

---

## 6. Forkability assessment

See the follow-up discussion for which Hermes files can be forked into Allternit, which need Allternit-specific redesign, and which non-TypeScript parts require analysis rather than direct porting.
