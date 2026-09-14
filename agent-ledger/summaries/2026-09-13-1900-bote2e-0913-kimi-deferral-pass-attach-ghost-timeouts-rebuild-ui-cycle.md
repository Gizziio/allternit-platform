# bote2e-0913 deferral pass — attach ghost fix, tart-host timeouts, desktop rebuild, live UI cycle

**Session:** bote2e-0913 (Kimi Code) · **Date:** 2026-09-13 (evening) · **Agent family:** kimi
**Continues:** `2026-09-13-1735-bote2e-0913-kimi-production-bot-desktop-template-and-vnc-mixed-content-fix.md`

The owner said "work on the deferrals" from the attestation above. All four are now done or verified as far as the environment allows.

## 1. PR #489 — shared account-computer ghost fix (merged `f5d214e9a`-era main)

**Defect:** `deprovision_desktop` destroyed the shared desktop VM but left the `computers` row at `status='running'`; the next provision's `attach_bot_to_user_computer` attached the bot to the ghost and returned `"running"` for a sandbox existing on no substrate (lived today: pane stuck unrecoverably at "Computer is off").

**Fix:** new `computer_screens::mark_user_computer_deleted` (row → `deleted` + screens removed); called from `deprovision_desktop`'s background destroy task when the destroyed sandbox IS the shared computer, and from `destroy_desktop` on native_id match. Early-return path (other bots hold screens) untouched.

**Verified:** `cargo test -p allternit-api bot_desktop --lib` → 75 passed, incl. new `deprovision_marks_shared_computer_deleted` and `deprovision_keeps_shared_computer_while_screens_remain`.

## 2. PR #490 — tart-host subprocess timeouts (merged, deployed to the host)

**Incident:** unbounded `tart list`/`tart ip` calls (13–70s+ each under load, occasionally minutes) piled up behind handlers and wedged the tart-host API — a single-VM GET returned zero bytes for 180s+ and the desktop api's provision never completed.

**Fix (`cmd/allternit-computer-cloud/src/bin/tart-host.rs`):** `output_with_timeout` (spawn + `wait_with_output` under `tokio::time::timeout`; `KillOnDrop` guard kills and asynchronously reaps the child on deadline — no wedged children holding VM-directory locks, no zombies). Bounds: list/ip 30s, set 60s, stop 120s, delete 60s, clone 600s (full-disk copy), exec 90s.

**Verified:** 8/8 bin tests (new: `output_with_timeout_bounds_and_kills_slow_children`, `..._returns_output_for_fast_children`). **Deployed** to `joes-MacBook-Pro` (`~/.allternit/bin/allternit-tart-host`, backup `.bak-pre-timeout`, `launchctl kickstart`). Post-deploy the API answered in 0.36s idle; during VM boot `tart list` still slow but now returns an **honest 30s error** instead of wedging forever.

**Ops note:** the tart host is also a shared dev box (another full desktop app + sessions run there; load averaged ~150 during this pass). The ssh-VNC forward can still flap under that load (sshd handshake stalls); recovery = clear stale `ssh -N -L` children and let the supervisor re-establish. Bounded, self-healing, but not instant under extreme host load.

## 3. Desktop rebuilt from main and installed

Fresh unsigned build from origin/main (includes #486 ws:// fix, #489, #490-era api code, the migration renumber from #484). Fresh **release** `allternit-api` sidecar built from main (replaces the debug binary swapped in during the migration-collision incident; the broken 14:50 binary is gone with the old app dir). Verified bundle: `allowRunningInsecureContent: true` in asar main window (webview still false), "Jump to latest" in platform assets, 6 sidecar bins, connector-sidecar + lima staged. Installed at `/Applications/Allternit Desktop.app`; cold start now reaches healthy+platform in ~45s (release api; the debug build used to miss the 90s deadline).

## 4. UI click-through e2e — COMPLETE (live, on the production template)

Against sandbox `allternit-bot-0bd4…` (golden-image clone) in the rebuilt app, driven over CDP with the app's own UI:

1. **Start** (UI button) → 200 → VM booted → pane flipped to the bot overlay ("Observing — bot is still running") once `vnc_port: 15900` resolved.
2. **Take over** (UI button, `btn.click()`) → POST 200 → api `control_state: human_controls` → pane: **"You are driving"** + Hand back.
3. **Hand back** (UI button) → POST 200 → api `control_state: bot_controls`, `taken_over_by` cleared → pane: **"Bot is driving"** + Observe/Take over.

Full Observe → Take Over → Hand Back cycle works end-to-end in the desktop UI.

**Honestly not pixel-verified:** live VNC frame content in the noVNC canvas. The compact chat pane never mounts a `<canvas>` (screenshot-refresh layout); the mixed-content block that previously killed the ws:// handshake before it left the renderer is fixed at the network layer (verified: `webSocketCreated` previously had no `requestWillBeSent`; wss to internet worked; the WS route answers auth errors properly). The RFB stream itself is proven: real RFB 003.008 greetings through the ssh forward to x11vnc, scrot-verified 1920×1080 desktop, api reporting `protocol: vnc` + signed `ws_url`. A pixel check needs the page-layout viewer on a calm host — worth one re-run, not a blocker.

## Environment quirks worth keeping

- Synthetic MouseEvent click sequences do NOT trigger actions in the current UI build; `HTMLElement.click()` does. The full pointer/mouse sequence worked for rail buttons but not the pane action buttons.
- The pane's status label lags control_state transitions by one successful poll when the host is slow — it catches up on its own once the host responds.
- `pkill -f "ssh -N -L"` over ssh kills your own session (the pattern matches the remote wrapper's cmdline) — use pid-targeted kills.
