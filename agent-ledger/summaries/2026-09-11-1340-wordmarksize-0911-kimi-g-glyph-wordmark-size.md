# Agent Work Attestation — wordmark G fix + size unification

**Date:** 2026-09-11 13:40
**Session ID:** `wordmarksize-0911`
**Branch:** `session/wordmarksize-0911`
**Agent:** kimi (Kimi Code session `9fe8e2b1`)
**PR:** https://github.com/Gizziio/allternit-platform/pull/364
**Merge commit:** `e6e9e6f45`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner screenshot: rail footer showed A://TERNIT OFFICE (height 10, from a
parallel session) beside A://TERNIT DESIGN (height 12) — mismatched sizes —
and DESIGN still read "desisn".

- **G glyph was a clone of S.** The G added in #348 was cell-for-cell
  identical to S (top bar, left stem rows 1–2, full middle bar, right stem
  row 3, bottom bar), so DESIGN rendered DESISN. Fixed in all three copies
  (platform, office.allternit.com, office add-in): G = S + `[0,3]` — the
  left stem continues below the middle bar, the one-block difference that
  makes G read as G.
- **Size unification**: every product-suffixed wordmark (DESIGN/OFFICE) is
  now height 12 — ShellRail OFFICE 10→12 and its collapsed mark 16→12,
  NewProjectScreen 13→12, OfficeDesktopView 18→12 (dropped the no-op
  markVariant at that call site). OfficePageChrome / DesignModeView /
  add-in panes were already 12.
- New regression test: G must be exactly one block heavier than S.

## Verification

- `pnpm typecheck` 0 errors; wordmark+shell tests 25/25; full suite 1653
  passed / 0 failed.

## Files changed

- `surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx` (+ test)
- `surfaces/ai.allternit.com/src/shell/ShellRail.tsx`
- `surfaces/ai.allternit.com/src/views/design/NewProjectScreen.tsx`
- `surfaces/ai.allternit.com/src/views/office/OfficeDesktopView.tsx`
- `surfaces/office.allternit.com/src/components/AProtocolWordmark.tsx`
- `surfaces/allternit-extensions/allternit-office-addin/src/taskpane/components/AProtocolMark.tsx`

## Known gaps

- Desktop DMG rebuild + app relaunch done post-attestation (owner is
  actively viewing the app).
