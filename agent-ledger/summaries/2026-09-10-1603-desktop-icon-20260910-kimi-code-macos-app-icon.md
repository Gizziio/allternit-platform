# Session desktop-icon-20260910 — macOS-convention desktop app icon

**Agent:** Kimi Code (session `desktop-icon-20260910`)
**Date:** 2026-09-10
**PR:** #263 — merge commit `7ab4a7f6b0c391ecb94fc09d48aade755e497769`

## What changed
The desktop app icon was the A-grid glyph edge-to-edge on a transparent
canvas, rendering oversized and square next to standard macOS dock icons.
Regenerated `surfaces/allternit-desktop/build/` assets in macOS icon style:
- `icon.png` — 1024×1024, white squircle (corner radius 22.4% of canvas,
  macOS approximation), A-grid glyph centered at ~62% content area,
  supersampled 4× for clean edges.
- `icon.icns` — rebuilt via `iconutil` from a full 16–1024 iconset.
- `icon.ico` — regenerated with 16/24/32/48/64/128/256px sizes.
Brand colors preserved exactly: tan #D4B08C, orange #D97757 (sampled from
the previous icon). The generation script was one-off and intentionally
not committed; assets are the source of truth.

## Verification
- Visual check of rendered 1024 icon (squircle + padding correct).
- `node scripts/release-preflight.mjs` → 35/0.
- Preview DMG rebuilt from merged main after this attestation (build b1853+);
  bundle verified to contain the new icon.icns.

## Deferrals
- None.
