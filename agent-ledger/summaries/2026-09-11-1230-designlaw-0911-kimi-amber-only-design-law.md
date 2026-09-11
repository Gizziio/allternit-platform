# 2026-09-11 — session/designlaw-0911 — Amber-only design law (DESIGN.md v2.1)

- **Session:** `session/designlaw-0911` · PR #350 · merge `e8d533141c` · agent: kimi-code
- **Locked decisions executed (Eoj 2026-09-11):** redesign spec wins over DESIGN.md's
  gray+purple; the four per-mode accent palettes removed — amber is the only accent.

## What changed (227 files, +908/−982)

- **DESIGN.md v2.1**: color system rewritten — ivory family (#FAF8F4/#F5F3EE/#EBE7DF/#DDD8CD)
  and graphite (#0F0F0F/#1A1A1A/#262626); text #1F1B16/#5C4F42/#8F7A66 + ivory dark inverses;
  accent amber #B08D6E/#C4A684/#9A7658; explicit law note (amber-only, coral deprecated,
  mode distinction no longer by color); changelog entry. Type/spacing/elevation/motion/
  accessibility untouched.
- **Token sources**: per-mode accent objects deleted from `design/allternit.tokens.ts`
  (MODE_COLORS keeps only `design`); `--accent-chat/-cowork/-code/-browser` removed from
  theme.css light+dark (dark chat was coral #D97757); office theme.css per-mode accents →
  accent-primary. Structural note: `ui/` is a SYMLINK into the ai surface — the
  "triplicated token chain" from the 2026-09-11 gap analysis is one real copy.
- **Consumers** (~215 files): all per-mode accent references → `--accent-primary`;
  semantic uses of mint/steel mapped to status tokens; AgentMode props kept compiling,
  marked @deprecated (mode no longer selects color).
- **Kept, flagged follow-up**: `--accent-bot` (teal, ~20 consumers) and design-mode pink —
  the locked decision named the four palettes only; extending amber-only to bot/design
  needs a separate call.
- **Also**: platform console indigo `--accent-secondary` (#6366f1) removed; Allternit font
  aliases (--font-allternit-sans/mono) defined on platform + office add-in with locked
  fallbacks (the font-alias enforcement gap); html-linter deny-list extended.

## Verification

- grep: zero hits for #D4956A/#A78BFA/#79C47C/#69A8C8 in ai/office/ui src; zero purple in
  DESIGN.md + platform src.
- Token/theme copies byte-identical. `pnpm typecheck` 0 errors (was 11 pre-existing).
- `vitest run src/shell` 20/20 + all touched test files green; re-verified AFTER merging
  latest main (ShellRail auto-merge) — still 20/20, typecheck 0.

## Deferrals

Bot-teal/design-pink amber-only extension; mode-distinction typography/iconography UX;
desktop rebuild runs post-merge (parent); A:// Artifacts API (Phase 2).
