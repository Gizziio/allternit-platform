# Agent Work Attestation — pixel A:// mark + electron window header wordmarks

**Date:** 2026-09-11 12:45
**Session ID:** `wordmarkpixel-0911`
**Branch:** `session/wordmarkpixel-0911`
**Agent:** kimi (Kimi Code session `9fe8e2b1`)
**PR:** https://github.com/Gizziio/allternit-platform/pull/356
**Merge commit:** `b16652635`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner: the design wordmark led with the cream-squircle **icon**; it must
spell out **A://TERNIT** in pixel blocks like office.allternit.com (the
wordmark "already exists in the codebase for office"). Also: each product
wordmark belongs in its Electron window headers, and the design window
header collided with the macOS traffic lights.

- `surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx`:
  replaced the PNG `<img>` mark with the pixel A:// mark (MARK_CELLS +
  coral core), an exact port of the office.allternit.com geometry; collapse
  animation, themes, role/aria-label preserved. The `markVariant` prop
  (added on main in parallel by session/console-be-p2) is retained as a
  deprecated no-op so its caller keeps compiling — the pixel mark follows
  `theme` (currentColor under adaptive/mono), which is what that prop was
  for.
- `OfficePageChrome.tsx` (docs/sheets/slides/pdf popped-out windows): now
  carries A://TERNIT OFFICE at height 12 next to the nav buttons (+ test).
- `OfficeDesktopView.tsx` (/office launcher): took the parallel
  console-be-p2 version wholesale — it already had the same 72px
  traffic-light clearance + drag region + markVariant theming.
- `DesignModeView.tsx` project header: A://TERNIT DESIGN wordmark
  (height 12) at the left of the tab strip, 72px Electron clearance so the
  header no longer slides under the traffic lights.
- `NewProjectScreen.tsx` launch header: same 72px Electron clearance.

## How it works

The pixel mark is 15 grid columns (A + colon + two staircase slashes) at
the same 10-unit cell / 8.5-block / rx-1.5 geometry as the letters, so the
whole wordmark is one SVG and scales as one unit. Electron clearance uses
`isElectronShell()` with the same 72px convention as OfficePageChrome.

## Verification

- `pnpm typecheck` — 0 errors (post-merge with console-be-p2's markVariant).
- `pnpm test` — 1654 passed (incl. updated wordmark glyph tests 3/3 and
  the new OfficePageChrome wordmark test).

## Known gaps / remaining work

- Markdown preview window has no header chrome at all (pre-existing) — no
  wordmark surface there without designing one.
- Desktop DMG rebuild + preview swap done post-attestation.

## Files changed

- `surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx` (+ test update)
- `surfaces/ai.allternit.com/src/shell/OfficePageChrome.tsx` (+ test)
- `surfaces/ai.allternit.com/src/views/design/DesignModeView.tsx`
- `surfaces/ai.allternit.com/src/views/design/NewProjectScreen.tsx`
- `surfaces/ai.allternit.com/src/views/office/OfficeDesktopView.tsx` (conflict: took parallel session's equivalent)
