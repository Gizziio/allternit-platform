# HUD Mode Handoff — Hermes-style floating chat HUD

**Branch pushed:** `session/hud-mode` on `Gizziio/allternit-platform`  
**Commit:** `8bc131d73` — `refactor(desktop): Hermes-style floating chat HUD`

---

## What was changed

| Area | Change |
|------|--------|
| **Desktop main process** | `surfaces/allternit-desktop/src/main/unified-main.ts` — HUD window is now a compact `NSPanel`-style floating bar (720×220 default, bottom-anchored), frameless, transparent, non-resizable, always-on-top, hidden from Mission Control/taskbar. Added `shell:move-hud` IPC for renderer-driven dragging. Global hotkey changed to `Cmd/Ctrl+Shift+H` (Hermes style) with `Alt+Shift+H` fallback. |
| **Preload bridge** | `surfaces/allternit-desktop/src/preload/index.ts` + `src/lib/globals.d.ts` — exposed `window.allternit.shell.moveHudBy(delta)`. |
| **HUD renderer shell** | `surfaces/ai.allternit.com/src/shell/ShellApp.tsx` — when loaded at `/hud`, renders a chrome-free floating chat panel with a drag handle, close button, dark frosted theme, and auto-focuses the composer. |
| **Chat stream plumbing** | `ChatView.tsx`, `ChatActiveContent.tsx`, `CoworkTranscript.tsx`, `ChatBottomBar.tsx`, `ChatViewWrapper.tsx` — `hideEmptyState` is now threaded through to the transcript so the HUD does not show the "Session started. Send a message to begin." placeholder, and the disclaimer is hidden to save vertical space. |
| **Cleanup** | Deleted the local `surfaces/ai.allternit.com/src/views/hud/` dashboard view and removed its registry entry so `/hud` always maps to the floating chat surface. |

---

## How to run / test

```bash
# 1. Platform dev server
cd surfaces/ai.allternit.com
ALLTERNIT_API_URL=http://127.0.0.1:8013 \
VITE_ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013 \
VITE_ALLTERNIT_API_URL=/api/v1 \
VITE_ENABLE_VOICE_SERVICE=false \
./node_modules/.bin/vite --port 3017

# 2. Build the desktop main/preload
cd surfaces/allternit-desktop
npm run build

# 3. Run Electron
ALLTERNIT_PLATFORM_URL=http://localhost:3017 \
NODE_ENV=development \
./node_modules/.bin/electron . \
  --user-data-dir=/tmp/hud-desktop-test \
  --remote-debugging-port=9225 \
  --remote-allow-origins=*
```

Then press `Cmd+Shift+H` (or `Alt+Shift+H`) to toggle the HUD.

**Note on auth:** `resources/company.json` was left with `selfHosted: false` (production default). For quick local HUD testing without Clerk you can temporarily flip it to `true`, but **revert before merging**.

---

## What is working now

- HUD opens as a transparent, frameless, always-on-top floating bar.
- Default geometry is 720×220, bottom-centered — composer dominates, transcript expands upward when messages exist.
- Close button works via `shell.closeHud()`.
- Drag handle works via renderer pointer events + `shell.moveHudBy()` IPC.
- Empty-state placeholder and footer disclaimer are hidden in HUD mode.
- Composer is auto-focused on open.
- Global hotkey is registered at app startup (logged in main process).

Screenshots captured during testing:

- `/tmp/hud-cdp8.png` — HUD as a dark frosted chat bar (720×220).
- `/tmp/hud-moved.png` — HUD floating over the main Allternit window after a `moveHudBy` call.
- `/tmp/hud-fullscreen.png` — earlier full-screen proof showing the HUD above other app chrome.

---

## Known issues / next agent TODO

1. **Main app renderer crash on launch**  
   The main Allternit window currently crashes immediately after load with:
   ```
   TypeError: Cannot read properties of null (reading 'useState')
   at ControlCenter (src/shell/ControlCenter.tsx:32)
   ```
   This looks like a React hook-resolution/deps problem in this worktree and **blocks normal app usage**, but the HUD can still be toggled via the main-window IPC. The next agent should fix this first; it is likely unrelated to the HUD changes but makes end-to-end manual testing hard.

2. **Visual polish vs. Hermes**  
   The provided screen recording (`Downloads/Screen Recording 2026-08-25 at 3.15.05 PM.mov`) did not actually contain the Hermes HUD — it was a robot animation. I used the public Hermes Desktop source (`NousResearch/hermes-agent`) as the reference. The current Allternit HUD is functionally close but may still need tweaks to corner radius, composer height, font sizing, and the empty-state/messages sheet behavior to match the exact Hermes look. A real Hermes screenshot/video would help.

3. **Global shortcut manual verification**  
   The shortcut is registered and the tray menu shows it, but I verified toggling via renderer IPC (`window.allternit.shell.toggleHud()`), not by physically pressing `Cmd+Shift+H`. The next agent should confirm the global hotkey works from another app and debug Accessibility-permission issues if it does not.

