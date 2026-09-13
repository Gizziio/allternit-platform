# Agent Work Attestation — wordmark G glyph + full OFFICE wordmark

**Date:** 2026-09-11 12:05
**Session ID:** `wordmarkfix-0911`
**Branch:** `session/wordmarkfix-0911`
**Agent:** kimi (Kimi Code session `9fe8e2b1`)
**PR:** https://github.com/Gizziio/allternit-platform/pull/348
**Merge commit:** `fe21de426`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner follow-up on the DESIGN wordmark work: the full wordmark wasn't
spelled out on either surface, DESIGN was misspelled in the design launch
header + shell rail footer, and the office pane's mark wasn't the full
wordmark at the design rail's size.

Root cause: the pixel glyph map in all three wordmark copies (platform
`AProtocolWordmark`, office.allternit.com copy, office-addin `AProtocolMark`)
had no `G`, and `layout()` dropped unknown glyphs without advancing the
column — `suffix="DESIGN"` rendered as squished "DESIN". OFFICE was
unaffected (all letters present).

- Added the `G` pixel glyph (C-with-middle-bar, house 5×5 style) to all
  three copies.
- Hardened `layout()` in all three: unknown glyphs leave a visible gap
  instead of collapsing the word.
- Office taskpane header: `suffix="OFFICE" height={12}` (was bare
  A://TERNIT). Office sidepanel chat header: full wordmark at height 12
  (was markOnly 15) — 12 matches the A://TERNIT DESIGN shell-rail wordmark.
  Empty-state hero (56px markOnly) intentionally unchanged.
- Added `AProtocolWordmark.test.tsx`: per-letter glyph coverage
  (OFFICE/DESIGN) + grid-advance regression for unknown glyphs.

## How it works

5×5 cell maps at pitch 6; G = top bar, left stem, middle bar to the right
edge, right stem rows 2–3, bottom bar (17 cells). Tests render the component
and count letter `<g>` groups so a dropped glyph fails loudly.

## Verification

- New wordmark tests 3/3.
- ai.allternit.com typecheck 0 errors; full vitest exit 0.
- Office add-in vitest 158/158; `pnpm build` green.
- office.allternit.com `pnpm build` green.

## Known gaps / remaining work

- Desktop DMG rebuild from merged main + preview swap done as the
  post-attestation step (platform + office add-in are desktop-bundled).

## Files changed

- `surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx` (+ test)
- `surfaces/office.allternit.com/src/components/AProtocolWordmark.tsx`
- `surfaces/allternit-extensions/allternit-office-addin/src/taskpane/components/AProtocolMark.tsx`
- `surfaces/allternit-extensions/allternit-office-addin/src/taskpane/App.tsx`
- `surfaces/allternit-extensions/allternit-office-addin/src/taskpane/OfficeSidepanelApp.tsx`
