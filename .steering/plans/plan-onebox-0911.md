# Session onebox-0911 — studio landing model picker (mapping doc §6 P1)

## Goal
Add the one missing adornment on the studio landing (`NewProjectScreen`): a model
chip in the composer toolbar, matching the kimi.com/design reference box
(K3 · High). Picking a model must reach the new design session with no extra
plumbing, via the already-persisted composer runtime model.

## Investigation (verified)
- `src/lib/agents/mode-session-store.ts:604` — `let modelId = options.modelId ?? readComposerRuntimeModelId()`.
- `src/lib/agents/runtime-model.ts:12,26-42` — `readComposerRuntimeModelId()` reads
  localStorage key `allternit:model-selection` and returns `providerId/modelId`.
- `src/lib/default-brain.ts:5,251-258` — `persistModelSelection` writes the SAME key
  `allternit:model-selection`. So `selectModel` → persist → session default. No plumbing.
- `src/providers/model-selection-provider.tsx` — `useModelSelection()` throws outside
  a provider; exposes `selection, availableModels, isLoading, selectModel`.
- `DesignModeView.tsx` — `@ts-nocheck`; wraps in-project composer in
  `ChatModelsProvider > ModelSelectionProvider defaultSelection={defaultSelection}`
  (~line 952) but renders the landing `NewProjectScreen` unwrapped (~line 676).
- `useDefaultModelSelection()` (hook) already called at line 281 — reuse it.

## Steps
- [x] Wrap landing `<NewProjectScreen/>` in `ChatModelsProvider` + `ModelSelectionProvider`
      (same defaultSelection) in `DesignModeView.tsx`.
- [x] Add model pill to toolbar in `NewProjectScreen.tsx`: `ad-toolbar-button` control,
      label = selection?.modelName ?? "Model", popover lists `availableModels`
      (loading + empty states), calls `selectModel`. If `useModelSelection` throws
      (no provider), render nothing.
- [x] CSS in `new-project-screen.css` (`ad-model-picker`, launch tokens).
- [x] Tests in `NewProjectScreen.test.tsx`: fallback label without provider;
      picking calls selectModel with a lightweight context stub (vi.mock of the
      provider module, not a heavy provider mock).
- [x] `pnpm typecheck` — 0 errors.
- [x] `pnpm vitest run src/views/design/NewProjectScreen.test.tsx src/lib/design src/shell` —
      all green: 12 files, 66 tests (was 62; +4 new).
- [ ] Commit, push, PR, merge (--merge).
- [ ] Ledger attestation + LEDGER.md entry, PR, merge.
- [ ] release-preflight → desktop rebuild → bundle grep → DMG preserve/retire → cleanup.

## Open questions
- None.
