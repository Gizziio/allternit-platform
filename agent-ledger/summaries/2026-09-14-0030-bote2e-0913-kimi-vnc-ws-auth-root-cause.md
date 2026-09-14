# bote2e-0913 — VNC WS auth root cause (PR #492), #486 revert (PR #495)

**Session:** bote2e-0913 (Kimi Code) · **Date:** 2026-09-14 (early AM) · **Agent family:** kimi
**Continues:** the bote2e-0913 series (template build → handoff cycle → deferral pass). Trigger: the owner's report "you can't see the computer in the UI — it doesn't open to a desktop view."

## The actual root cause (the whole chain was chasing the wrong layer)

The bot-desktop VNC WebSocket never carried authentication. Browser WebSocket
handshakes **cannot send custom headers** — the desktop app's bearer-token
injection (`onBeforeSendHeaders`) applies to fetches, not upgrade requests. So
every `/ws/bots/*/desktop/vnc` handshake **401'd at `auth_middleware`**
(Clerk) before the route could validate its own short-lived HMAC-signed
desktop token (`?token=`).

Proven with a **raw HTTP upgrade request from Node** — no browser, no
mixed-content layer involved:

- Before: `HTTP/1.1 401 Unauthorized {"error":"Missing authorization token"}` — even with a fully valid desktop token.
- After PR #492: `HTTP/1.1 101 Switching Protocols`, and an external WS client receives the RFB greeting through the full proxy chain (api → tcp://tart-host:15901 → ssh forward → x11vnc on guest 127.0.0.1:5900). The stream stops at one frame for a passive listener because RFB waits for the client handshake — a real viewer (noVNC) completes it.

**Why the misdiagnosis happened:** CDP never emits `requestWillBeSent` for failed ws upgrades in this Electron build — `webSocketCreated` then `webSocketClosed` with nothing between. That looked like a pre-network block, so PR #486 blamed mixed content and set `allowRunningInsecureContent: true` on the main window. Experiments then showed ws:// failing even with `webSecurity: false` and the `--allow-running-insecure-content` switch — impossible for a content-settings block — which finally broke the theory. The external-client test bypassed the browser entirely and exposed the 401 immediately.

## Landed

- **PR #492** (`fix(api): authenticate /ws/* via the desktop WebSocket token`): `auth_middleware` accepts a valid desktop WS token on `/ws/*` paths (HMAC + expiry verified) and injects the claimed `AuthUser`; the ws route keeps re-verifying claims against the path. Invalid tokens fall through to the existing fallbacks; non-`/ws/` requests untouched. Tests: `--lib auth::` 31 passed incl. 4 new (valid / wrong-secret / expired / malformed).
- **PR #495** (revert of #486): restores `allowRunningInsecureContent: false` on the main window — #486 fixed a non-problem. The installed app's asar was also hand-cleaned of all three experimental hacks (flag, CLI switch, `webSecurity: false`) back to stock.

## Product-behavior findings (not fixed — documented for follow-up)

1. **The Computer pane freezes when the app window is occluded** — `loadStatus` early-returns on `document.hidden`, and macOS marks fully-occluded windows hidden. When the desktop window sits behind other windows, the pane never updates (stuck at the last state, often "off"). Correct resource behavior, but it makes the pane look dead; consider a screenshot fallback or a "window not focused" hint. This also invalidated several hours of automated verification until `document.hidden` was overridden in-page.
2. **Pane status-poll abort race:** the 5s poll interval aborts any in-flight status call; when the tart host is slow (>5s/call), every call is cancelled before completing and the pane starves at its last state. Bounded by PR #490's host timeouts, but the client-side interval should back off instead of aborting.
3. **Gizzi sandbox mapping in the desktop db** (`~/Library/Application Support/@allternit/desktop/allternit/allternit.db`) still contains session-manual rows from this campaign (`bot_desktop_sandboxes` + `computers` for `allternit-bot-0bd4…`); they are truthful (VM real, running) but a future clean provision should let the api write them itself.

## Verification status (honest)

- WS auth: 101 + RFB frame through the proxy, external client — **proven**.
- Handoff cycle at the api layer — **proven earlier** (observe/take-over/hand-back 200s with correct `control_state`).
- UI canvas pixels — **not captured**: with the window occluded the pane won't poll; forcing `document.hidden=false` restarts polling but noVNC's connect runs through the pane's own effect chain, and the window could not be raised (no Apple Events authorization) to let it run naturally. With the auth fix in, the remaining path is standard noVNC-over-WS; the acceptance check is: bring the app to the front → Gizzi chat → Computer → Take over → desktop appears.

## Environment state left behind

- App: rebuilt from main earlier + clean stock asar; adopts a standalone release api built from post-#492 main (the app's own child api crash-loops only when the standalone is down — restart order: api first, then app).
- Tart host: golden `allternit-desktop` image (Xvfb/openbox/x11vnc, autostart-verified) + PR #490 timeout-hardened `allternit-tart-host` (backup `.bak-pre-timeout`).
- `ALLTERNIT_DESKTOP_WS_SECRET` must be in the api env for signed ws_urls (launching the app from a shell with it exported is enough; the standalone api run uses `~/.kimi-code/scratch/api-logs/ws-secret-3`).
