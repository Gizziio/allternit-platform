# Session attestation — picker-err-20260908 (kimi-code)

**Date:** 2026-09-08 · **Branch:** `session/picker-err-20260908` → PR #149, merge `8e1779b1e`

## What

Follow-up to the desktop 1.1.0 incident (see summary
`2026-09-08-0950-native-docs-20260908-...`). When the backend predates the
native-sessions routes, `/api/v1/native-sessions/*` returns HTTP 200 with the
SPA `index.html`, and the session picker surfaced the raw parser error
`Unexpected token '<', "<!doctype"... is not valid JSON`.

`surfaces/ai.allternit.com/src/lib/agents/native-sessions-api.ts` now routes
every response through `readJson(res, what)`: bodies starting with `<` (or
failing JSON.parse) throw
"Native sessions aren't supported by this backend yet. Update Allternit Desktop
(or the backend) to a version that includes the native-sessions API."
Applied to list / listHarnesses / show / pickup / exportNative / fetchOrigin.
Non-OK statuses keep their existing messages.

## Verification

- New `native-sessions-api.test.ts`: 4 cases (HTML fallback, truncated JSON,
  healthy catalog, error-status passthrough) — all pass via `npx vitest run`.
- `npm run typecheck` (`@allternit/ai`) — clean.
- Pre-existing environmental issue, NOT fixed: repo eslint cannot run on main
  (`typescript-eslint` missing from root node_modules in fresh and shared
  checkouts). No CI workflow gates on eslint; typecheck + tests cover this change.

## Cleanup

Worktree `allternit-session-picker-err-20260908` removed, branch deleted
local + remote. Ledger entry appended.
