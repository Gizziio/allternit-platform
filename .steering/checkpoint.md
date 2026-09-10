# Checkpoint — session/desktop-icon-20260910

## Goal
Replace the desktop app icon with a macOS-convention icon (squircle + padding).

## Just did
- Regenerated build/icon.png (1024, white squircle radius 22.4%, A-grid glyph
  at ~62% content area, original brand colors preserved: tan #D4B08C, orange
  #D97757), build/icon.icns (full iconset via iconutil), build/icon.ico
  (16-256 multi-size). Source script kept out of repo (one-off generation).
- release-preflight 35/0.

## Next
- Commit + PR + merge; sync main; ledger attestation; rebuild desktop DMG; cleanup.

## Open questions
- None.
