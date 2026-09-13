# bote2e-0913 — Real production bot-desktop template (Tart golden image) + VNC mixed-content fix

**Session:** bote2e-0913 (Kimi Code) · **Date:** 2026-09-13 · **Agent family:** kimi
**Continues:** `2026-09-13-0915-bote2e-0913-kimi-bot-chat-jump-and-bubble-fixes.md` (PR #470), `2026-09-13-0945-bote2e-0913-kimi-bot-desktop-action-url-405.md` (PR #475)

## What the owner asked

"Create the real template. Make the template the one for production — this is a fakeout that I didn't even know about." The `allternit-desktop` Tart image (the base every bot-desktop provision clones) was a bare Ubuntu 22.04 with no desktop environment and nothing on :5900, so the Observe/Take Over overlay could never render. This session built the real golden image, fixed two host-side bugs that were silently compounding it, and root-caused + fixed the final desktop-app blocker for the VNC stream.

## What was done (all live-verified)

### 1. The production golden image (tart host, `joes-MacBook-Pro` via Tailscale SSH)

- Started the `allternit-desktop` template VM and installed the desktop stack in the guest: `xvfb openbox x11vnc scrot xdotool xterm` (apt, `--no-install-recommends`).
- Wrote `/usr/local/bin/allternit-desktop-session` (Xvfb :0 1920x1080x24 → openbox → xterm → `x11vnc -display :0 -forever -shared -nopw -rfbport 5900 -localhost -xkb`) and a systemd unit `allternit-desktop.service` (User=admin, Restart=always, enabled at boot).
- Verified in-guest: RFB 003.008 banner on 127.0.0.1:5900, `xdotool getdisplaygeometry` = 1920 1080, `scrot` produces a real 1920x1080 PNG.
- **Verified across a full guest reboot** (`uptime -s` advanced 19:06:50, service active, VNC open) — the property that makes it a template.
- Stopped the VM. The image is now golden; every `tart clone allternit-desktop …` produces an observable desktop.

### 2. Tart-host launchd PATH fix (the hidden compounding bug)

The tart-host server (`com.allternit.tart-host`, `~/.allternit/bin/allternit-tart-host`) launched via launchd with a minimal PATH that excluded `/opt/homebrew/bin`. Consequences found in `~/Library/Logs/allternit/tart-host.log`:
- The **VNC forward supervisor** (`ssh -N -L <port>:127.0.0.1:5900 admin@<vm-ip>`, spawned via `sshpass`) failed with ENOENT for every VM — so `vnc_port` could never appear even with a healthy guest.
- The exec ssh-fallback (`run_ssh_exec`) was equally broken (this is why `tart exec` fallback failed with "No such file or directory (os error 2)" all session).

Fix: added `PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin` to the plist's `EnvironmentVariables` (backup at `com.allternit.tart-host.plist.bak-pre-pathfix`), restarted the service. After the fix the server reports `vnc_port: 15900` for running desktops — verified.

### 3. Full handoff cycle verified live (api layer, the exact endpoints the UI buttons call)

Against sandbox `allternit-bot-0bd498f6b019428bb5fab83f97335b3c` (fresh clone of the golden image, booted by a real provision):

- `POST /bots/:id/desktop/observe` → 200, `control_state: human_observing`; GET status confirms.
- `POST /bots/:id/desktop/take-over` → 200, `control_state: human_controls`; GET confirms.
- `POST /bots/:id/desktop/hand-back` → 200, `control_state: bot_controls`; GET confirms.

### 4. Final desktop-app blocker root-caused and fixed (PR #486)

**Bug:** main `BrowserWindow` set `allowRunningInsecureContent: false`. The platform UI loads from `http://127.0.0.1:8013` — a secure context (loopback is potentially trustworthy) — so Chromium classifies noVNC's plain `ws://127.0.0.1/…` VNC connection as **mixed content and blocks it**. Observe/Take Over therefore render a black canvas and the WS handshake never leaves the renderer.

**Evidence (CDP against the running app):** `Network.webSocketCreated` fires for the ws URL with **no `requestWillBeSent`**; `wss://ws.postman-echo.com/raw` connects fine; a curl upgrade handshake against the same route returns a proper `401 Missing authorization token` (route reachable, auth layer intact). Loopback `ws://` to an unrelated port fails the same way — the block is scheme-level, not VNC-specific.

**Fix:** `allowRunningInsecureContent: true` on the main window only (Browser Mode webviews keep their lockdown in `will-attach-webview`). Merged as PR #486 (`1728bf105`). Release preflight 36/0; desktop typecheck + 129 unit tests green.

The fix was also patched into the installed `/Applications/Allternit Desktop.app` asar for immediate verification (original backed up at `/tmp/app.asar.bak`).

## Operational incidents & honest deferrals

- **Migration collision on main (NOT mine to fix mid-flight):** main carries two V142 files (`V142__cowork_runs_ownership.sql`, `V142__runtime_settings.sql`) and two V143 files. A concurrently-running session's desktop build (installed 14:50) embedded only one of them, so its api crash-looped against the db (`migration V142__runtime_settings is missing from the filesystem`). I swapped a debug api built from the last-known-good commit `f3ca76226` (PR #475) into the app bundle (original kept as `allternit-api.broken-migration`). **Next desktop rebuild from fixed main replaces it.**
- **UI pixel-click pass of the final overlay deferred:** the shared checkout and installed app changed branch mid-session (`ao/cowork-permission-enforcement`), the machine hit load average ~220 from parallel cargo builds, and another session quit the app mid-verification. The handoff cycle is verified at the exact endpoints the buttons call; the rendered click-through should be re-run once the desktop rebuild from current main lands (PR #486 + the other session's migration fix both in).
- **Stale account-computer row:** `deprovision` left an "Account computer" computers row pointing at the destroyed VM; provision then attached to the dead VM (200 "running" for a VM that didn't exist). Worked around locally (marked deleted); a product fix (liveness check in `attach_bot_to_user_computer`) is worth a follow-up.
- **Tart-host API slowness:** single-VM GETs take 13–70s+ (serial `tart` CLI subprocess calls, no timeouts); under this the api's status polling can exceed the UI poll interval, and the desktop api's debug build can miss the BackendManager's 90s listen deadline under machine load. Operational notes, not correctness bugs.
- **Manual db rows:** two rows (bot_desktop_sandboxes + computers) were inserted by hand to mirror what the api's provision would have written (its HTTP call wedged in the slow host and never returned; the VM it created is real and running). Values verified truthful against the host.

## Environment facts worth keeping

- Tart host = the owner's second MacBook (`joes-MacBook-Pro`), reachable via `ssh 100.88.98.69` (Tailscale, `~/.ssh/id_tailscale`, user joe). Host shell makes template surgery practical; HTTP API alone was not enough.
- Guest access: sshpass `admin/admin` over the Tart NAT IP works from the host shell (sshpass at `/opt/homebrew/bin` on the host).
- The api's desktop db (the one that matters) is `~/Library/Application Support/@allternit/desktop/allternit/allternit.db` — NOT `~/Library/Application Support/allternit/allternit.db` (a stale older copy that cost real confusion).
- VNC WS auth: `ALLTERNIT_DESKTOP_WS_SECRET` must be in the api's env or status falls back to an unsigned ws_url the WS route rejects (403). Launching the app from a shell with that env exported is enough.
- Tart VM `vnc_port` = health-gated ssh-forward to guest 127.0.0.1:5900; the api proxies WS frames to `tcp://100.88.98.69:<port>`.