4. **Click-through / ignore-mouse-events**  
   Hermes enables pointer click-through for transparent areas around the bar. Allternit's HUD is currently a solid input rectangle. Adding `setIgnoreMouseEvents(true, { forward: true })` with renderer hit-testing (like Hermes) is the next feature step.

5. **Resize affordance**  
   The window is currently non-resizable to avoid Electron transparent-frameless edge bugs. Hermes resizes via renderer corner handles + `hermes:hud:set-bounds`. If users need resize, implement the same pattern.

6. **Voice service fails to start**  
   Local `chatterbox-tts` install fails because `gradio==5.44.1` is not available in the locked pip index. This is pre-existing and unrelated to the HUD, but it adds noise to the desktop logs.

---

## Files in the commit

```
surfaces/ai.allternit.com/src/lib/globals.d.ts
surfaces/ai.allternit.com/src/shell/ChatViewWrapper.tsx
surfaces/ai.allternit.com/src/shell/ShellApp.tsx
surfaces/ai.allternit.com/src/views/ChatView.tsx
surfaces/ai.allternit.com/src/views/chat/main/ChatActiveContent.tsx
surfaces/ai.allternit.com/src/views/chat/main/ChatBottomBar.tsx
surfaces/ai.allternit.com/src/views/cowork/CoworkTranscript.tsx
surfaces/allternit-desktop/src/main/unified-main.ts
surfaces/allternit-desktop/src/preload/index.ts
```

---

## Quick reference for the next agent

- HUD route: `http://localhost:3017/hud` — loaded by the desktop HUD window.
- Desktop HUD window logic: `surfaces/allternit-desktop/src/main/unified-main.ts` (search `createHudWindow`, `toggleHudWindow`, `shell:move-hud`).
- HUD renderer UI: `surfaces/ai.allternit.com/src/shell/ShellApp.tsx` — `if (isHudWindow)` block.
- Hermes reference implementation: `NousResearch/hermes-agent` → `apps/desktop/electron/main.ts` (`spawnHudWindow`), `hud-geometry.ts`, `hud-ipc.ts`, `hud-windowing.ts`.

---

## Update — main renderer crash fixed + HUD route wired

**Branch:** `session/hud-mode-crash-fix` (new worktree)  
**Agent:** continued from HUD handoff; fixed the `ControlCenter` launch crash and the missing `/hud` route wiring.

### What changed

| File | Change |
|------|--------|
| `surfaces/ai.allternit.com/vite.config.ts` | Added explicit `resolve.alias` entries for `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, and `react-dom/client` so every import resolves to the platform surface's React 18 copy. The workspace root can resolve React 19 (e.g. from `framer-motion` dev deps), and transitive workspace imports were pulling in that root instance alongside React 18, breaking the hook dispatcher. |
| `surfaces/ai.allternit.com/public/sw.js` | Service worker no longer cache-firsts Vite development module URLs (`/node_modules/.vite/`, `/src/`, `/@fs/`, `/@vite/`). Mixing stale cached chunks with fresh re-optimized chunks was producing mismatched React/React-DOM instances and the same `useState`/`useContext` null-dispatcher crash. |
| `surfaces/ai.allternit.com/src/routes.tsx` | Added `<Route path="/hud" element={<ShellPage />} />` so the desktop HUD window can load `/hud` instead of being redirected to `/` by the catch-all. |
| `surfaces/ai.allternit.com/src/nav/nav.types.ts` | Added `"hud"` to the `ViewType` union. |
| `surfaces/ai.allternit.com/src/nav/nav.policy.ts` | Added spawn policy for the `hud` view type. |

### Verification status

- Reproduced the crash class in a Playwright headless run against the Vite dev server: `Cannot read properties of null (reading 'useContext')` in `AuthGate` (`ShellApp.tsx`), preceded by "Invalid hook call" warnings about multiple React copies.
- Confirmed the workspace root resolves React 19 while the platform surface resolves React 18.
- Verified in a headless browser (with workspace office packages excluded from Vite's eager optimization scan for the demo):
  - Main platform home loads without the `ControlCenter` crash.
  - `http://localhost:3017/hud` renders the floating chat HUD (dark frosted bar, drag handle, close button, composer at the bottom).

### Remaining TODOs from original handoff

1. ~~Main app renderer crash on launch~~ — fixed via React aliases + service worker fix.
2. ~~HUD route wiring~~ — `/hud` now maps to `ShellPage` and the HUD view renders.
3. Visual polish vs. Hermes — still needs a real Hermes screenshot/video.
4. Global shortcut manual verification — still needs physical `Cmd+Shift+H` test.
5. Click-through / ignore-mouse-events — next feature step.
6. Resize affordance — next feature step.
7. Voice service fails to start — pre-existing, unrelated.
