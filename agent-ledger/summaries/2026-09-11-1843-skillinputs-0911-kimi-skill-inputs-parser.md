# Session summary — skillinputs-0911 (skill frontmatter parser fix, closes #368)

- **Session:** `session/skillinputs-0911`
- **Agent family:** kimi-code
- **Date:** 2026-09-11 18:43
- **PR:** #372, merge commit `b4a0956bf`

## What was done

Fixed the design-mode skill registry's hand-rolled YAML frontmatter parser so
`od.inputs` (and every other nested list-of-maps, e.g. `od.parameters`,
`example_prompt_i18n`) parse into real typed structures.

**Root cause:** the old flat line loop had a special case for indent-4 `- `
items that pushed `trimmedLine.slice(2)` (e.g. the raw string `"name:
product_name"`) into an array, and a "deeper nested key" branch that wrote
continuation keys (`type:`, `default:`, …) onto that array as stray properties.
`normalizeInputs` then received an array of strings, found no `.name` on any
element, and filtered everything out — **every bundled skill parsed with
`inputs: []`**. 15 of 19 bundled skills declare inputs per the documented
`skills/README.md` contract, so skill authors' input declarations silently did
nothing and the design launch flow's `Inputs:` prompt block
(DesignModeView.tsx:521) was always empty.

**Fix:** replaced the line loop with a small recursive indentation-based parser
covering the repo's YAML subset — nested mappings (arbitrary depth), sequences
of scalars, sequences of mappings (`- key: value` + deeper continuation keys),
inline arrays, quoted scalars (colons allowed inside quotes), boolean/null/
numeric scalars, and literal (`|`) / folded (`>`) block scalars. The closing
fence must now be a standalone `---` line, so values containing `---` parse
correctly (previously `indexOf('---', 3)` truncated mid-value). No new
dependency; exported API unchanged.

## Files changed

- `surfaces/ai.allternit.com/src/lib/design/skill-registry.ts` — parser rewrite
  (+ docs on the supported subset)
- `surfaces/ai.allternit.com/src/lib/design/skill-registry.test.ts` — new: 8 tests
- `surfaces/ai.allternit.com/src/lib/design/bundled-skills.ts` — export `RAW_SKILLS`
- `surfaces/ai.allternit.com/src/lib/design/bundled-skills.test.ts` — regression
  lock: every skill whose frontmatter declares `od.inputs` must parse >0
  well-formed inputs; all inputs must have a name and a valid type

## Verification

- `pnpm typecheck` — 0 errors
- `pnpm vitest run src/lib/design` — **27/27** (was 18; +8 new parser tests, +1
  bundled-skills regression assertion)
- `pnpm vitest run src/shell` — 21/21
- Live spot-check via tsx over `skills/*/SKILL.md`: 15/15 input-declaring skills
  parse fully-typed inputs (labels, placeholders, defaults, required flags);
  enum `values:` lists and numeric `min`/`max` bounds typed correctly.

## Incidents

- Session start was blocked by macOS TCC revoking Desktop folder access for the
  terminal hosting the agent (Desktop dir timestamps reset 12:51 today; another
  session's ledger entry records the same machine-wide block earlier today).
  Eoj restored the grant; access verified before any repo work. No sidestep
  attempted — the stale non-git `~/allternit-workspace` copy was considered and
  explicitly refused.

## Honest deferrals

- **No UI writes `skillValues` today** — `NewProjectScreen` ignores its
  `onChangeSkillValues` prop, so users still can't *fill* inputs in the launch
  screen; with this fix the declared defaults now at least flow into the run
  prompt. Filed as follow-up work (input-collection form in the launch screen).
- **No skill declares `od.parameters`**, so `SkillParameterPanel` stays dormant;
  it now has a working data path when a skill does declare parameters.
- Parser intentionally supports the documented subset only; exotic YAML
  (anchors, flow mappings, multi-document) remains out of contract.
