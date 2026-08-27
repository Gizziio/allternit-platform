---
status: done
files_changed:
  - src/cli/ui/ink-app/utils/settings/applySettingsChange.ts
build_status: pass
typecheck_status: pass
runtime_status: pass
deviations: []
remaining: []
---

# Phase 4 — Fix the production binary runtime crash

## Root Cause

The crash `TypeError: undefined is not an object (evaluating 'init_permissionSetup2().then')` was caused by a **single file**:

**`src/cli/ui/ink-app/utils/settings/applySettingsChange.ts`**

This file used top-level eager dynamic imports to avoid a circular static import:

```typescript
// BEFORE (broken in bundle)
let permissionSetupModule: typeof import('../permissions/permissionSetup.js') | undefined
let permissionsModule: typeof import('../permissions/permissions.js') | undefined
void import('../permissions/permissionSetup.js').then(m => {
  permissionSetupModule = m
})
void import('../permissions/permissions.js').then(m => {
  permissionsModule = m
})
```

### Why this crashed

Bun's bundler converts dynamic `import()` calls into internal init function calls. The `void import(...)` at module top-level became:

```javascript
// In the bundle — init_applySettingsChange is a SYNC __esm factory:
var init_applySettingsChange = __esm(() => {
  // ...
  init_permissionSetup2().then(() => exports_permissionSetup).then(m => { ... })
  init_permissions4().then(() => exports_permissions).then(m => { ... })
})
```

The problem: `init_applySettingsChange` was invoked (via `init_AppState` → `init_applySettingsChange()`) **before** `var init_permissionSetup2 = __esm(...)` was assigned in the bundle's linear execution order. The variable was `undefined`, so calling `.then()` on it threw.

### The cycle path in the bundle

```
init_AppState
  └── init_applySettingsChange  (sync __esm, line 16783)
        └── init_permissionSetup2().then(...)  ← CRASHES: undefined
```

`init_permissionSetup2` corresponds to `permissionSetup.ts`, which has a deep dependency graph (growthbook, auth, tools, state, etc.) that creates the circular ordering where it ends up defined later in the bundle.

## Fix Applied

Replaced the eager top-level `void import(...)` pattern with **lazy `require()` inside getter functions**:

```typescript
// AFTER (works in bundle)
let _permissionSetupModule: typeof import('../permissions/permissionSetup.js') | undefined
let _permissionsModule: typeof import('../permissions/permissions.js') | undefined
function getPermissionSetupModule() {
  return (_permissionSetupModule ??= require('../permissions/permissionSetup.js'))
}
function getPermissionsModule() {
  return (_permissionsModule ??= require('../permissions/permissions.js'))
}
```

This works because:
1. **No top-level execution**: The `require()` only runs when `getPermissionSetupModule()` is called inside `applySettingsChange()`, which happens at runtime — well after all `__esm` factories have been assigned.
2. **Bundler-safe**: `require()` in function bodies is converted to `(init_permissionSetup2(), __toCommonJS(exports_permissionSetup))` — but now `init_permissionSetup2` is guaranteed to be defined because all `var init_* = __esm(...)` assignments have completed before any runtime function call.
3. **Preserves semantics**: `applySettingsChange()` is only called when a settings change event fires, which is long after module initialization. The lazy pattern is safe.

## Build Output

```
🔨 Step 1b: Bundling main application...
   ✓ Embedded version: 1.0.1
   ✓ Embedded 14 migrations into bundle
   ✓ Bundle written: ./.build/gizzi-code-bundle.js (104107 KB)
   ✓ Patched 126 async ESM wrappers (Bun circular-dep workaround)

🔨 Step 2: Compiling binaries...
   Building darwin-arm64... ✓ (176.1 MB)

Total: 1 successful, 0 failed
```

## Typecheck Output

```
$ NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit
(clean exit, no errors)
```

## Runtime Output

```
$ ./dist/gizzi-code --help
[prints full help text, exits 0]

$ bun .build/gizzi-code-bundle.js --help
[prints full help text, exits 0]
```

## Async Patch Status

The `patchEsmAsyncWrappers` post-build patch in `script/build-production.js` is **still required**. It patches 126 `__esm` wrappers where Bun's bundler emits sync arrow factories (`__esm(() => { ... })`) for modules that contain top-level `await`. This is a separate Bun bundler bug (missing `async` keyword) unrelated to the circular-dep ordering issue fixed here. The patch cannot be removed until Bun fixes this upstream or all top-level awaits are eliminated from the source.
