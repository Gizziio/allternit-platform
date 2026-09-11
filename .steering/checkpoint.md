# Checkpoint — session/designwordmark-0911

## Goal
Emulate the office wordmark for the Design surface: render A://TERNIT DESIGN
via the existing `suffix` prop on the shared AProtocolWordmark component, in
the two owner-approved spots (design launch header + shell rail footer
Design button).

## Just did
- Created worktree `allternit-session-designwordmark-0911` on branch
  `session/designwordmark-0911` from origin/main (2aed1d3f6).
- Scoped with owner: rail target = ShellRail footer Design button; header
  target = NewProjectScreen launch header. No new rail in /design window.
- Wrote plan file `.steering/plan-designwordmark-0911.md`.
- Edited both spots to use `<AProtocolWordmark suffix="DESIGN" />`
  (height 13 launch header keeping BETA; height 12 rail footer button).
- Verified: `pnpm typecheck` — zero errors in touched files (6 pre-existing
  fabric-session errors on main, untouched); `pnpm vitest run src/shell`
  4 files / 20 tests passed.

## Next
- Commit, push, PR, merge; sync main; ledger attestation; cleanup.

## Open questions
- None.
