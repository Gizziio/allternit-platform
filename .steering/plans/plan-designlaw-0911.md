# Plan — session/designlaw-0911: design-law reconciliation (amber-only)

Date: 2026-09-11. Locked decisions being executed (Eoj, 2026-09-11):
1. **Spec wins**: `DESIGN.md` adopts the ivory/graphite/amber system from
   `~/allternit-redesign-spec.md`; the purple system is dead.
2. **Amber-only accents**: the four per-mode palettes (chat terracotta #D4956A,
   cowork violet #A78BFA, code mint #79C47C, browser steel #69A8C8) are removed;
   amber #B08D6E family is the sole accent. Mode distinction via
   typography/iconography is follow-up UX work (NOT this session).
Governing doc: `/Users/joe/allternit-design-gap-analysis.md` §4-§5.

## Tasks

- [ ] D1 Amend `DESIGN.md` color system (§2, ~lines 145-283): replace gray
      surfaces (#fafafa/#0a0a0b) with ivory (#FAF8F4 family) / graphite
      (#0F0F0F family); replace purple accents (#7c3aed/#a78bfa) with amber
      scale (#B08D6E / #C4A684 hover / #9A7658 muted); document coral #D97757
      as deprecated (amber-only law); bump version v2.0 → v2.1 with date and
      rationale. Keep semantic tiers, motion, elevation, type rules intact.
- [ ] D2 Remove mode accents at the source: `ui/design/allternit.tokens.ts`
      (byte-identical to `surfaces/ai.allternit.com/src/design/allternit.tokens.ts`
      — update both, keep identical) and `theme.css` (same triplication:
      `ui/design/theme.css` + `surfaces/ai.allternit.com/src/design/theme.css`
      + office's `src/theme.css` where it defines per-mode/chat accents).
      All four mode accents map to the amber family; per-mode token names are
      removed, not aliased (no permanent compatibility shim — grep must show
      zero remaining consumers).
- [ ] D3 Update consumers: every usage of `--accent-chat/-cowork/-code/-browser`
      or the four hexes in `surfaces/ai.allternit.com/src` (glass components,
      tokens.ts, ShellRail, FloatingWidgets, stories, Fade/Slide animation,
      StatusBar, anything else grep finds) → `--accent-primary` (amber). Mode
      switcher/rail indicators become amber/neutral — do NOT invent new mode
      colors. Exclude third-party data files (design-systems-library.ts) and
      anything under dist/.
- [ ] D4 platform.allternit.com: remove indigo `--accent-secondary: #6366f1`
      (grep consumers; map to amber or delete); replace hardcoded
      Inter/JetBrains Mono font stacks with the Allternit alias pattern
      (`--font-allternit-sans/mono` if the chain is importable there, else
      same alias names with identical fallbacks, documented).
- [ ] D5 allternit-office-addin taskpane styles.css: replace hardcoded font
      stacks with the Allternit alias stacks (same fallbacks).

## Verification (all must pass)

- [ ] `grep -ri "D4956A\|A78BFA\|79C47C\|69A8C8" surfaces/ai.allternit.com/src
      surfaces/office.allternit.com/src ui/design` → zero hits (excluding
      design-systems-library.ts).
- [ ] `grep -n "7c3aed\|a78bfa" DESIGN.md surfaces/*/src platform console src`
      → zero hits outside third-party data.
- [ ] `pnpm typecheck` in `surfaces/ai.allternit.com` — zero NEW errors.
- [ ] `pnpm vitest run src/shell` — 20/20 (or current main count).
- [ ] The two token copies and theme.css copies remain byte-identical after
      the change (diff -q).

## Out of scope

Mode-distinction UX redesign (typography/iconography per-mode), shared
allternit-ui package creation, token build pipeline, docs/phone-remote
outlier re-skins, desktop rebuild (parent runs it post-merge).
