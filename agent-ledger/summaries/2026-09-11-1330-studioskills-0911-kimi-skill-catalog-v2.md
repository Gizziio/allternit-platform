# 2026-09-11 — session/studioskills-0911 — A:// Studio skill catalog v2

- **Session:** `session/studioskills-0911` · PR #367 · merge `96bfcda0a` · agent: kimi-code
- **Driver:** Eoj — the kimi.com/design-style use-case gallery needs the skill/plugin
  catalog that powers each creation type; build it, then move forward.

## What changed

10 new SKILL.md creation skills under `surfaces/ai.allternit.com/skills/`, on the house
contract (frontmatter + Workflow + amber law + P0 lint gate), wired into
`bundled-skills.ts`: poster, infographic, social-creative, product-launch, edu-visual,
scientific-figure, generative-art, pitch-deck, email-newsletter, personal-site.
`gallery-categories.ts` maps all 19 bundled skills → gallery categories (feeds the P0
use-case gallery, mapping doc §6). `skills/README.md` documents the catalog, the
frontmatter contract, the quality bar, and how to add a skill. Vendored example skills
patched minimally to meet the contract; `bundled-skills.test.ts` enforces uniqueness,
contract fields, and exact gallery coverage.

## Verification

typecheck 0 errors; vitest src/lib/design 18/18 (incl. new); src/shell 21/21 (main's
current count); zero forbidden hexes in new files.

## Incidents / findings

- **Issue #368 filed (real pre-existing bug):** the minimal YAML parser drops
  `od.inputs` — every skill parses with `inputs: []`, so the SkillParameterPanel has
  never rendered a parameter. Fix is the follow-up.
- pnpm-lock churn from the verification install reverted (cosmetic peer metadata).
