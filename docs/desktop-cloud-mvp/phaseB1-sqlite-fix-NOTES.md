# Phase B.1 — Fix better-sqlite3 build on Node 26

## Problem
`pnpm install` failed in this workspace on Node v26.5.0 unless `--ignore-scripts` was used. The failure was in `better-sqlite3@12.6.2` native compilation:

```
error: no member named 'This' in 'v8::PropertyCallbackInfo<v8::Value>'
```

This blocked a normal dev install and prevented `client-sqlite.ts` from loading a native SQLite binding.

## Root cause
`better-sqlite3@12.6.2` uses V8 APIs that changed in Node 26. The package had no prebuilt binary for Node 26, so it fell back to compiling from source and the source was incompatible with the new V8 headers.

## Fix
Upgraded the workspace to `better-sqlite3@13.0.3` via a root `pnpm.overrides` entry in `package.json`:

```json
"pnpm": {
  "overrides": {
    "better-sqlite3": "13.0.3"
  }
}
```

This forces every package in the workspace to resolve the same Node-26-compatible version, avoiding a mix of 11.10.0 / 12.6.2 / 13.x in the lockfile.

## Verification
1. Ran `pnpm install` from the workspace root **without** `--ignore-scripts`.
2. Install completed in 17.4s with only pre-existing peer-dep warnings.
3. Verified the native module loads:
   ```js
   const Database = require('better-sqlite3');
   const db = new Database(':memory:');
   console.log(db.prepare('select sqlite_version() as v').get().v);
   // → 3.53.4
   ```

### Screen recording
- `docs/desktop-cloud-mvp/phaseB1-sqlite-install-demo.webm`
- Shows `pnpm install` completing and the native module test returning the SQLite version.

## LOC
- One override block added to root `package.json`.
- Well under the feature-size limit.
