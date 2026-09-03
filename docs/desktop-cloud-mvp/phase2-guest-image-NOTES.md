# Phase 2 Checkpoint — Reproducible Linux Guest Desktop Image

## Feature
Cloud-init driven Ubuntu 24.04 desktop guest for Incus, located in `cmd/allternit-computer-cloud/guest/cloud-init.yaml`.

## Constraint compliance
- **LOC:** ~75 lines of YAML/cloud-config (well under 1,500 limit).
- **No Orgo dependency:** pure cloud-init + systemd.
- **Proof of work:** launched a fresh container from the profile, verified cloud-init completion, verified XFCE/Xvfb/x11vnc processes, and captured a screenshot.

## What it does
- Installs XFCE4, Xvfb, x11vnc, scrot, and supporting fonts/DBus packages.
- Writes `/opt/allternit-desktop/run.sh` to start Xvfb, `xfce4-session`, and `x11vnc`.
- Installs a systemd service `allternit-desktop.service` enabled on first boot.
- Shares the desktop over VNC on TCP/5900 with password `allternit`.
- Resolution is fixed at 1280x720 so screenshots and UI are deterministic.

## Verification

Launched a fresh container on the Tailscale-connected VPS (`mail`):

```bash
incus launch images:ubuntu/24.04/cloud desktop-cloudinit-test \
  --profile default --profile allternit-desktop
incus exec desktop-cloudinit-test -- cloud-init status --wait
```

Result:

```
status: done
```

Service status:

```
Active: active (running)
Main PID: 17410 (run.sh)
```

Processes running:

```
Xvfb :0 -screen 0 1280x720x24 ...
xfce4-session
x11vnc -display :0 -rfbport 5900 -forever -shared -passwd allternit
```

Screenshot command:

```bash
incus exec desktop-cloudinit-test -- env DISPLAY=:0 scrot /tmp/desktop-cloudinit.png
incus file pull desktop-cloudinit-test/tmp/desktop-cloudinit.png /tmp/desktop-cloudinit.png
```

Local proof artifact:

`docs/desktop-cloud-mvp/phase2-cloudinit-desktop-proof.png`  
Dimensions: 1280x720  
Content: XFCE desktop with panel and default wallpaper.

## Files changed
- `cmd/allternit-computer-cloud/guest/cloud-init.yaml` — reproducible desktop guest config.
- `docs/desktop-cloud-mvp/phase2-cloudinit-desktop-proof.png` — proof screenshot.
- `docs/desktop-cloud-mvp/phase2-guest-image-NOTES.md` — this checkpoint note.

## Notes / caveats
- The VPS has no nested KVM, so this validation uses an Incus **container**. The same cloud-init works for Incus VMs on a host that supports them.
- `chromium-browser` is intentionally omitted because Ubuntu 24.04 ships it as a Snap transition; browser automation will be layered in Phase 4 with a non-Snap install path.

## Next step
Phase 3: wire the `allternit-computer-cloud` substrate and routes into the existing `cmd/allternit-api` service so platform bots can request `/api/v1/bots/:id/desktop`.
