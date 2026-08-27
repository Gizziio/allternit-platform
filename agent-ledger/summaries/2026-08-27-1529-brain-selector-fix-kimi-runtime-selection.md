# Agent Work Attestation — Brain Selector Modal Runtime Selection Fix

**Date:** 2026-08-27 15:29  
**Session ID:** brain-selector-fix  
**Branch:** session/brain-selector-fix  
**Agent:** kimi  
**Commit:** 140ed37a920da62b5727e91685d7c0d78d164426  
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Fixed the brain/model selector modal so clicking a runtime/provider row selects the runtime instead of only toggling expansion.

- Updated `surfaces/ai.allternit.com/src/components/model-picker.tsx`:
  - `ProviderRow` now accepts an `onSelect` callback and uses it as the row click handler in single-select mode.
  - The `CaretDown` chevron has its own click handler for expand/collapse so users can still browse models.
  - `renderProviderSection` passes `onSelect` for providers with models; it selects the currently selected model if it belongs to that provider, otherwise the first model.
  - Added a "No models discovered for this runtime." message when an expanded provider has zero models.
  - Auto-expands the provider containing the currently selected model when the modal opens.

## How it works

The modal now treats the provider/runtime row as a first-class selection target. In single-select mode a click on the row immediately selects the runtime's model and closes the modal. The chevron remains a separate toggle affordance for browsing. The auto-expand behavior ensures the active runtime's model list is visible when the modal opens.

## Verification

- `pnpm typecheck:fast` in `@allternit/ai` reports no new errors in `model-picker.tsx` (the monorepo typecheck has unrelated pre-existing errors in office packages).
- Changes were committed on `session/brain-selector-fix` and merged into local `main` via fast-forward.

## Known gaps / remaining work

- Multi-select mode keeps expand/collapse-only row behavior; selection is handled by the checkbox.
- The fix assumes at least one model is discovered for the runtime; runtimes with zero models show a message but cannot be selected until models are available.
