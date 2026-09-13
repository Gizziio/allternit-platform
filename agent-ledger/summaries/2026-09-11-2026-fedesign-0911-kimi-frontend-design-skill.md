# Agent Work Attestation — 2026-09-11 20:26

**Date:** 2026-09-11 20:26
**Session ID:** fedesign-0911
**Branch:** session/fedesign-0911
**Agent:** kimi
**Commit:** PR #390, merge `dce56e070cc05d6c442a6e92f2022688fdb48ed3`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Session G of the multi-session build program — locked mapping doc
(`/Users/joe/allternit-design-competitive-mapping.md`) §2 row 5 / §4: vendor
Anthropic's verified `frontend-design` skill as the **base of the studio steering
layer**, adapted to Allternit brand law. Deliberately NOT a bundled creation skill —
the skill catalog is for creation workflows; this is steering.

- **`surfaces/ai.allternit.com/skills/references/frontend-design.md`** (new) — vendored,
  adapted reference doc. Upstream: `skills/frontend-design/SKILL.md` from
  https://github.com/anthropics/skills (fetched 2026-09-11 via raw.githubusercontent),
  **Apache-2.0** (upstream `skills/frontend-design/LICENSE.txt`); attribution header
  kept. Adaptation deltas marked ADAPTED in the doc.
- **`surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.ts`** — bounded
  `## Design taste (steering — binding)` block added and folded into
  `composeStudioSystemPrompt` (after A_CRAFT_RULES); file header doc-comment updated.
- **`surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.test.ts`** (new) —
  8 tests asserting the composed prompt carries the adapted rules.

## How it works

Adaptation rules applied per the locked mapping doc:

- **Kept (spirit):** plan tokens/typography before code (4–6 named palette values +
  type roles + one layout principle bound to `:root` before layout); ban the default
  AI-slop look (template-chrome tells, gradient spam, invented metrics); contrast
  ≥ 4.5:1 (large text ≥ 3:1); inline SVG with `currentColor`, never emoji icons; one
  decisive gradient / one bold move max; copy as design content in plain Register 1 voice.
- **Adapted (brand law):** deny-list restated against `html-linter.ts` P0s — legacy
  coral family (#D97757 / #E27C59, reserved for platform UI) and all
  purple/indigo/violet families forbidden as hex/Tailwind/gradient; amber family
  (#B08D6E / #C4A684 / #9A7658) stated as brand law, not an AI tell.
- **Refused literally (mapping §4):** upstream's blanket Inter ban — intent ported as
  "no unconsidered default typography"; Inter remains the local fallback alias for
  "Allternit Sans" (Newsreader = serif voice), per A_CRAFT_RULES.
- New block is concise (one intro line + 8 bullets), references the vendored file by
  path, and sits alongside (does not duplicate) the existing A_CRAFT_RULES and
  anti-slop sections.

## Verification

- `pnpm typecheck` (surfaces/ai.allternit.com) — 0 errors.
- `pnpm vitest run src/lib/design src/shell` — **63/63 passed, 12 files** (was 55
  before the session; +8 from the new prompt test file). Re-run after rebase onto
  post-#385 main — still 63/63.
- `node scripts/release-preflight.mjs` (repo root) — **35 passed, 0 failed** (before
  code merge).
- Desktop: rebuilt after merge; bundle grep for "Spend your boldness in one place"
  hit in the mac-arm64 app assets; new DMGs preserved to the shared checkout release
  dir (see ledger entry / DMG handling).
- Incidents: PR #390 initially hit merge conflicts (concurrent artifactsapi-0911
  session had rewritten `.steering/checkpoint.md` on main); rebased onto origin/main,
  resolved checkpoint by keeping both sessions' sections (theirs first), re-verified
  everything green, force-pushed, merged clean.

## Known gaps / remaining work

- None. The skill is steering-only by design; adding it to the bundled creation
  catalog would contradict the locked mapping doc.

## Files changed

- `surfaces/ai.allternit.com/skills/references/frontend-design.md` — new vendored, adapted reference
- `surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.ts` — DESIGN_TASTE_BLOCK + compose integration
- `surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.test.ts` — new, 8 tests
- `.steering/plans/plan-fedesign-0911.md`, `.steering/checkpoint.md` — session steering docs
