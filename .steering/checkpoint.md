# Steering checkpoint

Goal: gizzi-code follow-up — onboarding should always auto-select the default brain (no interactive brain picker in the wizard). Policy: paid plan → Allternit Cloud default model; else first installed CLI brain; nothing installed → tell the user how to get one. `/model` remains the way to change it.

Just did: Extracted a shared `pickBrain(catalog, setBrain)` helper in `src/cli/commands/onboarding.ts`; the wizard's brain section now calls it (no `prompts.select`, informs "Brain: … — change anytime with /model.") and `runOnboardingDefaults` delegates to it (identical output strings, existing tests untouched). Added 3 `pickBrain` tests (first-CLI pick, paid-plan prefers cloud, empty catalog → no setBrain). CHANGELOG entry under `## Unreleased`. Also fixed pre-existing main breakage in `src/cli/ui/ink-app/commands/auto/index.ts`: `feature('TRANSCRIPT_CLASSIFIER')` was called inside an arrow return/getter (Bun: "can only be used directly in an if statement or ternary"), which killed the whole test preload graph — now resolved once at module scope. Onboarding tests 14/14 green.

Next: `bun run typecheck` clean → commit, push session branch, fast-forward main, ledger attestation, cleanup worktree + branch. Change rides the next release (no new tag; 2.0.6 already shipped).

Open questions: None. (Known pre-existing gap, out of scope: the same illegal `feature()` macro pattern exists in `defaultBindings.ts`, `betas.ts`, `prompts.ts` — only fix if a future typecheck/test run complains.)
