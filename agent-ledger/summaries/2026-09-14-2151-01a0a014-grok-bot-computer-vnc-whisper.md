# Session attestation — 01a0a014 — bot-computer live VNC + whisper-cli lipo

- **Session:** grok `01a0a014-1884-7c73-8dde-08ef1e85ecc2`
- **PR:** #534, merge `655236401` into main
- **Date:** 2026-09-14 21:51

## What was done

Owner forbade deferring the dedicated computer-window SPA/VNC work and
whisper-cli lipo after #532.

1. **VNC claim across Electron heaps** — BroadcastChannel no longer always
   drops the local owner. A remote pane cannot steal the window; a remote
   window does take the pane. `vncEndpointKey` strips rotating desktop tokens
   so reconnects are not identity changes.
2. **Viewport** — stop the claim→emit→vncEpoch reconnect storm; keep the last
   screenshot on 429; poll snapshots slowly while live VNC is connecting
   (was 400ms in the window, which 429'd the 30 rpm bucket).
3. **whisper-cli universal** — `build-whisper.sh arm64` and `x86_64`, then
   `lipo` in `release-desktop.yml`. release-preflight requires both artifacts.

## Verification evidence

- `bot-computer-vnc.test.ts` 9/9 locally.
- `node scripts/release-preflight.mjs` 52/0.
- Desktop CI: unit tests pass (2m30s), typecheck+build pass (2m33s).
- gitleaks, typography, SW cache, Cloudflare Pages: pass.
- PR #534 merged to main as `655236401` (2026-09-15T02:51:18Z).

## Honest remaining

- No Apple notarization secrets. A `desktop-v*` cut is still unsigned until
  `APPLE_*` exist. That is a cert/secrets issue, not this code.
- Local unsigned DMG rebuild from this merge SHA is AGENTS.md step 8 and was
  not cut in this attestation commit.
EOF