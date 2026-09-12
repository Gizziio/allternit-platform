# Steering checkpoint

## Goal
Issue #374: give the Design launch screen a skill-inputs collection form.
Parser fixed last session (PR #372); this session is the UI half so `od.inputs`
reach the run prompt end-to-end. Session: session/skillinputui-0911, worktree
allternit-session-skillinputui-0911. P0 use-case gallery follows as session B.

## Just did
- Scoped: NewProjectScreen ignores onChangeSkillValues and renders no fields;
  plumbing downstream is complete. testing-library + jsdom available for a
  component test. Plan at .steering/plans/plan-skillinputui-0911.md.

## Next
- Implement ad-skill-inputs form (per-type controls, required gating), styles,
  component test off the saas-landing fixture, verify, PR → merge → ledger →
  rebuild → cleanup.

## Open questions
- None.
