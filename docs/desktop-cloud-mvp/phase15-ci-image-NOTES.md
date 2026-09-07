# Phase 15 — CI image pipeline for Ubuntu desktop

## Goal
Replace the hand-built `local:allternit-desktop` image on the Incus host with a reproducible, version-controlled pipeline that bakes the desktop stack, browser, Tailscale client, and `allternit-mux` binary into a published Incus image.

## What changed
- Added `cmd/allternit-computer-cloud/guest/build-image.sh`.
  - Builds `allternit-mux` (or accepts `MUX_BIN` for prebuilt binary).
  - Launches a throw-away Ubuntu 24.04 container.
  - Installs XFCE, Xvfb, x11vnc, scrot, xdotool, Chrome, Tailscale.
  - Places the `allternit-mux` binary and systemd services.
  - Publishes the result as an Incus image alias (default `allternit-desktop`).
- Added `cmd/allternit-computer-cloud/guest/validate-image.sh`.
  - Launches a test container from the new image.
  - Verifies binaries and enabled systemd services.
- Added `.github/workflows/desktop-image.yml`.
  - GitHub Actions runner that installs Incus and Rust, builds `allternit-mux`, runs `build-image.sh`, and uploads the image as an artifact.

## Test results
```
cargo test -p allternit-computer-cloud
  18 passed; 0 failed
cargo test -p allternit-api bot_desktop
  25 passed; 0 failed
```

## End-to-end proof
Screen recording: `phase15-ci-image-proof.webm`.
Demonstrates:
1. The `build-image.sh` script running on the VPS.
2. Progress through package installation, Chrome/Tailscale install, service setup.
3. Image published as `allternit-desktop-ci`.
4. `validate-image.sh` launching a container from the new image and verifying:
   - `/opt/allternit-mux/allternit-mux` exists and is executable.
   - `google-chrome`, `tailscale`, `x11vnc`, `xfce4-session` are on PATH.
   - `allternit-desktop.service` and `allternit-mux.service` are enabled.
5. Provisioning a bot desktop from the freshly built image succeeds.
6. Screenshot endpoint returns a 1280x720 PNG from the running desktop.

## Known limitations / next steps
- The image is currently built on the target Incus host. A registry-based flow (push/pull between hosts) will come with Phase 21 (multi-host fleet).
- The build does not yet sign images or record SBOMs; add supply-chain metadata before production.
- Phase 16 adds persistent disk snapshots and S3 backups for the running desktops.
