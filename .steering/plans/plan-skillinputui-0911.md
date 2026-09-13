# Plan — session/skillinputui-0911 (issue #374)

## Goal
Give the Design launch screen a real input-collection form so skill `od.inputs`
actually reach the run prompt. Parser side was fixed in PR #372 (#368); the
plumbing (`skillValues`/`onChangeSkillValues` props, DesignModeView wiring,
prompt block) exists, but `NewProjectScreen` ignores `onChangeSkillValues` and
renders no fields — users cannot fill values today.

## Approach
In `NewProjectScreen.tsx`: when `selectedSkill.inputs.length > 0`, render an
`ad-skill-inputs` section inside the composer card, between attachments and the
toolbar. Per-input control by `SkillInput.type`:

- `string` → single-line input
- `text` → 2-row textarea
- `integer` → number input honoring `min`/`max`
- `boolean` → checkbox, initialized from `default`
- `enum` → select over `values`, initialized from `default` (or empty option
  when optional)

Conventions: amber-law launch tokens already in new-project-screen.css
(`--launch-accent` etc.), `ad-` class prefixes. Labels from `input.label ??
input.name`, required flagged with `*`. Values merge up via
`onChangeSkillValues({ ...skillValues, [name]: value })`; downstream defaults
still apply for untouched fields (DesignModeView uses `?? i.default`).

Required gating: submit stays disabled until every required non-boolean input
has a non-empty value (default counts as filled). Boolean always has a value.

## Todos
- [ ] Form section in NewProjectScreen.tsx + wire onChangeSkillValues
- [ ] ad-skill-inputs styles in new-project-screen.css (launch tokens)
- [ ] Component test: renders fields from the real saas-landing fixture, values
      flow to onChange, required inputs gate submit
- [ ] typecheck 0 + vitest green (new + existing design/shell suites)
- [ ] PR → merge → ledger → preflight → desktop rebuild → cleanup

## Out of scope
P0 use-case gallery (session B, immediately after this one).
