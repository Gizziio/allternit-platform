# Bot computer opens in a dedicated Electron window (PR #516)

Session: bot-computer-window-0914 · Agent: grok (picked up from kimi-code session_4651d526 after a 5-hour quota 403 on "yes begin") · 2026-09-14 · Merge: 21303b597

## What was done

The bot-chat computer pane's **Open in ACI** button expanded the half-width ACI sidecar. Eoj asked for a real Electron window instead.

- Desktop IPC `shell:open-bot-computer` creates (or focuses) a full-size `BrowserWindow` at `/shell?detachedSurface=bot-computer&botId=…`, same pattern as detached code sessions.
- `BotComputerWindow` is chrome-free (no rail, no ACI). Layout `"window"` holds VNC claim priority 4 so the live stream moves into that window; the chat pane falls back to screenshots.
- Pane button label is **Open in window**. Browser fallback is a popup (or a new tab if blocked).
- Rebased onto main after PR #515; the only overlap in `BotComputerViewport.tsx` is that button label.

## Verification

- `vitest` `open-bot-computer-window.test.ts` + `bot-computer-vnc.test.ts` + `BotWatchStrip.test.tsx` — 9/9
- desktop `bot-computer-window.test.ts` — 4/4
- desktop `pnpm run typecheck` — clean
- Merged to `main` as merge commit `21303b597` (PR #516)

## Incidents / honest notes

- Parent kimi session died on a quota 403 while mapping Open-in-window after Eoj said "yes begin".
- Live click-through in the installed Allternit Desktop was **not** done this session. The app was not running (sidecars only). This change needs a desktop main/preload rebuild (new IPC) **and** the platform SPA that :8013 serves. No DMG rebuild this session.

## Outstanding

- Rebuild/launch desktop so **Open in window** is actually clickable in the installed app.
- Confirm Observe / Take over / Hand back in the dedicated window, and that the chat pane does not expand ACI.
- Terminal-glitch live re-profile remains with #515 (SPA on :8013).
