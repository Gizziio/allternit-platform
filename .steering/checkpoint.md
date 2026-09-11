# Checkpoint — session/wordmarkfix-0911

## Goal
Fix the wordmark follow-ups: (1) "DESIGN" misspelled — the pixel glyph map had
no G, and layout() silently dropped unknown glyphs AND their column, so
DESIGN rendered as DESIN in the design launch header + shell rail footer;
(2) the office panes didn't spell out the full wordmark — taskpane header
showed bare A://TERNIT (no OFFICE) and the sidepanel showed mark-only at a
different size than the design rail wordmark.

## Just did
- Worktree `allternit-session-wordmarkfix-0911` on `session/wordmarkfix-0911`
  from origin/main (b79d9e22c).
- Added the G pixel glyph to all three copies (platform AProtocolWordmark,
  office.allternit.com copy, office-addin AProtocolMark); changed layout() in
  all three to advance the column for unknown glyphs (visible gap instead of
  a squished misspelling).
- Taskpane header: `suffix="OFFICE"` at height 12 (== design rail wordmark).
- Sidepanel OfficeBrandIcon: full wordmark `suffix="OFFICE"` height 12
  (was markOnly 15); hero mark untouched (decorative empty state).
- Added `AProtocolWordmark.test.tsx` — per-letter glyph coverage for
  OFFICE/DESIGN + unknown-letter grid-advance regression.

## Verification
- New wordmark tests 3/3; platform typecheck 0 err; platform vitest exit 0;
  office addin vitest 158/158; addin `pnpm build` green; office site
  `pnpm build` green.

## Next
- Commit, push, PR, merge; attest; rebuild desktop dmg; swap preview; cleanup.
