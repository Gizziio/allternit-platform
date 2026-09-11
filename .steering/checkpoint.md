# Steering checkpoint

## Goal
Fix issue #368: `skill-registry.ts` parser drops `od.inputs` (and any nested
list-of-maps) — every bundled skill parses with `inputs: []`, so the design
launch flow's Inputs block is always empty. Session: session/skillinputs-0911,
worktree allternit-session-skillinputs-0911.

## Just did
- Rewrote parseYamlFrontmatter as a recursive indentation parser (nested maps,
  sequences of scalars AND of maps, inline arrays, quoted/numeric/bool scalars,
  |/> block scalars, standalone-line fence). Replaced 145-line flat loop.
- New skill-registry.test.ts: 8 tests (saas-landing verbatim fixture end-to-end,
  synthetic enum/integer/i18n/folded fixture, fence edge case, no-fence case).
- Exported RAW_SKILLS; bundled-skills.test.ts now asserts every skill declaring
  od.inputs parses >0 well-formed inputs (issue #368 regression lock).
- Verified: typecheck 0 errors; vitest src/lib/design 27/27 (was 18);
  vitest src/shell 21/21; live spot-check: 15/15 input-declaring skills parse
  fully-typed inputs (labels, placeholders, defaults, required).

## Next
- Commit, push, PR, merge, ledger attestation, release-preflight, desktop
  rebuild, worktree cleanup per AGENTS.md ritual.

## Open questions
- None.
