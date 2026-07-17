# GIZZI PRODUCTION BUILD — MERGE-ROT REPAIR (HANDOFF TASK)

> Executor: fix the remaining merge-rot errors in `cmd/gizzi-code` until the
> production bundle compiles. Then run the verification suite. NON-DESTRUCTIVE:
> never delete features or modules; repair and shim only.

## Working directory

`/Users/macbook/Desktop/allternit-workspace/allternit` (monorepo root).
All paths below are relative to it.

## Current state (already done — do NOT redo)

Workstream A (ripgrep) is COMPLETE:
- `cmd/gizzi-code/vendor/ripgrep/{arm64,x64}-{darwin,linux}/rg` (+ `x64-win32/rg.exe`)
  — official BurntSushi 15.1.0 binaries, vendored.
- `script/vendor-ripgrep.sh` created; `script/vendor-mux.sh` created (mux tree).
- `src/shared/utils/ripgrep.ts` resolution fixed: vendored-first (execDir →
  module → package root), existence-checked, before the embedded path.
- `script/build-production.js` copies both vendor trees into `dist/vendor/`.
- `test/ripgrep/vendor.test.ts` PASSES (vendored rg resolves + searches).

Workstream B (merge-rot) is ~95% done. Already fixed:
- tsconfig mappings in `tsconfig.base.json`, `tsconfig.json`,
  `src/cli/ui/ink-app/tsconfig.json` — CRITICAL FACT: **Bun only honors the
  FIRST tsconfig path-mapping entry** (no fallback iteration). All mappings
  were rewritten as single correct entries (services/state/hooks/commands →
  `cli/ui/ink-app/*`, shared → `src/shared/*`, etc.).
- Typed stubs in `src/vendor/anthropic-stubs/`: sandbox-runtime, bedrock-sdk,
  foundry-sdk, vertex-sdk, allternit-extension (empty BROWSER_TOOLS),
  audio-capture-napi, react-compiler-runtime (no-op memo cache) + tsconfig
  path mappings for all of them.
- 25+ wrong-depth relative imports repaired (claude-core/setup.ts got 29
  imports rewritten to `src/shared/utils/...`; coordinator, mcptool, oauth,
  types/hooks, constants/prompts, postCompactCleanup, tools-registry,
  agenttool, ink-renderer global.d.ts).
- `script/build-production.js` solidPlugin: private `@/` resolver rewritten to
  mirror the tsconfig tree rules (it only checked `src/X` before).
- **Babel fragment bug (the "phantom missing export" root cause)**: Babel 8's
  preset-typescript misparses JSX fragments `<>` as empty type-parameter
  lists → the transform throws and the bundle reports fake missing exports
  downstream. FIXED in the transform by adding
  `plugins: [syntaxJsxMod.default || syntaxJsxMod]` (`@babel/plugin-syntax-jsx`,
  imported alongside the presets). NOTE: Babel 8 REMOVED the
  `allExtensions`/`isTSX` options — do not use them.
- `src/cli/ui/ink-app/services/mcp/client.ts`: lazy `require()` of a
  top-level-await graph → converted to async `import()` (call sites awaited,
  map made async + Promise.all).
- Merge-by-re-export (pattern to keep using): partial module keeps its
  content, then appends `export * from '<complete counterpart>'` (local
  exports win on conflict). Applied to `src/bootstrap/state.ts` (→
  `./cli/ui/ink-app/bootstrap/state.js`, +204 exports), `src/ink.ts` (→
  `./runtime/claude-core/ink.js`), `src/runtime/services/tokenEstimation.ts`
  (→ `../../cli/ui/ink-app/services/tokenEstimation.js`).
- Default-vs-named export fixes in `src/ink/components/{Box,Link,ScrollBox,Text}.ts`
  (`export { default as X }`).
- `src/runtime/services/analytics/datadog.ts`: `../../types/model.js` →
  `../../utils/model/model.js` (just fixed, unverified).

## The loop (how to finish)

RAM DISCIPLINE: do NOT run full `script/build-production.js` until the worker
bundle is green. Use the driver (worker-only, ~1-2GB):

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code
NODE_OPTIONS=--max-old-space-size=2048 bun .driver-build.ts 2>&1 | grep -vE "BABEL|deoptimised" | tail -15
```

`.driver-build.ts` (in cmd/gizzi-code, git-ignored scratch file — keep it)
reproduces the production worker bundle exactly (same plugins/config) and
prints every error then `SUCCESS: true|false`. Loop:
1. Run driver → take the FIRST error.
2. Classify: wrong-depth import → fix the specifier to the real path (targets
   usually in `src/shared/`, `src/runtime/`, or `src/cli/ui/ink-app/`).
   Missing export in partial module → merge-by-re-export underneath (pattern
   above) or add the missing export from the complete counterpart. Missing
   optional package → typed stub in `src/vendor/anthropic-stubs/` + tsconfig
   path entry. Missing module → find it in a sibling tree (`find src -name X`)
   and fix the path.
3. Repeat until `SUCCESS: true`.

Then the FULL build (one run, ~4-8GB — warn the user first if interactive):
```bash
bun run script/build-production.js --target=darwin-arm64
```
If the MAIN bundle (Step 1b) shows new errors, fix them with the same
classifications until the binary + `dist/vendor/` trees are produced.

## Verification contract (required when the build is green)

1. `bun run script/build-production.js --target=darwin-arm64` exits 0 and
   `ls dist/gizzi-code-darwin-arm64 dist/vendor/allternit-mux dist/vendor/ripgrep`
   all exist.
2. `bun test test/ripgrep/vendor.test.ts test/pty/mux.test.ts` passes
   (env: unset ALLTERNIT_MUX_*; auto-spawn handles the daemon).
3. `cd ../.. && cargo test -p allternit-mux` stays green (19 tests).
4. Boot smoke: `dist/gizzi-code-darwin-arm64 serve --port 4099 --hostname
   127.0.0.1 &` then `curl -s http://127.0.0.1:4099/pty/list` returns JSON
   (any 2xx/JSON body counts); kill it after.
5. `git diff --stat` review: confirm NO source files were deleted (additions
   and edits only). List every file changed in your notes.
6. Append the full fix list to `docs/ALLTERNIT_TERMINAL_CONSOLIDATION_PLAN.md`
   under a "Merge-rot repair (gizzi production build)" heading.

## Sentinel

When finished, write `docs/GIZZI_BUILD_FIX_NOTES.md` starting with YAML
frontmatter:
```yaml
---
status: done | blocked
files_changed: [...]
build_green: true|false
binary: dist/gizzi-code-darwin-arm64
deviations: [...]
remaining: [...]
---
```
then prose: what was fixed, what the build output was, verification results.

## Constraints

- NO deletions of features/modules. Shims must preserve API shape and throw
  loudly only when the optional path is actually invoked.
- No git commits/pushes. No repo-wide builds except the single final
  production build. Do not touch `cmd/allternit-mux` (it is green).
- Match existing file idiom; keep `@ts-nocheck` headers where present.
