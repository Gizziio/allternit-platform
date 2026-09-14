# Hidden noVNC streams no longer starve the desktop (PR #515)

Session: novnc-cpu-tame · Agent: grok (picked up from kimi-code session_02f5f410 after a 5-hour quota 403) · 2026-09-14 · Merge: e016ed8ee

## What was done

Fabric Transport terminals were glitching whenever Allternit Desktop had a live bot-desktop watch or ACI computer view open. A CDP 6s profile of the spinning renderer showed ~470–510% CPU: 26% noVNC decode, 7% `_allocateBuffers`, 30% GC, plus WebSocket reconnect churn. Load average hit 123 on a 10-core Mac and starved the node daemon's terminal relay. Closing the VNC view dropped the renderer to ~2.5%.

- `BotWatchStrip` no longer opens a full-resolution RFB for the 140×88 thumbnail. Screenshot poll only; paused when offscreen or `document.hidden`.
- `BotComputerViewport` disconnects RFB when the pane fails IntersectionObserver or the page is hidden; `resizeSession: false`; screenshot poll skipped while RFB can connect; reconnect only when the ws URL actually changes (status poll no longer tears the socket down every 5s).

## Verification

- `vitest run src/views/bots/BotWatchStrip.test.tsx src/views/bots/bot-computer-vnc.test.ts` — 5/5
- `tsc --project tsconfig.typecheck.json --noEmit` — no errors in the touched files (pre-existing office-app asset errors unchanged)
- Merged to `main` as merge commit `e016ed8ee` (PR #515). CI on the PR: Vercel rate-limit (repo-wide, pre-existing); `validate-typography` fail in `CoworkRightRail.tsx` (unrelated, pre-existing on main).

## Incidents / honest notes

- Parent kimi session died mid-subagent on a quota 403; uncommitted viewport/strip edits in `allternit-icon-fix` were the starting point.
- Live CPU re-profile of the packaged b2661 renderer is deferred until the platform UI the desktop loads from `:8013` is serving this merge. No desktop DMG rebuild this session — the running app loads the SPA from the sidecar, not a bundled copy of these files.

## Outstanding

- Joint PWA daemon test (terminal with app quit, Start desktop) still waiting on Eoj connected on Fabric Transport v45.
- Desktop rebuild on next cut will pick the SPA change up in the bundled platform assets.
