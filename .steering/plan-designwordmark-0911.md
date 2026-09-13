# Plan — session/designwordmark-0911

Emulate the A://TERNIT OFFICE wordmark for the Design surface: use the
existing `suffix` prop on the shared `AProtocolWordmark` component.

Owner-approved scope (2026-09-11):

1. **Design launch header** (`surfaces/ai.allternit.com/src/views/design/NewProjectScreen.tsx`):
   replace `<AProtocolWordmark height={13}/>` + plain `<span>DESIGN</span>`
   with a single `<AProtocolWordmark suffix="DESIGN" height={13}/>`; keep the
   BETA badge.
2. **Shell rail footer Design button** (`surfaces/ai.allternit.com/src/shell/ShellRail.tsx`):
   replace the Palette icon + "Design" text with the DESIGN-suffix wordmark
   (`theme="adaptive"`, small height so it fits the rail width).

## Todos

- [x] Create worktree `allternit-session-designwordmark-0911` from origin/main
- [ ] Edit NewProjectScreen header
- [ ] Edit ShellRail footer button
- [ ] `pnpm typecheck` + `pnpm vitest run src/shell` in surfaces/ai.allternit.com
- [ ] Commit, push, PR, merge; sync main
- [ ] Ledger attestation; worktree/branch cleanup
