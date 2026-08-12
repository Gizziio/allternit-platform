---
topic: gizzi_bundler
phase: 2
status: ready
---

# Phase 2 — Continue breaking bundler cycles until build + typecheck pass

## Current state

- Phase 1 work is in the working tree. It extracted several leaf modules and repointed imports for `messages.ts` / `errors.ts` / `tokens.ts` / `filesystem.ts` cycles.
- I also (manually) converted `src/cli/ui/ink-app/outputStyles/loadOutputStylesDir.ts` and `src/outputStyles/loadOutputStylesDir.ts` to dynamically import `../utils/markdownConfigLoader.js` inside their async functions, so those modules no longer synchronously depend on `markdownConfigLoader`.
- The next build failure is in `src/cli/ui/ink-app/utils/plugins/loadPluginAgents.ts` synchronously importing `pluginOptionsStorage.js`, which is part of a cycle that forces `init_pluginOptionsStorage` to be async, but `init_loadPluginAgents` is generated as sync.

## Goal

Make `bun run build` succeed, then run `bun run typecheck` and fix type errors.

## Exact scope

1. **Fix the `loadPluginAgents.ts` → `pluginOptionsStorage.js` cycle** in both copies:
   - `src/cli/ui/ink-app/utils/plugins/loadPluginAgents.ts`
   - `src/shared/utils/plugins/loadPluginAgents.ts` (if it exists and has the same synchronous import)
   - Do NOT change runtime behavior. The functions `loadPluginOptions`, `substitutePluginVariables`, `substituteUserConfigInContent` are only used inside async functions (`loadAgentFromFile` / the memoized `loadPluginAgents`). Replace the static import with a dynamic import inside those async functions, or extract the needed functions to a leaf module that has no cycles.
   - If you make `clearPluginAgentCache` or similar async, update any callers.

2. **Iterate the build**:
   - Run `cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code && bun run build 2>&1 | tail -80`.
   - If it fails with a new `"await" can only be used inside an "async" function` error, read the bundled line, identify the `init_*` wrapper, map it back to the source module, and break that cycle by:
     - Extracting leaf exports to a new file, OR
     - Replacing a static import with a dynamic import inside an async function.
   - Repeat until `bun run build` exits 0.

3. **Typecheck**:
   - Run `cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code && bun run typecheck`.
   - Fix any type errors introduced by the moves. Do not suppress errors with `@ts-ignore` unless the original code already used it. Do not change unrelated types.

## Constraints

- Do NOT start any dev servers.
- Do NOT run git operations (commit, push, branch, rebase, etc.).
- Do NOT modify unrelated UI, features, or build config.
- Preserve all existing runtime behavior; only move/repoint imports.
- Use the repo's existing import conventions (`.js` extensions, `@/` aliases where already present).
- Do NOT delete my existing changes in `loadOutputStylesDir.ts` files; build on top of them.

## Deliverable

When finished, write `docs/GIZZI_BUNDLER_PHASE_2_NOTES.md` starting with this exact YAML frontmatter:

```yaml
---
status: done
files_changed:
  - src/cli/ui/ink-app/utils/plugins/loadPluginAgents.ts
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
touch docs/GIZZI_BUNDLER_PHASE_2_NOTES.sentinel
```

The sentinel file tells the orchestrator you are done.
