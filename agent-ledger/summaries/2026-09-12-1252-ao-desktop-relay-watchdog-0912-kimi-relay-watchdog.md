# 2026-09-12 — Desktop runtime relay heartbeat watchdog (#423/#424)

- **Session:** ao (Kimi Code), worktree `desktop-relay-watchdog-0912`
- **PR:** #424 (`9a56125e8`, merged) — fixes #423 (auto-closed)

## What was done

Eoj reported Fabric Transport's desktop viewer failing with the runtime relay offline. Diagnosis: the desktop app (running ~17h) held **no outbound WebSocket** to the cloud relay; the local gateway was healthy. Restart reconnected immediately (`[Auth] Paired runtime relay connected`), confirming a silently-dead relay socket — reconnect was only scheduled from the WS `close` event, which never fires for half-open connections (sleep/network change/NAT timeout).

Fix in `surfaces/allternit-desktop/src/main/auth-manager.ts`: heartbeat watchdog. The cloud relay pings every 25s (`runtime_relay.rs`); `relayLastMessageAt` is stamped on every message, and a 30s interval closes the socket (code 4000) when the last message is older than 75s. The existing close handler stops the watchdog and schedules the existing exponential-backoff reconnect. Also stopped in `clearSession()`.

## Verification

- `npm run typecheck` (main + preload) ✅
- `npm test` (desktop) — 125 passed ✅
- `node scripts/release-preflight.mjs` — 35/0 ✅ (desktop release path per the v1.1.1 release lock)
- Live ops: restarted the installed desktop app at ~12:40 local; relay connected within ~1s and stayed connected (verified via lsof + main.log).

## Rollout

Fix ships with the desktop app. A local unsigned rebuild from merged main was done next (see the session report to the user); the installed `/Applications/Allternit Desktop.app` was replaced and relaunched.
