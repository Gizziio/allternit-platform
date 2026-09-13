# Session summary — onebox-0911 (§6 P1 model picker on studio landing)

- **Session:** `session/onebox-0911`
- **Agent family:** kimi-code
- **Date:** 2026-09-11 20:16
- **PR:** #382, merge commit `9b01fc5bf`

## What was done

Mapping doc §6 P1 — one-box zero-friction start. The studio landing
(`NewProjectScreen`) had hero + prompt box + Format picker + aspect pill row +
skill attach; the one adornment missing vs the kimi.com/design reference box
(K3 · High chip) was a **model picker**. Added it.

- `DesignModeView.tsx`: the landing's `NewProjectScreen` (the
  `if (!activeProject)` branch) is now wrapped in
  `ChatModelsProvider` + `ModelSelectionProvider defaultSelection={defaultSelection}`
  — the same providers and the same default the in-project composer already
  uses (~line 952). JSX-only change; the file remains `// @ts-nocheck`
  (pre-existing).
- `NewProjectScreen.tsx`: new `ModelPickerControl` in the composer toolbar —
  an `ad-toolbar-button`-style pill (Brain icon, `Model` caption + current
  model name, fallback label **Model**) that opens a popover listing
  `availableModels` with loading (`Loading models…`) and empty (`No models
  connected yet — pick a brain in Settings.`) states, check-marking the
  current selection and calling `selectModel` on pick. If `useModelSelection`
  throws outside a provider (it throws by design), the control renders
  nothing, so tests/Storybook work without the wrapper.
- `new-project-screen.css`: `ad-model-picker` popover styles following the
  existing `ad-` conventions and amber-law launch tokens (same pattern as the
  Format picker).
- Tests: 4 new cases in `NewProjectScreen.test.tsx` using a lightweight
  `vi.mock` of `@/providers/model-selection-provider` (not a heavy provider
  mock): renders-nothing-without-provider, fallback label, pick calls
  `selectModel` with the right `ModelSelection` and closes the popover, empty
  state.

## How it works

No extra plumbing — one storage key end to end, verified by reading both
implementations:

1. `selectModel` → `persistModelSelection` writes localStorage key
   `allternit:model-selection` (`src/lib/default-brain.ts:5,251-258`).
2. `createDesignSession` defaults the session model to
   `options.modelId ?? readComposerRuntimeModelId()`
   (`src/lib/agents/mode-session-store.ts:604`).
3. `readComposerRuntimeModelId()` (`src/lib/agents/runtime-model.ts:12,26-42`)
   rehydrates `providerId/modelId` from that same key.

So a model picked on the landing persists as the composer runtime model and
the next design session inherits it automatically — the same mechanism the
in-project composer already relies on.

## Verification

- `pnpm typecheck` — 0 errors
- `pnpm vitest run src/views/design/NewProjectScreen.test.tsx src/lib/design src/shell`
  — 12 files, **66/66** (baseline 62 = 55 + 7; +4 new model-picker tests;
  11/11 in NewProjectScreen.test.tsx, 7 pre-existing kept green)

## Incidents
- None.

## Honest deferrals
- Desktop rebuild for this PR is tracked as the next ledger entry (rebuild
  happens after attestation per the ritual, from merged main).
- The popover lists models but has no search field (the Format picker doesn't
  either); fine at current model counts.
