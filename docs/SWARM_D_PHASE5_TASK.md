# Swarm D — Phase 5 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-d`  
**Branch:** `ao/p5-d`  
**Base:** `parity/swarm-sprint`

## Goal
Formalize SDK middleware and refusal handling.

## Deliverables

1. **SDK middleware**
   - Add a formal middleware hook system to `sdk/allternit-sdk/src/ai-runtime/harness/index.ts`.
   - Support `beforeRequest`, `afterResponse`, and `onError` hooks.
   - Migrate `fetchWithRetry` to be the default `onError` middleware.
   - Keep backward compatibility with existing `retry` config.
   - Add tests.

2. **Refusal-fallback middleware**
   - Implement a built-in middleware that detects provider refusal/content-filter responses and falls back to the next configured provider/model.
   - Expose `AllternitHarness` config option `fallbackModels?: Array<{ provider: string; model: string }>`.
   - Add a test.

3. **Update docs**
   - Update `docs/public/sdk/typescript-quickstart.md` with middleware example.

## Validation
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass
- `pnpm docs:lint` — pass

## Commit
Commit on `ao/p5-d` with message: `feat(p5): Swarm D SDK middleware hooks and refusal fallback`.
