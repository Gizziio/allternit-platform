# Checkpoint — session/wordmarksize-0911

## Goal
Owner screenshot: rail footer shows A://TERNIT OFFICE (height 10, added by a
parallel session) next to A://TERNIT DESIGN (height 12) — different sizes;
and DESIGN still "reads desisn".

## Root causes
- The G glyph added in #348 is cell-for-cell identical to S (both: top bar,
  left stem rows 1–2, full middle bar, right stem row 3, bottom bar) — so
  "DESIGN" rendered "DESISN". Fixed in all three copies: G = S + the left
  stem continuing below the middle bar ([0,3]) — the one-block difference
  that makes a G read as G.
- Heights diverged across parallel sessions: rail OFFICE 10 / collapsed 16,
  design launch header 13, /office launcher header 18.

## Just did
- Worktree `allternit-session-wordmarksize-0911` on `session/wordmarksize-0911`
  from origin/main (6b3548c7a).
- Fixed G in platform + office-site + add-in copies.
- Unified every product-suffixed wordmark (DESIGN/OFFICE) to height 12:
  ShellRail OFFICE 10→12 + collapsed 16→12, NewProjectScreen 13→12,
  OfficeDesktopView 18→12 (dropped the now-no-op markVariant prop at the
  call site).
- Added a G≠S regression test (G must be exactly one block heavier than S).

## Verification
- typecheck 0 err; wordmark+shell tests 25/25; full suite 1653 pass.

## Next
- Commit, push, PR, merge; attest; rebuild dmg; swap; reopen the app.
