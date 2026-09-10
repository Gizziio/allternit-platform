# Session desktop-icon-macos-a-only-cream — macOS-quality A-only cream app icon

**Date:** 2026-09-10
**Owner decision:** ship candidate 01 (A-only cream), upgraded to Apple continuous-corner quality.

## What changed
Replaces the wide `A://` protocol mark (too large / wrong for favicon-dock use) with the official A-block crop only:
- Cream plate `#FDF8F3`
- Black blocks `#141413` + coral core `#D97757`
- Continuous-corner (superellipse) mask, 4× supersampled
- Glyph ~56% content scale

Updated:
- `surfaces/allternit-desktop/build/icon.png` (1024)
- `surfaces/allternit-desktop/build/icon.icns` (16–1024)
- `surfaces/allternit-desktop/build/icon.ico` (16–256)

Supersedes PR #264 wide protocol app icon for desktop surfaces.
