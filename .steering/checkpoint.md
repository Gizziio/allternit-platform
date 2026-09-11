# Checkpoint — session/wordmarkpixel-0911

## Goal
Owner: the design wordmark leads with a cream-squircle ICON, not the pixel
A:// protocol mark that spells out like office.allternit.com — port the
office pixel mark. Also add each product wordmark to its Electron window
headers, and fix the design window header colliding with the macOS traffic
lights.

## Just did
- Worktree `allternit-session-wordmarkpixel-0911` on `session/wordmarkpixel-0911`
  from origin/main (2f4ae087b).
- `AProtocolWordmark.tsx` (platform): replaced the PNG img mark with the
  pixel A:// mark (MARK_CELLS + coral core, exact port of the
  office.allternit.com geometry); kept collapse animation + themes;
  restored role="img"/aria-label on the span.
- Wordmark tests updated (mark adds one <g>); new chrome wordmark test.
- Headers: `OfficePageChrome` (docs/sheets/slides/pdf) now carries
  A://TERNIT OFFICE at height 12; `OfficeDesktopView` (/office) header gets
  72px electron traffic-light clearance; `DesignModeView` project header
  gained the A://TERNIT DESIGN wordmark (height 12) with 72px electron
  clearance; `NewProjectScreen` launch header gets the same clearance.
- Verified: typecheck 0 err; vitest 1654 pass / 0 fail (213 files).

## Next
- Commit, push, PR, merge; attest; rebuild dmg; swap preview; cleanup.
