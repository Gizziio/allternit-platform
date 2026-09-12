# Session summary — skillinputui-0911 (skill inputs collection form, closes #374)

- **Session:** `session/skillinputui-0911`
- **Agent family:** kimi-code
- **Date:** 2026-09-11 19:01
- **PR:** #376, merge commit `21fbdc012`

## What was done

Built the missing UI half of the skill-inputs path so `od.inputs` reach the
design run prompt end-to-end. The parser was fixed earlier today (PR #372,
closes #368) and the downstream plumbing existed (`skillValues` /
`onChangeSkillValues` props from DesignModeView, Inputs block in the opener
prompt, system-prompt values block) — but `NewProjectScreen` ignored
`onChangeSkillValues` and rendered no fields, so `config.skillValues` was
always `{}` and users could never fill inputs.

**Change** (`surfaces/ai.allternit.com/src/views/design/NewProjectScreen.tsx`):
when the selected skill declares inputs, the composer card now renders an
`ad-skill-inputs` section between attachments and the toolbar with one control
per input — `string` → input, `text` → textarea, `integer` → number input
honoring min/max, `boolean` → checkbox initialized from the declared default,
`enum` → select over `values` (default-aware, empty option when optional).
Labels come from `input.label ?? name`; required fields carry a `*` marker and
gate submit (`submit()` early-returns and the submit button disables) until
every required non-boolean input has a non-empty value — declared defaults
count as filled, booleans always have a value. Styles added to
`new-project-screen.css` using the existing `ad-` launch conventions and the
amber-law launch tokens (`--launch-accent` etc.).

## Verification

- `pnpm typecheck` — 0 errors
- `pnpm vitest run src/lib/design` — 27/27 · `src/shell` — 21/21
- New `NewProjectScreen.test.tsx` — 3/3 (testing-library + jsdom): fields
  render from the real saas-landing fixture; submit is gated while required
  inputs are empty and unblocks when filled; filled values (including a
  toggled boolean default) arrive at `onStart.skillValues`.

## Incidents
- None.

## Honest deferrals
- Skill values are still per-launch-session state only (not persisted on the
  project record); fine for the launch-screen flow.
- P0 use-case gallery (kimi.com/design port, mapping doc §6) follows as the
  next session in the same day.
