# Steering checkpoint

## Goal
Session D: mapping doc §6 P1 — one-box zero-friction start. Add the model picker
chip (kimi.com/design "K3 · High" equivalent) to the studio landing composer.
Session: session/onebox-0911, worktree allternit-session-onebox-0911, from
origin/main @ 8e4d3ad03 (includes #381). Plan at
.steering/plans/plan-onebox-0911.md.

## Just did
- Worktree created; pnpm install done (1m19s). Investigation verified:
  selectModel → persistModelSelection (`allternit:model-selection`) →
  readComposerRuntimeModelId() → createDesignSession default (mode-session-store.ts:604).
  DesignModeView landing renders NewProjectScreen without ChatModelsProvider/
  ModelSelectionProvider; in-project composer wraps them at ~line 952.

## Next
- Commit + push session/onebox-0911; PR → merge (--merge) → ledger attestation →
  preflight → desktop rebuild → bundle grep → DMG swap → cleanup.

## Open questions
- None.
