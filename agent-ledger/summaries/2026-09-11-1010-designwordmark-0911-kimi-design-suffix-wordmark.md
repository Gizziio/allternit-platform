# Agent Work Attestation — Design surface suffix wordmark

**Date:** 2026-09-11 10:10
**Session ID:** `designwordmark-0911`
**Branch:** `session/designwordmark-0911`
**Agent:** kimi (Kimi Code session `9fe8e2b1`)
**PR:** https://github.com/Gizziio/allternit-platform/pull/329
**Merge commit:** `bdc524bc5`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Emulated the office.allternit.com wordmark treatment for the Design surface
using the existing `suffix` prop on the shared `AProtocolWordmark` component
(`surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx`). Owner
scoped the two targets before implementation:

- **Design launch header** (`src/views/design/NewProjectScreen.tsx`): the
  header previously rendered `AProtocolWordmark` + a plain-text `<span>DESIGN</span>`
  (mono font, not on the wordmark grid). Now renders a single
  `<AProtocolWordmark theme="adaptive" height={13} suffix="DESIGN" />` so
  DESIGN is pixel letters on the same grid as TERNIT — the same treatment as
  office's `suffix="OFFICE"`. The BETA badge stays.
- **Shell rail footer Design button** (`src/shell/ShellRail.tsx`): the
  Palette icon + "Design" text row now renders
  `<AProtocolWordmark theme="adaptive" height={12} suffix="DESIGN" />`.
  `Palette` import kept (still used by the rail More dropdown).

## How it works

`AProtocolWordmark` lays out pixel letterforms (5x5 cell maps, pitch 6) after
the cream-squircle A:// mark; `suffix="DESIGN"` appends D-E-S-I-G-N (all
glyphs already in the component's map) with a 3-column word space. Height 12
keeps the full A://TERNIT DESIGN mark ≈192px wide, fitting the default 248px
rail (min 180px clips gracefully via the component's overflow:hidden).

## Verification

- `pnpm typecheck` (surfaces/ai.allternit.com) — zero errors in touched
  files; 6 pre-existing errors in `src/fabric-session/*` on clean main
  (FabricSessionPanel comparison + BotsChatPage Bot type), untouched by
  this diff.
- `pnpm vitest run src/shell` — 4 files / 20 tests passed.

## Known gaps / remaining work

- Desktop binary rebuild from merged main is required by the session ritual
  (the platform surface is desktop-bundled) — recorded as the follow-up for
  this session; not started in-session.
- The in-project DesignModeView tab-strip header and the main ShellHeader
  were deliberately left unchanged (owner scope: launch header + rail footer
  only).

## Files changed

- `surfaces/ai.allternit.com/src/views/design/NewProjectScreen.tsx` — suffix wordmark in launch header
- `surfaces/ai.allternit.com/src/shell/ShellRail.tsx` — suffix wordmark in rail footer Design button
