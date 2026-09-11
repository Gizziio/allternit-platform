# fabric-machine-sessions-first — machine select lands on sessions, not VNC

- **Date:** 2026-09-11
- **Agent:** grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/309 · merge `a6e52d1d9`

## What landed

Selecting a paired machine on Fabric Transport opens the node **session list**, not live desktop/VNC.

- Fabric Session panel: default Chat; do not auto-select the first session; reset to chat when the runtime changes.
- Phone: session list is the landing view. Desktop/VNC is a tab, with a Sessions back control.
- Remote-control PWA: default tab is Sessions (was Desktop). Tab order Sessions, then Desktop.
- Live desktop still works as an opt-in tab.

SW cache: fabric-session v25, remote-control v3.

## Verification

GitHub Actions: check-sw-cache-bump, gitleaks, typography, desktop vitest, desktop typecheck — pass. Cloudflare Pages fail ignored (same as recent PRs).

## Honest leftover

Fabric Transport home (and chat) still look like a desktop dashboard squeezed onto a phone. Redesign/polish is the next session — not in this PR. Desktop DMG not rebuilt for this nav-only change.
