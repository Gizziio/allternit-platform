# Allternit Tart host (macOS desktop substrate)

This directory contains the macOS side of the Desktop Cloud: a small HTTP wrapper
around the Tart CLI plus scripts to build and verify an Ubuntu desktop image.

## Files

- `tart-host.rs` / `deploy.sh` — HTTP wrapper that exposes VM lifecycle,
  exec, file, and screenshot endpoints over Tailscale.
- `build-image.sh` — Builds the `allternit-desktop-tart` image with XFCE,
  Xvfb, x11vnc, scrot, and xdotool.
- `verify-e2e.sh` — Provisions a VM from the image and verifies screenshot,
  mouse, keyboard, and file operations.
- `com.allternit.tart-host.plist` — launchd agent template.

## Deploy the Tart host wrapper

Run on the Apple-Silicon Mac that will host desktops:

```bash
./infrastructure/tart-host/deploy.sh
```

The script detects the Mac's Tailscale IPv4, builds the wrapper, installs it as
a launchd agent, and verifies health.

To deploy to a specific interface:

```bash
TART_HOST_IP=100.127.97.20 ./infrastructure/tart-host/deploy.sh
```

After deploy, add the printed `TART_HOST_URLS` and `TART_HOST_TOKEN` to the
VPS `/etc/allternit-api/api.env` and restart `allternit-api`.

## Build the desktop image

```bash
./infrastructure/tart-host/build-image.sh
```

The default image name is `allternit-desktop-tart`. Override with:

```bash
OUTPUT_IMAGE=my-tart-desktop ./infrastructure/tart-host/build-image.sh
```

## Verify the image end-to-end

```bash
./infrastructure/tart-host/verify-e2e.sh
```

On success it prints `all Tart desktop e2e checks passed` and leaves a
screenshot at `/tmp/allternit-e2e-<timestamp>-screen.png`.
