# Session desktop-icon-brand-20260910 — official Allternit brand app icon

**Agent:** Kimi Code (session `desktop-icon-brand-20260910`)
**Date:** 2026-09-10
**PR:** #264 — merge commit `a9b0155a16040d4f07602da37afc7e1984fcf980`

## What changed
Supersedes PR #263 (programmatically recreated icon — wrong approach, flagged
by owner: "we have Allternit assets icons, don't make any up"). Desktop icon
now uses the official brand asset
`Allternit Assets/Brand/A Protocol/app-icon/a-protocol-app-icon.png`
(dark square-grid mark with orange accent — same mark family as the website
favicons). Only adaptation: macOS squircle mask (22.4% corner radius);
artwork unmodified. `icon.png` (1024), `icon.icns` (full iconset),
`icon.ico` (16–256) regenerated in `surfaces/allternit-desktop/build/`.

## Verification
- Visual check of rendered icon (official art, squircle corners).
- `node scripts/release-preflight.mjs` → 35/0.
- Preview DMG rebuilt from merged main after attestation; bundle icon.icns
  checksum-verified against build/icon.icns.

## Deferrals
- None.
