---
topic: gizzi_bundler
phase: 1
status: ready
---

# Phase 1 — Break the remaining `errors.ts` ↔ `messages.ts` cycle

## Goal

Make `bun run build` succeed for `/Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code`, then run `bun run typecheck` and fix type errors.

## Exact scope

1. **Finish the leaf module extraction** (the files exist but may need cleanup):
   - `src/shared/utils/apiErrorMessage.ts`
   - `src/cli/ui/ink-app/utils/apiErrorMessage.ts`
   - These must contain `baseCreateAssistantMessage` and `createAssistantAPIErrorMessage` and must NOT import `messages.ts`.
   - They may import:
     - `randomUUID` from `crypto`
     - `NO_CONTENT_MESSAGE` from `constants/messages.js`
     - `SYNTHETIC_MODEL` from `./syntheticMessages.js`
     - types only (`AssistantMessage`, `ContentBlock`, `SDKAssistantMessageError`, `BetaContentBlock`, `BetaUsage`)

2. **Update `src/shared/utils/messages.ts`**:
   - Import `baseCreateAssistantMessage` and `createAssistantAPIErrorMessage` from `./apiErrorMessage.js`.
   - Remove the local `baseCreateAssistantMessage` definition.
   - Remove the local `createAssistantAPIErrorMessage` definition.
   - Keep re-exporting `createAssistantAPIErrorMessage` from `./apiErrorMessage.js` so existing callers that import from `messages.js` keep working.

3. **Update `src/cli/ui/ink-app/utils/messages.ts`**:
   - Same as the shared version: import from `./apiErrorMessage.js`, remove local definitions, keep re-export.

4. **Update `src/runtime/services/api/errors.ts`**:
   - Change the import of `createAssistantAPIErrorMessage` to `../../../shared/utils/apiErrorMessage.js`.
   - Change the import of `NO_RESPONSE_REQUESTED` to `../../../shared/utils/syntheticMessages.js`.
   - Remove `createAssistantAPIErrorMessage` and `NO_RESPONSE_REQUESTED` from the `messages.js` import block.

5. **Update `src/cli/ui/ink-app/services/api/errors.ts`**:
   - Change the import of `createAssistantAPIErrorMessage` to `../../utils/apiErrorMessage.js`.
   - Change the import of `NO_RESPONSE_REQUESTED` to `../../utils/syntheticMessages.js`.
   - Remove them from the `messages.ts` import block.

6. **Iterate the build**:
   - Run `cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code && bun run build 2>&1 | tail -80`.
   - If it fails with a new `await` error, read the bundle line, identify the async `init_*` wrapper, map it back to the source module, and break that cycle by extracting leaf exports or replacing static imports with dynamic imports inside async functions.
   - Repeat until `bun run build` exits 0.

7. **Typecheck**:
   - Run `cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code && bun run typecheck`.
   - Fix any type errors introduced by the moves. Do not suppress errors with `@ts-ignore` unless the original code already used it. Do not change unrelated types.

## Constraints

- Do NOT start any dev servers.
- Do NOT run git operations (commit, push, branch, rebase, etc.).
- Do NOT modify unrelated UI, features, or build config.
- Preserve all existing runtime behavior; only move/repoint imports.
- Use the repo's existing import conventions (`.js` extensions, `@/` aliases where already present).

## Deliverable

When finished, write `docs/GIZZI_BUNDLER_PHASE_1_NOTES.md` starting with this exact YAML frontmatter:

```yaml
---
status: done
files_changed:
  - src/shared/utils/apiErrorMessage.ts
  - src/cli/ui/ink-app/utils/apiErrorMessage.ts
  - src/shared/utils/messages.ts
  - src/cli/ui/ink-app/utils/messages.ts
  - src/runtime/services/api/errors.ts
  - src/cli/ui/ink-app/services/api/errors.ts
  # add any additional files you changed
build_status: pass
typecheck_status: pass
deviations: []
remaining: []
---
```

Then add prose notes describing every cycle you broke and the final build/typecheck output.

Also create a sentinel file:

```bash
touch docs/GIZZI_BUNDLER_PHASE_1_NOTES.sentinel
```

The sentinel file tells the orchestrator you are done.
