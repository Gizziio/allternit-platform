# Plan — session/skillinputs-0911 (issue #368)

## Goal
Fix `skill-registry.ts` `parseYamlFrontmatter` so `od.inputs` (and any other nested
list-of-maps, e.g. `od.parameters`, `example_prompt_i18n`) parse into real typed
structures instead of being flattened into strings and dropped by `normalizeInputs`.

## Root cause (verified)
The line-loop parser has a special case for indent-4 `- ` items that pushes
`trimmedLine.slice(2)` as a raw string into an array, and a "deeper nested key"
branch that then writes continuation keys (`type:`, `default:`, …) onto that array
object as stray properties. `normalizeInputs` receives `["name: product_name", …]`,
casts each string to a record, finds no `.name`, filters everything out → every
skill parses with `inputs: []`. 15 of 19 bundled skills declare inputs; the design
launch flow's `Inputs:` prompt block (DesignModeView.tsx:521) is therefore always
empty.

## Approach
Replace the ad-hoc line loop with a small recursive indentation-based parser for
the repo's YAML subset (documented): nested mappings, sequences of scalars,
sequences of mappings (`- key: value` + deeper continuation keys), inline arrays,
quoted scalars (incl. colons inside quotes), `true/false/null`, numeric scalars,
and `|` / `>` block scalars. Keep the exported API and the block-scalar semantics
verbatim. No new dependency.

## Todos
- [ ] Rewrite parser in `src/lib/design/skill-registry.ts`
- [ ] New `src/lib/design/skill-registry.test.ts`: saas-landing fixture end-to-end
      (typed inputs, preview map, design_system sections, craft list, block scalar
      description, triggers) + synthetic fixture for enum/integer min-max/i18n map
- [ ] Export RAW_SKILLS from `bundled-skills.ts`; assert in
      `bundled-skills.test.ts` that every skill whose frontmatter declares
      `od.inputs` parses at least one well-formed input
- [ ] `pnpm typecheck` 0 errors; `pnpm vitest run src/lib/design` green
- [ ] PR → merge → ledger attestation → release-preflight → desktop rebuild →
      worktree/branch cleanup

## Out of scope (deferred, to file as issue)
- No UI currently writes `skillValues` (NewProjectScreen ignores
  `onChangeSkillValues`) — input collection form is a follow-up issue.
- No skill declares `od.parameters`, so SkillParameterPanel stays dormant; it now
  at least has a working data path when a skill does declare parameters.
