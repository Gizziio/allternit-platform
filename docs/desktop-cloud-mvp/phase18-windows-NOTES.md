# Phase 18 — Windows Incus image and guest agent

## Goal
Extend the desktop control plane so users can provision Windows desktops on
Incus by passing `os=windows`, with PowerShell-based screenshot/input/shell/file
operations and a repeatable Windows image build pipeline.

## What changed
- Added `os` column to `bot_desktop_sandboxes` (migration `V94__desktop_os.sql`)
  so the platform remembers whether a desktop is Linux or Windows.
- Updated `POST /api/v1/bots/:bot_id/desktop/provision` to accept an `os`
  query parameter (`linux` or `windows`).
  - `os=windows` selects the `allternit-desktop-windows` Incus image alias.
  - `os=linux` keeps the existing `allternit-desktop` alias.
- Added `cmd/allternit-api/src/bot_desktop_windows.rs` (under 300 LOC):
  - PowerShell command builders for screenshot, mouse move/click, keyboard
    typing, shell execution, and file upload/download.
  - Unit tests for screenshot and keyboard command generation.
- Updated `bot_desktop_routes.rs` and `bot_desktop_input.rs` to branch on the
  sandbox `os` field, sending Windows guests PowerShell commands while keeping
  the existing Linux/xdotool path.
- Added `cmd/allternit-computer-cloud/guest/build-windows-image.sh`.
  - Wraps the [antifob/incus-windows](https://github.com/antifob/incus-windows)
    builder to produce an `allternit-desktop-windows` image on a KVM-capable
    host.
- Added `cmd/allternit-computer-cloud/guest/setup-windows-agent.ps1` to finish
  the Windows guest (execution policy, Chrome, Tailscale, verify Incus agent).

## Test results
```
cargo test -p allternit-api bot_desktop
  30 passed; 0 failed

cargo test -p allternit-computer-cloud
  18 passed; 0 failed
```

## End-to-end proof
Screen recording: `phase18-windows-proof.webm`.
Demonstrates:
1. `POST .../desktop/provision?os=windows` returns the Windows image alias
   path (idempotent for a bot that already has a sandbox; new bots will launch
   from `allternit-desktop-windows`).
2. The Windows command builder unit tests pass and produce PowerShell commands.
3. `build-windows-image.sh` detects the current VPS lacks `/dev/kvm` and exits
   with a clear error, documenting the hardware requirement.

## Blocker
The current Incus host (VPS) is itself a virtual machine with no nested KVM
(`/dev/kvm` is missing), so Incus cannot start a Windows VM there:

```
ERROR: /dev/kvm is missing. Windows VMs require a KVM-capable host.
```

To complete this phase end-to-end we need a bare-metal or KVM-nested x86_64
host in the fleet. The platform code is ready; only the hardware environment is
missing.

## Next steps once a KVM host is available
1. Run `build-windows-image.sh 2022` on the KVM host.
2. Copy or replicate the resulting `allternit-desktop-windows` image to the
   target Incus host.
3. Provision a bot desktop with `?os=windows` and exercise screenshot/mouse/
   keyboard/shell/file endpoints through the API.
