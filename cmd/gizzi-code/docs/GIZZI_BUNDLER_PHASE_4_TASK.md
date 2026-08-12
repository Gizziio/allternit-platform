---
topic: gizzi_bundler
phase: 4
status: ready
---

# Phase 4 — Fix the production binary runtime crash

## Current state

- `bun run build` in `/Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code` now succeeds.
- `bun run typecheck` exits clean.
- **Runtime is broken**. Both the compiled binary and the raw bundle crash on `--help` with:
  ```
  TypeError: undefined is not an object (evaluating 'init_permissionSetup2().then')
  ```
- The crash happens because Bun's bundler emits circular modules as `var init_x = __esm(async()=>{...})` wrappers, and `init_permissionSetup2` is invoked before its assignment has executed.
- The previous phases added a post-build patch (`script/patch-esm-async.js`) that inserts `async` into sync `__esm` factories so the binary compiles. That patch is only a workaround; the real problem is source-level circular dependencies forcing async initialization out of order.

## Goal

Make `./dist/gizzi-code --help` and `bun .build/gizzi-code-bundle.js --help` run successfully and print the help text, without relying on the post-build async patch. Prefer source-level fixes.

## Exact scope

1. **Reproduce and inspect**
   ```bash
   cd /Users/joe/Desktop/allternit-workspace/allternit/cmd/gizzi-code
   bun .build/gizzi-code-bundle.js --help 2>&1 | head -40
   ./dist/gizzi-code --help 2>&1 | head -40
   ```
   Confirm the `init_permissionSetup2().then` TypeError.

2. **Understand the async chain**
   - In `.build/gizzi-code-bundle.js`, search for `var init_permissionSetup2=` to see its factory and the `__promiseAll([...])` it awaits.
   - Trace those awaited `init_*` identifiers back to source modules.
   - Use `npx madge --circular --extensions ts,tsx --ts-config tsconfig.json src/cli/main.ts 2>&1 | grep -i permission` to list cycles touching the permission setup chain.

3. **Break the cycle that causes out-of-order async init**
   The crash means a module calls `init_permissionSetup2()` before the `var init_permissionSetup2 = __esm(...)` assignment runs. Fix this by one or more of:
   - Extracting leaf modules that have **no** cyclic dependencies, so the async wrapper is no longer needed.
   - Replacing static imports with dynamic imports inside async functions so the module graph becomes acyclic at the top level.
   - Restructuring so `permissionSetup` and its async dependencies are initialized before anything that needs them.

   Likely files to inspect (the crash originates in the ink-app tree):
   - `src/cli/ui/ink-app/utils/permissions/permissionSetup.ts`
   - `src/cli/ui/ink-app/utils/permissions/permissions.ts`
   - `src/cli/ui/ink-app/tools.ts`
   - `src/cli/ui/ink-app/utils/auth.ts`
   - `src/cli/ui/ink-app/services/oauth/client.ts`
   - `src/cli/ui/ink-app/services/analytics/growthbook.ts`
   - `src/cli/ui/ink-app/services/api/claude.ts`
   - `src/cli/ui/ink-app/Tool.ts`
   - `src/cli/ui/ink-app/bootstrap/state.ts`

   Also check the runtime/shared mirrors of these files if they are part of the same crash path.

4. **Iterate**
   - After each source change, run `bun run build`.
   - If the binary now crashes on a different `init_x().then`, trace and fix that cycle the same way.
   - Repeat until `./dist/gizzi-code --help` prints help text and exits 0.

5. **Typecheck**
   - Run `bun run typecheck`.
   - Fix any type errors introduced by moves or dynamic imports.

6. **Optional but preferred: make the patch unnecessary**
   If the source cycles are fixed so no sync `__esm` factory contains top-level `await`, you can remove or disable `patchEsmAsyncWrappers` in `script/build-production.js`. If you cannot fully remove it, leave it in place but document why.

## Constraints

- Do NOT start any dev servers.
- Do NOT run git operations (commit, push, branch, rebase, etc.).
- Do NOT modify unrelated UI, features, or build config.
- Preserve all existing runtime behavior; only move/repoint imports or add lazy/dynamic imports.
- Use the repo's existing import conventions (`.js` extensions, `@/` aliases where already present).
- Do NOT delete existing files or symbols unless you update all references.

## Deliverable

When finished, write `docs/GIZZI_BUNDLER_PHASE_4_NOTES.md` starting with this exact YAML frontmatter:

```yaml
---
status: done
files_changed:
  # list every file you changed
build_status: pass
typecheck_status: pass
runtime_status: pass
deviations: []
remaining: []
---
```

Then add prose notes describing:
- The exact cycle(s) that caused the `init_permissionSetup2().then` crash.
- How you broke each cycle.
- Final `bun run build`, `bun run typecheck`, and `./dist/gizzi-code --help` output.
- Whether the async patch in `script/build-production.js` is still required.

Also create a sentinel file:

```bash
touch docs/GIZZI_BUNDLER_PHASE_4_NOTES.sentinel
```

The sentinel file tells the orchestrator you are done.
