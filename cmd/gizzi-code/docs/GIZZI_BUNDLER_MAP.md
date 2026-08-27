# Gizzi Production Binary Bundler — Circular Dependency Map

## Problem

`bun run build` in `/Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code` bundles the app into `.build/gizzi-code-bundle.js`, then compiles a native binary. The binary compile step fails because Bun emits synchronous `__esm(() => { ... await ... })` module wrappers for circular ESM dependency groups. A synchronous wrapper containing `await` is a syntax error.

## Failure mode

The bundler assigns each module an `init_<name>` wrapper. When a module is part of a strongly-connected component whose initialization is async, every wrapper in that SCC becomes async. The binary step then fails with:

```
error: "await" can only be used inside an "async" function
at .build/gizzi-code-bundle.js:<line>:<col>
```

## Cycles already broken in this session

1. **`tokens.ts` ↔ `messages.ts`**
   - Edge broken: `tokens.ts` imported `SYNTHETIC_MESSAGES` / `SYNTHETIC_MODEL` from `messages.ts`.
   - Fix: extracted those constants into leaf modules:
     - `src/shared/utils/syntheticMessages.ts`
     - `src/cli/ui/ink-app/utils/syntheticMessages.ts`
   - `messages.ts` re-exports them; `tokens.ts` now imports from the leaf.

2. **`ink-app/services/tokenEstimation.ts` ↔ `messages.ts`**
   - Edge broken: `tokenEstimation.ts` imported `normalizeAttachmentForAPI` from `messages.ts`, and `getAPIMetadata`/`getExtraBodyParams` from `./api/claude.js` (which imports `messages.ts`).
   - Fix:
     - Removed the attachment branch in `roughTokenCountEstimationForMessage` (returns 0 for attachments to avoid importing `normalizeAttachmentForAPI`).
     - Dynamically imported `getAPIMetadata`/`getExtraBodyParams` inside the async `countTokensViaHaikuFallback` function.

3. **`shared/utils/permissions/filesystem.ts` ↔ `sessionStorage.ts` ↔ `messages.ts` → tools → `filesystem.ts`**
   - Edge broken: `filesystem.ts` imported `getProjectDir` from `sessionStorage.ts`.
   - Fix: changed `filesystem.ts` (shared and ink-app) to import `getProjectDir` from the leaf `projectDir.ts`.

## Current failure (as of the hand-off)

Bundle line ~16608, `init_errors9` (which corresponds to `src/cli/ui/ink-app/services/api/errors.ts`) awaits `init_messages6`:

```
var init_errors9=__esm(async()=>{...
  await __promiseAll([init_messages6(),init_claudeAiLimits()])
});
```

Cycle:

```
cli/ui/ink-app/services/api/errors.ts
  -> imports createAssistantAPIErrorMessage + NO_RESPONSE_REQUESTED from ../../utils/messages.ts
  -> messages.ts imports FileReadTool, FileEditTool, BashTool, etc.
  -> those tools import services/api/errors.ts (or transitively re-enter it)
```

The same pattern exists in the runtime side:

```
src/runtime/services/api/errors.ts
  -> imports createAssistantAPIErrorMessage + NO_RESPONSE_REQUESTED from ../../../shared/utils/messages.ts
  -> shared/utils/messages.ts imports runtime tools
  -> runtime tools re-enter errors.ts
```

## Proposed fix

Extract `createAssistantAPIErrorMessage` and its shared helper `baseCreateAssistantMessage` into tiny leaf modules that do NOT import `messages.ts`:

- `src/shared/utils/apiErrorMessage.ts`
- `src/cli/ui/ink-app/utils/apiErrorMessage.ts`

These leaf modules only need:
- `randomUUID` from `crypto`
- `NO_CONTENT_MESSAGE` from `constants/messages.js`
- `SYNTHETIC_MODEL` from `./syntheticMessages.js`
- types (`AssistantMessage`, `ContentBlock`, `SDKAssistantMessageError`, `BetaContentBlock`, `BetaUsage`)

Then:
- Update `src/shared/utils/messages.ts` and `src/cli/ui/ink-app/utils/messages.ts` to import `baseCreateAssistantMessage` and `createAssistantAPIErrorMessage` from the new leaf modules (and remove their local definitions).
- Update `src/runtime/services/api/errors.ts` to import `createAssistantAPIErrorMessage` from `../../../shared/utils/apiErrorMessage.js` and `NO_RESPONSE_REQUESTED` from `../../../shared/utils/syntheticMessages.js`.
- Update `src/cli/ui/ink-app/services/api/errors.ts` to import `createAssistantAPIErrorMessage` from `../../utils/apiErrorMessage.js` and `NO_RESPONSE_REQUESTED` from `../../utils/syntheticMessages.js`.

## Build verification loop

After each code change, run:

```bash
cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code
bun run build 2>&1 | tail -80
```

If it fails with another `await` error, identify the new async `init_*` wrapper from the bundle, trace which source module it is, find the static import that closes the cycle, and break that edge the same way (extract leaf exports or replace static imports with dynamic imports inside async functions).

When `bun run build` succeeds, run:

```bash
bun run typecheck
```

Fix any type errors. Do not change build/typecheck commands or unrelated code.

## Constraints

- No git operations (commit, push, branch, etc.).
- No dev servers.
- Keep changes minimal and scoped to breaking circular dependencies.
- Preserve existing runtime behavior; only move code, do not rewrite logic.
- Match existing import style (`.js` extensions, `@/` aliases where already used).
