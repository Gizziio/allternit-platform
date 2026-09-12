# Steering checkpoint

- **Goal:** Fix #423 — desktop runtime relay silent-death (node dark until app restart).
- **Just did:** Worktree `desktop-relay-watchdog-0912` off origin/main. `auth-manager.ts` gained a relay heartbeat watchdog: `relayLastMessageAt` stamped on every WS message (cloud pings every 25s), a 30s interval closes the socket with code 4000 when the last message is older than 75s — the close handler stops the watchdog and schedules the existing backoff reconnect. Watchdog stopped in `clearSession()` too; `reconnectRuntimeRelay()` already funnels through the close handler. Desktop typecheck ✅, 125 vitest ✅, release-preflight 35/0 ✅.
- **Next:** PR → merge → ledger → rebuild desktop DMG from merged main (unsigned local build) → install into /Applications (quit running app first) → relaunch and verify `[Auth] Paired runtime relay connected` + viewer path.
- **Open questions:** none.
