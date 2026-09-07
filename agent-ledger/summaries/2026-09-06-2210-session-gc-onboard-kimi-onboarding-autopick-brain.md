# Session summary: gizzi-code onboarding auto-picks default brain

- **Session ID / Branch:** `session/gc-onboard` (worktree `allternit-session-gc-onboard`)
- **Agent:** kimi
- **Date:** 2026-09-06 22:10 local
- **Commit:** `198c83e46` on `main` (branch `session/gc-onboard` fast-forwarded; branch + worktree cleaned up after merge)

## What was done

Owner follow-up to the 2.0.6 hotfix session: onboarding should **always auto-select the default brain** instead of showing an interactive picker. Rationale given: the pick is a policy decision (paid plan → Allternit Cloud default model; otherwise the first installed CLI brain), not a user choice to make mid-wizard; `/model` remains the way to change it later.

## How it works

- `cmd/gizzi-code/src/cli/commands/onboarding.ts` gained an exported `pickBrain(catalog, setBrain)` helper:
  - Paid Plus/Super/Ultra plan → `${cloud.id}/${cloudDefaultModel}`.
  - Else first catalog entry with `source === "subprocess"` and a non-empty model list → `${id}/${models[0]}`.
  - Else no `setBrain` call; the summary line becomes "none yet — install a CLI or subscribe at platform.allternit.com/plans".
- The interactive wizard's brain section now calls `pickBrain` and logs `Brain: … — change anytime with /model.` — the old `prompts.select` block and its cancel handling are removed.
- `runOnboardingDefaults` (`--defaults`, non-interactive path) delegates to the same helper, producing identical output strings so existing tests pass unchanged.
- `cmd/gizzi-code/test/commands/onboarding.test.ts`: new `describe("pickBrain")` block, 3 tests (first-CLI pick without prompting; paid plan prefers cloud; empty catalog → no pick + informative summary). Full file: 14 pass / 0 fail.
- `cmd/gizzi-code/CHANGELOG.md`: `### Changed` entry under `## Unreleased` (no version bump — rides the next release).

## Pre-existing main breakages fixed en route (verified present on origin/main `5372943e2` before fixing)

1. `cmd/gizzi-code/src/cli/ui/ink-app/commands/auto/index.ts` called the Bun `feature('TRANSCRIPT_CLASSIFIER')` bundle macro inside an arrow-function return and a getter — Bun rejects this ("can only be used directly in an if statement or ternary condition") and it killed the entire test preload graph. Now resolved once at module scope into a boolean flag.
2. `packages/@allternit/native-sessions/src/catalog.ts:643` re-exported `HARNESS_BY_ID` without importing it (TS2552), which made `bun run typecheck` fail repo-wide. Now `export { HARNESS_BY_ID } from "./harness.js"` (redundant with `index.ts`'s re-export but harmless; kept to preserve the export surface).

## Verification

- `bun test --timeout 30000 --preload ./test/preload.ts test/commands/onboarding.test.ts` → 14 pass, 0 fail.
- `bun run typecheck` in `cmd/gizzi-code` → exit 0.

## Outstanding work

- None for this change. It ships with the next gizzi-code tag (2.0.6 remains the latest release; no new tag per owner flow).
- Known pre-existing gap, deliberately untouched: the same illegal `feature()` macro pattern exists in `src/keybindings/defaultBindings.ts`, `src/constants/betas.ts`, `src/constants/prompts.ts` — they are not in the onboarding test graph and did not block typecheck; fix if a future run complains.
