# Phase B.2 — Build and start the gizzi-code runtime

## Problem
The platform shell logged a missing `createAllternitClient` export and the
`useAgentBootstrap` hook failed because the gizzi-code runtime was not built or
running in the local dev environment. The root `dev:platform-stack` script
expects `./dist/gizzi-code`, but that directory did not exist.

## Fix
1. Built the workspace SDK that gizzi-code bundles:
   ```bash
   cd cmd/gizzi-code/packages/sdk
   node scripts/build.mjs
   ```
2. Built the gizzi-code binary:
   ```bash
   cd cmd/gizzi-code
   bun run build
   # → ./dist/gizzi-code-darwin-arm64 (171.3 MB)
   ```
3. Started the runtime server:
   ```bash
   ./dist/gizzi-code serve --port 4096 --hostname 127.0.0.1 --print-logs
   ```

## Verification
- Health endpoint responds:
  ```bash
  curl -s http://127.0.0.1:4096/health
  # → {"status":"ok","service":"gizzi-code"}
  ```
- Session list endpoint responds:
  ```bash
  curl -s http://127.0.0.1:4096/v1/session/list
  # → []
  ```
- Platform shell now initializes the API client against the correct gateway
  (`http://127.0.0.1:8013`) and no longer reports a missing
  `createAllternitClient` export.
- The shell loads to the authenticated home view and the "Desktop Cloud" rail
  item is clickable.

### Screen recording
- `docs/desktop-cloud-mvp/phaseB2-gizzi-runtime-demo.webm` (324 KB)
- Shows the platform shell loading after gizzi-code is running, with the API
  client targeting port 8013 and no `createAllternitClient` error.

## Known remaining blocker
`useAgentBootstrap` still receives HTTP 422 from an API agent-creation endpoint
and the default `ChatComposer.tsx` throws a pre-existing `submitMessage`
initialization error. Neither is caused by the gizzi-code runtime; the runtime
is reachable and the missing-export failure is resolved.

## LOC
- No source changes; only build/startup commands.
