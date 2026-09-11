# Checkpoint — session/dmp1-0911

## Goal
Execute the LOCKED Design Mode P0 + P1 plan (done, PR #332) and rebuild the
desktop binary from merged main (ritual step 8), landing REAL long-term build
fixes (Eoj: no sidesteps) rather than environment hacks.

## Just did
- PR #332 (P0/P1) + PR #334 (ledger) + PR #337 (office-engine Document cast,
  release-path fix) all merged.
- Desktop rebuild saga: 9 attempts surfaced (1) phantom deps in ai surface
  (issue #336), (2) office-engine DOM cast (fixed #337), (3) urllib optional
  proxy-agent, (4) @types/ws walk-up, (5) accidental DOM lib via
  @types/opentype.js, (6) electron-builder npm collector choking on
  pnpm-managed nm.
- Verified b2065 DMG contains all three change markers (allternit-brand,
  honest penpot string, import-url client) — content proven.
- Per Eoj: sidestep rejected. Real fix in progress on session branch:
  desktop package.json gains `packageManager: pnpm@10.28.0` (deterministic
  pnpm collector for electron-builder) + `@types/ws`; ai.allternit.com
  package.json gains the phantom deps (@blocksuite/icons ^2.2.17,
  immer ^10.2.0, mermaid ^11.16.1, yjs ^13.6.30); preload tsconfig declares
  lib DOM explicitly (replaces the accidental opentype.js side effect).
- Removed all worktree nm symlinks; fresh `pnpm@10.28.0 install` running
  (task bash-n5fwjb6j) — the honest verification.

## Next
- After install: full `npm run dist` in the worktree with NO env hacks and NO
  manual symlinks. Must reach DMG.
- Grep bundle markers again; commit package.json/tsconfig/lockfile changes;
  push; PR; merge; ledger note; cleanup worktree + branch.
- Shared-checkout nm additive symlinks (icons/univerjs/immer/yjs/mermaid/ws/
  chrome/filesystem/offscreencanvas/opentype.js/proxy-agent) left in place
  deliberately: gitignored, reconciled by the next pnpm install, and removing
  them mid-flight could break the concurrent session in the shared checkout.

## Open questions
- None.
