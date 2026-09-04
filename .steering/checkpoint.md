# Steering checkpoint — P3 web auth parity + CORS + empty-catch audit (2026-09-04, session gizzi-p3-webauth-20260904)

## Goal
Three production-readiness hardening slices in cmd/gizzi-code, on branch `session/gizzi-p3-webauth-20260904` (rebased onto main @ fb1b64f84). No push, no merge. (1) `gizzi web` auth parity with `gizzi serve`: alt_ gateway token acceptance, shared exposure guard, WS upgrade auth. (2) CORS drift: no `Access-Control-Allow-Origin: *` by default; `GIZZI_DEV_CORS` gated dev mode with startup warning; loopback-first bind defaults. (3) Empty-catch audit across src/ — handle/comment/debug-log each.

## Just did
- RESOLVED the execa blocker: root cause was `src/shared/utils/auth.ts` doing `import execa from 'execa'` (default import). Root `node_modules/execa` symlinks execa@8.0.1 (ESM, no default export), so any test importing src/runtime/session failed at link time on a fresh pnpm install. Fixed to `import { execa } from 'execa'`. (The stale main checkout only "passed" because of its older install layout.)
- Merged test/server/cors-dev-flag.test.ts into test/server/clerk-auth-middleware.test.ts: bun test runs all files in ONE process with a shared module registry, so per-file frozen env vars (GIZZI_REQUIRE_CLERK_AUTH vs GIZZI_DEV_CORS) leaked across files. Single file now covers all 17 tests; removed the cors-dev-flag line from test/smoke.txt (was added by this session, never committed).
- Converted `Flag.GIZZI_DEV_CORS` to a dynamic getter (Object.defineProperty pattern, same as GIZZI_CONFIG_DIR/GIZZI_CLIENT in flag.ts) so tests can toggle it per-test; server.ts origin() + listen() warning read it live.
- `serverAuthConfigured()` in src/cli/server-exposure.ts now reads process.env live instead of frozen Flag consts (guard runs at command startup, after flag init; tests toggle env mid-process). Dropped the now-unused Flag import.
- Deleted temp build entry cmd/gizzi-code/zz-entry.ts. New test file: 17 pass / 0 fail.
- Full-suite (1173 tests) first rerun exposed cross-file env leakage again: bun test shares one process, and an earlier test file froze the flag module before this file's env vars applied. Fixed by making the auth decision points read env LIVE: `ClerkAuth.required()`, the basic-auth password/username read in clerk-auth.ts middleware, and `serverAuthConfigured()` in server-exposure.ts (dropped unused Flag import there). `Flag.GIZZI_DEV_CORS` converted to a dynamic getter (same Object.defineProperty pattern as GIZZI_CONFIG_DIR/GIZZI_CLIENT). Also fixed the type side: `src/types/missing-modules.d.ts` ambient `declare module 'execa'` shim lacked a named `execa` export and typed args as `string[]`; added `export function execa(file, args?: any, options?: any)` (the real execa@8 has a named export; the default import was the runtime bug). Removed now-dead `loopback`/`exposed` locals in serve.ts.
- typecheck: PASS (exit 0). Standalone new-test run: 17 pass / 0 fail.

## Next
- DONE: full ci-smoke-test.sh PASS (949 pass / 0 fail / 1173 tests / 91 files), typecheck exit 0.
- Committed on branch session/gizzi-p3-webauth-20260904 as 59f770458 (43 files, +606/-97). No push, no merge.
- Remaining for the orchestrator: merge/push decision, then worktree cleanup + agent-ledger attestation per repo AGENTS.md.

## Open questions
- none — execa blocker root-caused and fixed in-repo.
